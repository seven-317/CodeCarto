import { Link } from '@/i18n/navigation'
import { LocaleSwitcher } from './LocaleSwitcher'
import { SiteNav, type NavKey } from './SiteNav'
import { ThemeToggle } from './ThemeToggle'

export type { NavKey }

/** 站頭:品牌 + 導航(桌面水平 / 小螢幕 burger)+ 語言 / 主題段控 */
export function SiteHeader({ active }: { active: NavKey }) {
  return (
    <header>
      <div className="wrap site-header">
        <Link href="/" className="brand">
          CODECARTO
        </Link>
        <SiteNav active={active} />
        <div className="site-controls">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
