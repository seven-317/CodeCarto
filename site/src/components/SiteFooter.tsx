import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

const GITHUB = 'https://github.com/seven-317/CodeCarto'

export function SiteFooter() {
  const t = useTranslations()
  return (
    <footer>
      <div className="wrap site-footer">
        <span>{t('footer.license')}</span>
        <nav className="footer-links">
          <Link href="/features">{t('nav.features')}</Link>
          <Link href="/docs">{t('nav.docs')}</Link>
          <a href="/demo/index.html">{t('nav.demo')}</a>
          <a href={GITHUB}>GitHub</a>
        </nav>
      </div>
    </footer>
  )
}
