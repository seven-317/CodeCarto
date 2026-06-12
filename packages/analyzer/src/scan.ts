import fs from 'node:fs'
import path from 'node:path'
import picomatch from 'picomatch'
import { Node, Project, SyntaxKind, ts, type SourceFile } from 'ts-morph'
import {
  edgeId,
  UNRESOLVED_NODE_ID,
  type CodecartoConfig,
  type Runtime,
  type ScanEdge,
  type ScanGraph,
  type ScanNode,
  type ServiceRule,
} from '@codecarto/shared'

export { UNRESOLVED_NODE_ID }
import { extractFetchCalls } from './fetch-calls'
import {
  HTTP_METHODS,
  appRouteFromPath,
  isAppPageFile,
  isAppRouteFile,
  isPagesSpecialFile,
  matchRoute,
  pagesRouteFromPath,
} from './nextjs'
import { BUILTIN_SERVICE_RULES, matchServiceRule, serviceNodeId } from './services'

export const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  'codecarto.config.*',
]

export interface ScanOptions {
  root: string
  config?: CodecartoConfig
}

export interface Scanner {
  scan(): ScanGraph
  /** watch mode 增量更新:依檔案系統現況新增/重讀/移除指定路徑 */
  refreshPaths(paths: string[]): void
  readonly root: string
}

interface FileInfo {
  sf: SourceFile
  /** 相對 root 的 posix 路徑 */
  rel: string
  nodeId: string
  kind: 'page' | 'api' | 'file'
  route?: string
  httpMethods?: string[]
  runtime: Runtime
}

const PAGE_EXTS = /\.(tsx|jsx|ts|js)$/
const BARREL_RE = /(^|\/)index\.(tsx|ts|jsx|js|mts|mjs)$/

