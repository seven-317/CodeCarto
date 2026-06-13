import Link from 'next/link'
import { routing, type Locale } from '@/i18n/routing'

const LABELS: Record<Locale, string> = { en: 'EN', 'zh-tw': '中文' }

/** EN | 中文 段控;單頁站,直接連到另一個 locale 的根 */
export function LocaleSwitcher({ current }: { current: Locale }) {
  return (
    <div className="nd-seg">
      {routing.locales.map((locale) => (
        <Link key={locale} href={`/${locale}/`} data-active={locale === current ? 'true' : undefined}>
          {LABELS[locale]}
        </Link>
      ))}
    </div>
  )
}
