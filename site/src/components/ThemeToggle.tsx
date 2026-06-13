'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

/** LIGHT | DARK 段控,與 app UI 同款。SSR 不知道主題,掛載後才顯示 active 態 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="nd-seg">
      <button
        data-active={mounted && resolvedTheme === 'light' ? 'true' : undefined}
        onClick={() => setTheme('light')}
      >
        Light
      </button>
      <button
        data-active={mounted && resolvedTheme === 'dark' ? 'true' : undefined}
        onClick={() => setTheme('dark')}
      >
        Dark
      </button>
    </div>
  )
}
