import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// 處理 `/` → 預設語言轉址與 locale 前綴(非靜態部署的標準做法)
export default createMiddleware(routing)

export const config = {
  // 跳過 API、Next 內部、demo SPA(public/demo)與帶副檔名的靜態檔
  matcher: '/((?!api|_next|_vercel|demo|.*\\..*).*)',
}