export function createScanner(options: ScanOptions): Scanner {
  const root = path.resolve(options.config?.root ?? options.root)
  const rootPosix = root.split(path.sep).join('/')
  const config = options.config ?? {}
  const tsconfigPath = path.resolve(root, config.tsconfig ?? 'tsconfig.json')
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`tsconfig not found: ${tsconfigPath}(codecarto 需要 tsconfig.json 才能解析模組)`)
  }

  const project = new Project({ tsConfigFilePath: tsconfigPath })
  const serviceRules: ServiceRule[] = [...(config.services ?? []), ...BUILTIN_SERVICE_RULES]

  const isExcluded = picomatch([...DEFAULT_EXCLUDES, ...(config.exclude ?? [])], { dot: true })
  const includePatterns = (config.include ?? []).flatMap((p) =>
    p.includes('*') ? [p] : [p, `${p.replace(/\/$/, '')}/**`],
  )
  const isIncluded = includePatterns.length > 0 ? picomatch(includePatterns, { dot: true }) : null

  function relOf(sf: SourceFile): string {
    return path.posix.relative(rootPosix, sf.getFilePath())
  }

  function selectFiles(): SourceFile[] {
    return project.getSourceFiles().filter((sf) => {
      if (sf.isDeclarationFile()) return false
      const fp = sf.getFilePath()
      if (fp.includes('/node_modules/')) return false
      const rel = path.posix.relative(rootPosix, fp)
      if (rel.startsWith('..')) return false
      if (isExcluded(rel)) return false
      if (isIncluded && !isIncluded(rel)) return false
      return true
    })
  }

  function classify(sf: SourceFile): FileInfo {
    const rel = relOf(sf)
    const useClient = hasUseClient(sf)

    const appRel = stripPrefix(rel, ['app/', 'src/app/'])
    if (appRel !== null) {
      if (isAppPageFile(appRel)) {
        const route = appRouteFromPath(appRel)
        return { sf, rel, nodeId: `page:${route}`, kind: 'page', route, runtime: useClient ? 'client' : 'server' }
      }
      if (isAppRouteFile(appRel)) {
        const route = appRouteFromPath(appRel)
        const methods = [...sf.getExportedDeclarations().keys()].filter((k) =>
          (HTTP_METHODS as readonly string[]).includes(k),
        )
        return {
          sf,
          rel,
          nodeId: `api:${route}`,
          kind: 'api',
          route,
          httpMethods: methods.length ? methods : undefined,
          runtime: 'server',
        }
      }
    }

    const pagesRel = stripPrefix(rel, ['pages/', 'src/pages/'])
    if (pagesRel !== null && PAGE_EXTS.test(pagesRel) && !isPagesSpecialFile(pagesRel)) {
      const route = pagesRouteFromPath(pagesRel)
      if (pagesRel.startsWith('api/')) {
        return { sf, rel, nodeId: `api:${route}`, kind: 'api', route, runtime: 'server' }
      }
      return { sf, rel, nodeId: `page:${route}`, kind: 'page', route, runtime: useClient ? 'client' : 'shared' }
    }

    return { sf, rel, nodeId: rel, kind: 'file', runtime: useClient ? 'client' : 'shared' }
  }

  function scan(): ScanGraph {
    const files = selectFiles().map(classify)
    const infoByPath = new Map(files.map((f) => [f.sf.getFilePath() as string, f]))
    const barrelCache = new Map<string, Map<string, SourceFile>>()

    const nodes = new Map<string, ScanNode>()
    const edges = new Map<string, ScanEdge>()

    const addEdge = (source: string, target: string, kind: ScanEdge['kind'], resolved: boolean) => {
      if (source === target) return
      const id = edgeId(source, target, kind)
      const existing = edges.get(id)
      // 已標記 resolved 的邊不被 unresolved 蓋掉
      if (!existing || (!existing.resolved && resolved)) {
        edges.set(id, { id, source, target, kind, resolved })
      }
    }

    for (const info of files) {
      nodes.set(info.nodeId, {
        id: info.nodeId,
        kind: info.kind,
        label: nodeLabel(info),
        filePath: info.rel,
        route: info.route,
        httpMethods: info.httpMethods,
        runtime: info.runtime,
        loc: info.sf.getEndLineNumber(),
      })
    }

    const apiNodes = files.filter((f) => f.kind === 'api' && f.route)

    const ensureService = (rule: ServiceRule): string => {
      const id = serviceNodeId(rule.label)
      if (!nodes.has(id)) nodes.set(id, { id, kind: 'service', label: rule.label, runtime: 'server' })
      return id
    }
    const ensureExternal = (specifier: string): string => {
      const pkg = packageName(specifier)
      const id = `external:${pkg}`
      if (!nodes.has(id)) nodes.set(id, { id, kind: 'external', label: pkg })
      return id
    }
    const ensureUnresolved = (): string => {
      if (!nodes.has(UNRESOLVED_NODE_ID)) {
        nodes.set(UNRESOLVED_NODE_ID, { id: UNRESOLVED_NODE_ID, kind: 'external', label: 'Unresolved calls' })
      }
      return UNRESOLVED_NODE_ID
    }

    /** 把 import 的解析結果轉成邊;含 service 偵測、外部聚合、barrel 展開 */
    const handleImport = (
      info: FileInfo,
      specifier: string,
      target: SourceFile | undefined,
      namedImports: string[],
      hasNonNamedImport: boolean,
    ) => {
      const serviceRule = matchServiceRule(specifier, serviceRules)
      if (serviceRule) {
        addEdge(info.nodeId, ensureService(serviceRule), 'service-call', true)
        return
      }
      if (!target || target.getFilePath().includes('/node_modules/')) {
        if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
          addEdge(info.nodeId, ensureExternal(specifier), 'import', true)
        }
        return
      }
      // barrel file 展開到真實來源
      if (BARREL_RE.test(target.getFilePath()) && namedImports.length > 0) {
        const exportMap = resolveBarrel(target, barrelCache)
        let fellBack = hasNonNamedImport
        for (const name of namedImports) {
          const realTarget = exportMap.get(name)
          if (realTarget && realTarget !== info.sf) {
            const realInfo = infoByPath.get(realTarget.getFilePath())
            if (realInfo) {
              addEdge(info.nodeId, realInfo.nodeId, 'import', true)
              continue
            }
          }
          fellBack = true
        }
        if (!fellBack) return
      }
      const targetInfo = infoByPath.get(target.getFilePath())
      if (targetInfo) addEdge(info.nodeId, targetInfo.nodeId, 'import', true)
    }

    for (const info of files) {
      const { sf } = info

      for (const decl of sf.getImportDeclarations()) {
        const namedImports = decl.getNamedImports().map((n) => n.getName())
        const hasNonNamed = decl.getDefaultImport() != null || decl.getNamespaceImport() != null
        handleImport(info, decl.getModuleSpecifierValue(), decl.getModuleSpecifierSourceFile(), namedImports, hasNonNamed)
      }

      for (const decl of sf.getExportDeclarations()) {
        const spec = decl.getModuleSpecifierValue()
        if (!spec) continue
        handleImport(info, spec, decl.getModuleSpecifierSourceFile(), [], true)
      }

      // dynamic import('...')
      for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue
        const arg = call.getArguments()[0]
        if (!arg || !(Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))) continue
        const spec = arg.getLiteralText()
        const resolved = ts.resolveModuleName(
          spec,
          sf.getFilePath(),
          project.getCompilerOptions(),
          project.getModuleResolutionHost(),
        )
        const resolvedPath = resolved.resolvedModule?.resolvedFileName
        const target = resolvedPath ? project.getSourceFile(resolvedPath) : undefined
        handleImport(info, spec, target, [], true)
      }

      // fetch / axios / ky → Page→API 連線
      for (const callSite of extractFetchCalls(sf)) {
        if (callSite.url.startsWith('http')) continue // 外部 API,v1 不畫
        if (!callSite.url.startsWith('/')) continue
        const candidates = apiNodes.filter((a) => matchRoute(callSite.url, a.route!, !callSite.fullyStatic))
        if (callSite.fullyStatic && candidates.length > 0) {
          for (const c of candidates) addEdge(info.nodeId, c.nodeId, 'fetch', true)
        } else if (!callSite.fullyStatic && candidates.length === 1) {
          addEdge(info.nodeId, candidates[0]!.nodeId, 'fetch', false)
        } else {
          addEdge(info.nodeId, ensureUnresolved(), 'fetch', false)
        }
      }
    }

    const sortedNodes = [...nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
    const sortedEdges = [...edges.values()].sort((a, b) => (a.id < b.id ? -1 : 1))

    return {
      version: 1,
      scannedAt: new Date().toISOString(),
      root,
      nodes: sortedNodes,
      edges: sortedEdges,
    }
  }

  function refreshPaths(paths: string[]): void {
    for (const p of paths) {
      const abs = path.resolve(root, p)
      const existing = project.getSourceFile(abs)
      if (!fs.existsSync(abs)) {
        if (existing) project.removeSourceFile(existing)
      } else if (existing) {
        existing.refreshFromFileSystemSync()
      } else {
        project.addSourceFileAtPath(abs)
      }
    }
  }

  return { scan, refreshPaths, root }
}

