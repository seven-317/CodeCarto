import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'zh-tw'],
  defaultLocale: 'en',
  // 靜態輸出沒有 middleware 偵測語言,所有頁面都帶 locale 前綴;
  // 根路徑由 build 腳本產生的靜態轉址頁處理
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]
