'use client'

import { useLocale } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'

const LABELS: Record<Locale, string> = { en: 'EN', 'zh-tw': '中文' }

/** EN | 中文 段控;切換語言時保留當前分頁路徑 */
export function LocaleSwitcher() {
  const current = useLocale()
  const pathname = usePathname()
  return (
    <div className="nd-seg">
      {routing.locales.map((locale) => (
        <Link key={locale} href={pathname} locale={locale} data-active={locale === current ? 'true' : undefined}>
          {LABELS[locale]}
        </Link>
      ))}
    </div>
  )
}
