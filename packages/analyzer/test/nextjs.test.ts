import { describe, expect, it } from 'vitest'
import { appRouteFromPath, matchRoute, pagesRouteFromPath } from '../src/nextjs'

describe('appRouteFromPath', () => {
  it('基本路由', () => {
    expect(appRouteFromPath('page.tsx')).toBe('/')
    expect(appRouteFromPath('dashboard/settings/page.tsx')).toBe('/dashboard/settings')
  })
  it('route group / parallel route 不出現在 URL', () => {
    expect(appRouteFromPath('dashboard/(admin)/settings/page.tsx')).toBe('/dashboard/settings')
    expect(appRouteFromPath('@modal/photo/page.tsx')).toBe('/photo')
  })
  it('動態 segment 保留', () => {
    expect(appRouteFromPath('blog/[slug]/page.tsx')).toBe('/blog/[slug]')
  })
})

describe('pagesRouteFromPath', () => {
  it('index 處理', () => {
    expect(pagesRouteFromPath('index.tsx')).toBe('/')
    expect(pagesRouteFromPath('blog/index.tsx')).toBe('/blog')
    expect(pagesRouteFromPath('blog/[slug].tsx')).toBe('/blog/[slug]')
  })
})

describe('matchRoute', () => {
  it('靜態與動態 segment', () => {
    expect(matchRoute('/api/users', '/api/users')).toBe(true)
    expect(matchRoute('/api/users/123', '/api/users/[id]')).toBe(true)
    expect(matchRoute('/api/users/123', '/api/users')).toBe(false)
    expect(matchRoute('/api/posts', '/api/users')).toBe(false)
  })
  it('catch-all', () => {
    expect(matchRoute('/docs/a/b/c', '/docs/[...slug]')).toBe(true)
  })
  it('前綴模式:結尾 / 代表後面還有 segment', () => {
    expect(matchRoute('/api/users/', '/api/users/[id]', true)).toBe(true)
    expect(matchRoute('/api/users/', '/api/users', true)).toBe(false)
    expect(matchRoute('/api/', '/api/users', true)).toBe(true)
  })
})
