import type { Metadata } from 'next'
import { hasLocale, useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { routing } from '@/i18n/routing'

export const metadata: Metadata = { title: 'codecarto — docs' }

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return <Docs />
}

function Docs() {
  const t = useTranslations()
  const commandsHead = t.raw('docs.cliCommandsHead') as { name: string; desc: string }
  const commands = t.raw('docs.cliCommands') as { name: string; desc: string }[]
  const options = t.raw('docs.cliOptions') as { name: string; desc: string }[]
  const mapKeys = t.raw('docs.mapKeys') as { k: string; v: string }[]
  const privacy = t.raw('docs.privacy') as string[]

  return (
    <>
      <SiteHeader active="docs" />

      <main>
        <div className="wrap page-head">
          <h1 className="page-title">{t('docs.title')}</h1>
        </div>

        <section className="wrap">
          <h2>
            <span className="idx">01</span>
            {t('docs.installTitle')}
          </h2>
          <pre>
            <span className="c">{t('docs.install.comment1')}</span>
            {'\n'}
            <span className="k">npx codecarto</span>
            {'              '}
            <span className="c">{t('docs.install.map')}</span>
            {'\n'}
            <span className="k">npx codecarto map --watch</span>
            {'  '}
            <span className="c">{t('docs.install.watch')}</span>
            {'\n'}
            <span className="k">npx codecarto scan --json</span>
            {'  '}
            <span className="c">{t('docs.install.scan')}</span>
            {'\n'}
            <span className="k">npx codecarto init</span>
            {'         '}
            <span className="c">{t('docs.install.init')}</span>
            {'\n\n'}
            <span className="c">{t('docs.install.comment2')}</span>
            {'\n'}
            <span className="k">npm i -g codecarto</span>
            {'\n'}
            <span className="k">cct map --watch</span>
          </pre>
        </section>

        <section className="wrap">
          <h2>
            <span className="idx">02</span>
            {t('docs.cliTitle')}
          </h2>
          <div className="rows">
            <div className="row row-head">
              <span className="row-k">{commandsHead.name}</span>
              <span className="row-v">{commandsHead.desc}</span>
            </div>
            {commands.map((c) => (
              <div className="row" key={c.name}>
                <code className="row-k">{c.name}</code>
                <span className="row-v">{c.desc}</span>
              </div>
            ))}
          </div>
          <h3 className="sub">{t('docs.cliOptionsTitle')}</h3>
          <div className="rows">
            {options.map((o) => (
              <div className="row" key={o.name}>
                <code className="row-k">{o.name}</code>
                <span className="row-v">{o.desc}</span>
              </div>
            ))}
          </div>
          <p className="note">{t('docs.cliAlias')}</p>
        </section>

        <section className="wrap">
          <h2>
            <span className="idx">03</span>
            {t('docs.configTitle')}
          </h2>
          <pre>
            <span className="c">{t('docs.configComment')}</span>
            {'\n'}
            <span className="k">import</span>
            {' { defineConfig } '}
            <span className="k">from</span>
            {" 'codecarto'\n\n"}
            <span className="k">export default</span>
            {' defineConfig({\n'}
            {"  include: ['src', 'app'],\n"}
            {"  exclude: ['**/*.stories.tsx'],\n"}
            {"  tsconfig: 'tsconfig.json',\n"}
            {"  services: [{ match: 'import:@upstash/redis', label: 'Redis', icon: 'database' }],\n"}
            {'})'}
          </pre>
          <p className="note">{t('docs.configNote')}</p>
        </section>

        <section className="wrap">
          <h2>
            <span className="idx">04</span>
            {t('docs.mapTitle')}
          </h2>
          <p className="page-intro">{t('docs.mapIntro')}</p>
          <div className="rows">
            {mapKeys.map((row) => (
              <div className="row" key={row.k}>
                <code className="row-k">{row.k}</code>
                <span className="row-v">{row.v}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap">
          <h2>
            <span className="idx">05</span>
            {t('docs.privacyTitle')}
          </h2>
          <div className="privacy">
            <ul className="privacy-list">
              {privacy.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
