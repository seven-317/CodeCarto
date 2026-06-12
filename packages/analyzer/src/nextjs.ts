/** Next.js 路由語意:從檔案路徑推出 route 字串。皆以 posix 相對路徑輸入。 */

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

const PAGE_EXT = /\.(tsx|jsx|ts|js|mjs)$/

/** App Router:`dashboard/(admin)/settings/page.tsx` → `/dashboard/settings` */
export function appRouteFromPath(relFromAppDir: string): string {
  const dir = relFromAppDir.replace(/\/?[^/]+$/, '') // 去掉 page.tsx / route.ts 檔名
  const segments = dir
    .split('/')
    .filter(Boolean)
    // route group `(group)`、intercepting `(.)foo`、parallel route `@slot` 不出現在 URL
    .filter((seg) => !seg.startsWith('(') && !seg.startsWith('@'))
  return '/' + segments.join('/')
}

/** Pages Router:`blog/[slug].tsx` → `/blog/[slug]`,`index.tsx` → `/` */
export function pagesRouteFromPath(relFromPagesDir: string): string {
  let p = relFromPagesDir.replace(PAGE_EXT, '')
  if (p === 'index') return '/'
  p = p.replace(/\/index$/, '')
  return '/' + p
}

export function isAppPageFile(relFromAppDir: string): boolean {
  return /(^|\/)page\.(tsx|jsx|ts|js)$/.test(relFromAppDir)
}

export function isAppRouteFile(relFromAppDir: string): boolean {
  return /(^|\/)route\.(ts|js|mts|mjs)$/.test(relFromAppDir)
}

export function isPagesSpecialFile(relFromPagesDir: string): boolean {
  return /^_(app|document|error)\./.test(relFromPagesDir.split('/').pop() ?? '')
}

/**
 * URL path 與 Next.js route pattern 的比對。
 * `[id]` 匹配單一 segment;`[...slug]`、`[[...slug]]` 匹配其餘所有 segment。
 * @param prefixOnly URL 只是已知前綴(模板字串開頭),允許 pattern 比 URL 長。
 */
export function matchRoute(urlPath: string, routePattern: string, prefixOnly = false): boolean {
  const url = urlPath.split('?')[0]!.split('#')[0]!
  const urlSegs = url.split('/').filter(Boolean)
  const patSegs = routePattern.split('/').filter(Boolean)
  // 前綴以 `/` 結尾(如模板 `/api/users/${id}`)代表後面必有更多 segment
  const expectsMore = prefixOnly && url.endsWith('/') && urlSegs.length > 0

  let i = 0
  for (; i < patSegs.length; i++) {
    const pat = patSegs[i]!
    if (/^\[\[?\.\.\./.test(pat)) return true // catch-all 吃掉剩餘
    if (i >= urlSegs.length) return prefixOnly
    if (pat.startsWith('[')) continue // 動態 segment 匹配任意值
    if (pat !== urlSegs[i]) return false
  }
  return i === urlSegs.length && !expectsMore
}
