import { hasLocale, useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

const GITHUB = 'https://github.com/seven-317/CodeCarto'
// 指向 index.html 讓 next dev 與 Vercel 靜態服務都能解析
const DEMO = '/demo/index.html'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return <Home />
}

function Home() {
  const t = useTranslations()
  const highlights = t.raw('home.highlights') as { k: string; v: string }[]

  return (
    <>
      <SiteHeader active="home" />

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
            <a href={DEMO}>{t('hero.ctaDemo')}</a>
            <Link href="/docs">{t('hero.ctaDocs')}</Link>
            <a href={GITHUB}>{t('hero.ctaGithub')}</a>
          </div>
        </div>

        <section className="wrap">
          <h2>
            <span className="idx">01</span>
            {t('home.layersTitle')}
          </h2>
          <div className="layers">
            {(['scan', 'curate', 'present'] as const).map((key, i) => (
              <div className="layer" key={key}>
                <span className="no">{i + 1} ──</span>
                <h3>{t(`home.layers.${key}.title`)}</h3>
                <p>{t(`home.layers.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap">
          <h2>
            <span className="idx">02</span>
            {t('home.highlightsTitle')}
          </h2>
          <div className="cards">
            {highlights.map((h) => (
              <div className="card" key={h.k}>
                <div className="card-k">{h.k}</div>
                <div className="card-v">{h.v}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap demo">
          <div className="demo-head">
            <span className="label">{t('home.demoLabel')}</span>
            <a href={DEMO} className="demo-open">
              {t('home.demoOpen')}
            </a>
          </div>
          <iframe src={DEMO} title="codecarto live demo" loading="lazy" />
        </section>

        <section className="wrap">
          <div className="cta">
            <h2 className="cta-title">{t('home.ctaTitle')}</h2>
            <p className="cta-body">{t('home.ctaBody')}</p>
            <div className="cmd">
              <span className="dollar">$</span>npx codecarto
            </div>
            <div className="links">
              <Link href="/docs">{t('home.ctaDocs')}</Link>
              <a href={GITHUB}>{t('home.ctaGithub')}</a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
