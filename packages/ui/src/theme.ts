import type { NodeKind } from '@codecarto/shared'

export type Theme = 'light' | 'dark'

export const ACCENT = '#d71921'

/**
 * 畫布層(SVG / canvas / 匯出)無法吃 CSS 變數的顏色集中在這。
 * light = 印刷技術手冊;dark = 暗房裡的儀表板。
 */
export interface CanvasPalette {
  /** fetch 邊(最重)*/
  ink: string
  /** service-call 邊 */
  mid: string
  /** import 邊(最輕)*/
  faint: string
  /** dot-grid 紙面 */
  dots: string
  /** 頁面底色(PNG 匯出背景)*/
  page: string
  surface: string
  borderVisible: string
  /** minimap 遮罩 */
  mask: string
  minimap: Record<NodeKind, string>
}

export const PALETTES: Record<Theme, CanvasPalette> = {
  light: {
    ink: '#1a1a1a',
    mid: '#999999',
    faint: '#cfcfcf',
    dots: '#dcdcdc',
    page: '#f5f5f5',
    surface: '#ffffff',
    borderVisible: '#cccccc',
    mask: 'rgba(245, 245, 245, 0.85)',
    minimap: {
      page: '#000000',
      api: '#666666',
      service: '#999999',
      module: '#cccccc',
      file: '#bbbbbb',
      external: '#dddddd',
    },
  },
  dark: {
    ink: '#e8e8e8',
    mid: '#888888',
    faint: '#3a3a3a',
    dots: '#262626',
    page: '#000000',
    surface: '#111111',
    borderVisible: '#333333',
    mask: 'rgba(0, 0, 0, 0.85)',
    minimap: {
      page: '#ffffff',
      api: '#999999',
      service: '#777777',
      module: '#555555',
      file: '#444444',
      external: '#333333',
    },
  },
}

/**
 * 策展色的語意轉換:色盤裡的「墨 / 灰」在深色模式對應亮值,
 * 狀態色(紅/綠/琥珀)跨模式不變。codecarto.map.json 一律存 light hex。
 */
export function curatedColor(color: string, theme: Theme): string {
  if (theme !== 'dark') return color
  const map: Record<string, string> = { '#000000': '#ffffff', '#666666': '#999999' }
  return map[color.toLowerCase()] ?? color
}

const STORAGE_KEY = 'codecarto-theme'

export function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' || stored === 'light' ? stored : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(STORAGE_KEY, theme)
}