/** 一次性掃描 */
export function scanProject(options: ScanOptions): ScanGraph {
  return createScanner(options).scan()
}

function nodeLabel(info: FileInfo): string {
  if (info.kind === 'page') return info.route ?? info.rel
  if (info.kind === 'api') {
    const methods = info.httpMethods?.join('/') ?? ''
    return methods ? `${methods} ${info.route}` : (info.route ?? info.rel)
  }
  return path.posix.basename(info.rel)
}

function stripPrefix(rel: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (rel.startsWith(prefix)) return rel.slice(prefix.length)
  }
  return null
}

function hasUseClient(sf: SourceFile): boolean {
  const first = sf.getStatements()[0]
  if (!first || !Node.isExpressionStatement(first)) return false
  const expr = first.getExpression()
  return Node.isStringLiteral(expr) && expr.getLiteralText() === 'use client'
}

function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0]!
}

/** barrel 的 export name → 真實來源檔(穿透 re-export 鏈) */
function resolveBarrel(barrel: SourceFile, cache: Map<string, Map<string, SourceFile>>): Map<string, SourceFile> {
  const key = barrel.getFilePath()
  const cached = cache.get(key)
  if (cached) return cached
  const map = new Map<string, SourceFile>()
  for (const [name, decls] of barrel.getExportedDeclarations()) {
    const first = decls[0]
    if (first) map.set(name, first.getSourceFile())
  }
  cache.set(key, map)
  return map
}
