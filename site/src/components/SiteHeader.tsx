import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LocaleSwitcher } from './LocaleSwitcher'
import { ThemeToggle } from './ThemeToggle'

export type NavKey = 'home' | 'features' | 'docs'

/** demo SPA 由 public/demo 提供,與 locale 無關;index.html 讓 dev 與 Vercel 皆可解析 */
const DEMO = '/demo/index.html'

/** 站頭:品牌 + 分頁導航(active 態)+ 語言 / 主題段控。RWD 由 globals.css 處理 */
export function SiteHeader({ active }: { active: NavKey }) {
  const t = useTranslations('nav')
  const items: { key: NavKey; href: string }[] = [
    { key: 'home', href: '/' },
    { key: 'features', href: '/features' },
    { key: 'docs', href: '/docs' },
  ]

  return (
    <header>
      <div className="wrap site-header">
        <Link href="/" className="brand">
          CODECARTO
        </Link>
        <nav className="site-nav">
          {items.map((it) => (
            <Link key={it.key} href={it.href} data-active={it.key === active ? 'true' : undefined}>
              {t(it.key)}
            </Link>
          ))}
          <a href={DEMO}>{t('demo')}</a>
        </nav>
        <div className="site-controls">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
