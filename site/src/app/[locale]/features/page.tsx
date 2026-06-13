import type { Metadata } from 'next'
import { hasLocale, useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { routing } from '@/i18n/routing'

export const metadata: Metadata = { title: 'codecarto — features' }

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

/** 功能依三層 + 效能分組;每組列出對應的 feature 列 */
const GROUPS: Record<string, string[]> = {
  analysis: ['semantics', 'services', 'stable'],
  curation: ['curation', 'manual', 'migration'],
  communication: ['presentation', 'views', 'flow', 'export', 'watch'],
  performance: ['perf'],
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return <Features />
}

function Features() {
  const t = useTranslations()
  const exportRows = t.raw('features.export') as { k: string; v: string }[]

  return (
    <>
      <SiteHeader active="features" />

      <main>
        <div className="wrap page-head">
          <h1 className="page-title">{t('features.title')}</h1>
          <p className="page-intro">{t('features.intro')}</p>
        </div>

        {(['analysis', 'curation', 'communication', 'performance'] as const).map((group, gi) => (
          <section className="wrap" key={group}>
            <h2>
              <span className="idx">{String(gi + 1).padStart(2, '0')}</span>
              {t(`features.groups.${group}`)}
            </h2>
            <div className="feats">
              {(GROUPS[group] ?? []).map((key) => (
                <div className="feat" key={key}>
                  <span className="k">{t(`features.items.${key}.k`)}</span>
                  <span className="v">{t(`features.items.${key}.v`)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="wrap">
          <h2>
            <span className="idx">05</span>
            {t('features.exportTitle')}
          </h2>
          <div className="feats">
            {exportRows.map((row) => (
              <div className="feat" key={row.k}>
                <span className="k">{row.k}</span>
                <span className="v">{row.v}</span>
              </div>
            ))}
          </div>
          <p className="note">{t('features.exportNote')}</p>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
