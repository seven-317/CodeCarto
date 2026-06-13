import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// 部署到 Vercel(非靜態輸出);demo SPA 由 public/demo 提供
const config: NextConfig = {}

export default withNextIntl(config)
