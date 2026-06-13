import { hasLocale, useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { routing } from '@/i18n/routing'

const GITHUB = 'https://github.com/seven-317/CodeCarto'
const NPM = 'https://www.npmjs.com/package/codecarto'
/** 站內所有頁面都在 /[locale]/ 下,demo 永遠在上一層 */
const DEMO = '../demo/'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return <Home locale={locale} />
}

function Home({ locale }: { locale: (typeof routing.locales)[number] }) {
  const t = useTranslations()

  return (
    <>
      <header>
        <div className="wrap">
          <span className="brand">CODECARTO</span>
          <nav>
            <a href={DEMO}>{t('nav.demo')}</a>
            <a href={GITHUB}>{t('nav.github')}</a>
            <LocaleSwitcher current={locale} />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main>
        <div className="wrap hero">
          <h1>
            CODECARTO<span className="dot">.</span>
          </h1>
          <p className="tagline">{t('hero.tagline')}</p>
          <div className="cmd">
            <span className="dollar">$</span>npx codecarto
          </div>
          <div className="links">
            <a href={DEMO}>{t('hero.liveDemo')}</a>
            <a href={GITHUB}>{t('hero.github')}</a>
            <a href={NPM}>{t('hero.npm')}</a>
          </div>
        </div>

        <div className="wrap demo">
          <span className="label">{t('demo.label')}</span>
          <iframe src={DEMO} title="codecarto live demo" loading="lazy" />
        </div>

        <section className="wrap">
          <h2>
            <span className="idx">01</span>
            {t('layers.title')}
          </h2>
          <div className="layers">
            {(['scan', 'curate', 'present'] as const).map((key, i) => (
              <div className="layer" key={key}>
                <span className="no">{i + 1} ──</span>
                <h3>{t(`layers.${key}.title`)}</h3>
                <p>{t(`layers.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap">
          <h2>
            <span className="idx">02</span>
            {t('quickstart.title')}
          </h2>
          <pre>
            <span className="c">{t('quickstart.comment1')}</span>
            {'\n'}
            <span className="k">npx codecarto</span>
            {'              '}
            <span className="c">{t('quickstart.map')}</span>
            {'\n'}
            <span className="k">npx codecarto map --watch</span>
            {'  '}
            <span className="c">{t('quickstart.watch')}</span>
            {'\n'}
            <span className="k">npx codecarto scan --json</span>
            {'  '}
            <span className="c">{t('quickstart.scan')}</span>
            {'\n'}
            <span className="k">npx codecarto init</span>
            {'         '}
            <span className="c">{t('quickstart.init')}</span>
            {'\n\n'}
            <span className="c">{t('quickstart.comment2')}</span>
            {'\n'}
            <span className="k">npm i -g codecarto</span>
            {'\n'}
            <span className="k">cct map --watch</span>
          </pre>
        </section>

        <section className="wrap">
          <h2>
            <span className="idx">03</span>
            {t('features.title')}
          </h2>
          <div className="feats">
            {(
              [
                'semantics',
                'curation',
                'migration',
                'presentation',
                'views',
                'flow',
                'export',
                'watch',
                'perf',
              ] as const
            ).map((key) => (
              <div className="feat" key={key}>
                <span className="k">{t(`features.${key}.k`)}</span>
                <span className="v">{t(`features.${key}.v`)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap">
          <h2>
            <span className="idx">04</span>
            {t('config.title')}
          </h2>
          <pre>
            <span className="c">{t('config.comment')}</span>
            {'\n'}
            <span className="k">import</span>
            {' { defineConfig } '}
            <span className="k">from</span>
            {" 'codecarto'\n\n"}
            <span className="k">export default</span>
            {' defineConfig({\n'}
            {"  include: ['src', 'app'],\n"}
            {"  exclude: ['**/*.stories.tsx'],\n"}
            {"  services: [{ match: 'import:@upstash/redis', label: 'Redis', icon: 'database' }],\n"}
            {'})'}
          </pre>
        </section>

        <section className="wrap">
          <div className="privacy">
            <span className="label">{t('privacy.label')}</span>
            <p>{t('privacy.body')}</p>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>{t('footer.license')}</span>
          <a href={GITHUB}>github.com/seven-317/CodeCarto</a>
        </div>
      </footer>
    </>
  )
}
