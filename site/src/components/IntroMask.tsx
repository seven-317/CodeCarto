'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

const SEEN_KEY = 'cc_intro_seen'

/**
 * 首次進站動畫:全屏遮罩蓋住 hero,短暫停留後由下往上捲開露出頁面。
 * Nothing 風格:純底色、mono 引言 + Doto 品牌 + 單一紅點。
 * 每個 session 只播一次;尊重 prefers-reduced-motion。
 */
export function IntroMask() {
  const t = useTranslations('intro')
  // 'show'(蓋住)→ 'lift'(上移)→ 'done'(卸載)
  const [phase, setPhase] = useState<'show' | 'lift' | 'done'>('show')

  useEffect(() => {
    const seen = typeof window !== 'undefined' && sessionStorage.getItem(SEEN_KEY)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (seen || reduce) {
      setPhase('done')
      return
    }
    sessionStorage.setItem(SEEN_KEY, '1')
    document.documentElement.style.overflow = 'hidden' // 動畫期間鎖捲動
    const lift = setTimeout(() => setPhase('lift'), 1100)
    const done = setTimeout(() => {
      setPhase('done')
      document.documentElement.style.overflow = ''
    }, 1100 + 850)
    return () => {
      clearTimeout(lift)
      clearTimeout(done)
      document.documentElement.style.overflow = ''
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div className="intro-mask" data-lift={phase === 'lift' || undefined}>
      <div className="intro-inner">
        <span className="intro-lead">{t('lead')}</span>
        <span className="intro-brand">
          CODECARTO<span className="intro-dot">.</span>
        </span>
      </div>
    </div>
  )
}
