'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

export type NavKey = 'home' | 'features' | 'docs'

/** demo SPA 由 public/demo 提供;index.html 讓 dev 與 Vercel 皆可解析 */
const DEMO = '/demo/index.html'

/** 桌面:水平導航。小螢幕:burger 收合成下拉面板 */
export function SiteNav({ active }: { active: NavKey }) {
  const t = useTranslations('nav')
  const [open, setOpen] = useState(false)
  const items: { key: NavKey; href: string }[] = [
    { key: 'home', href: '/' },
    { key: 'features', href: '/features' },
    { key: 'docs', href: '/docs' },
  ]

  return (
    <>
      <button
        className="nav-burger"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '✕' : '≡'}
      </button>
      <nav className="site-nav" data-open={open || undefined}>
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            data-active={it.key === active ? 'true' : undefined}
            onClick={() => setOpen(false)}
          >
            {t(it.key)}
          </Link>
        ))}
        <a href={DEMO} onClick={() => setOpen(false)}>
          {t('demo')}
        </a>
      </nav>
    </>
  )
}
