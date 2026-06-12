import { Node, SyntaxKind, type SourceFile } from 'ts-morph'

export interface FetchCallSite {
  /** URL 字面值;模板字串只取得開頭時為其前綴 */
  url: string
  /** true = 完整字面值;false = 只有前綴可知(模板字串) */
  fullyStatic: boolean
  method?: string
  line: number
}

const HTTP_CLIENT_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

/**
 * 靜態抽取 fetch / axios / ky 呼叫的 URL。
 * 完全動態組出的 URL(變數、函式回傳值)無法解析,直接略過 —
 * 由使用者在 UI 以手動連線(annotation edge)補上。
 */
export function extractFetchCalls(sf: SourceFile): FetchCallSite[] {
  const calls: FetchCallSite[] = []

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression()
    let method: string | undefined

    if (Node.isIdentifier(callee)) {
      const name = callee.getText()
      if (name !== 'fetch' && name !== 'axios' && name !== 'ky') continue
      if (name === 'fetch' || name === 'axios') method = readMethodOption(call)
    } else if (Node.isPropertyAccessExpression(callee)) {
      const objText = callee.getExpression().getText()
      const prop = callee.getName()
      if ((objText !== 'axios' && objText !== 'ky') || !HTTP_CLIENT_METHODS.has(prop)) continue
      method = prop.toUpperCase()
    } else {
      continue
    }

    const arg = call.getArguments()[0]
    if (!arg) continue

    if (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
      calls.push({ url: arg.getLiteralText(), fullyStatic: true, method, line: call.getStartLineNumber() })
    } else if (Node.isTemplateExpression(arg)) {
      const head = arg.getHead().getLiteralText()
      if (head.startsWith('/') || head.startsWith('http')) {
        calls.push({ url: head, fullyStatic: false, method, line: call.getStartLineNumber() })
      }
    }
  }
  return calls
}

/** 從 fetch(url, { method: 'POST' }) 的第二參數讀出 method 字面值 */
function readMethodOption(call: import('ts-morph').CallExpression): string | undefined {
  const opts = call.getArguments()[1]
  if (!opts || !Node.isObjectLiteralExpression(opts)) return undefined
  const prop = opts.getProperty('method')
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined
  const init = prop.getInitializer()
  if (init && (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init))) {
    return init.getLiteralText().toUpperCase()
  }
  return undefined
}
