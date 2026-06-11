import type { ServiceRule } from '@codecarto/shared'

/**
 * 內建 service 偵測規則表。
 * match 格式:`import:<specifier>`,specifier 結尾為 `*` 表示前綴比對,
 * 否則比對完整 specifier 或其子路徑(`stripe` 也匹配 `stripe/webhooks`)。
 * 社群擴充入口:使用者可在 codecarto.config.ts 的 services 疊加自訂規則。
 */
export const BUILTIN_SERVICE_RULES: ServiceRule[] = [
  { match: 'import:@prisma/client', label: 'Database (Prisma)', icon: 'database' },
  { match: 'import:drizzle-orm', label: 'Database (Drizzle)', icon: 'database' },
  { match: 'import:mongoose', label: 'Database (MongoDB)', icon: 'database' },
  { match: 'import:@supabase/supabase-js', label: 'Supabase', icon: 'database' },
  { match: 'import:stripe', label: 'Payments (Stripe)', icon: 'credit-card' },
  { match: 'import:resend', label: 'Email (Resend)', icon: 'mail' },
  { match: 'import:nodemailer', label: 'Email (SMTP)', icon: 'mail' },
  { match: 'import:@aws-sdk/*', label: 'AWS', icon: 'cloud' },
  { match: 'import:@upstash/redis', label: 'Redis (Upstash)', icon: 'database' },
  { match: 'import:ioredis', label: 'Redis', icon: 'database' },
  { match: 'import:firebase-admin', label: 'Firebase', icon: 'cloud' },
  { match: 'import:openai', label: 'AI (OpenAI)', icon: 'sparkles' },
  { match: 'import:@anthropic-ai/sdk', label: 'AI (Claude)', icon: 'sparkles' },
]

export function matchServiceRule(specifier: string, rules: ServiceRule[]): ServiceRule | undefined {
  for (const rule of rules) {
    if (!rule.match.startsWith('import:')) continue
    const pattern = rule.match.slice('import:'.length)
    if (pattern.endsWith('*')) {
      if (specifier.startsWith(pattern.slice(0, -1))) return rule
    } else if (specifier === pattern || specifier.startsWith(pattern + '/')) {
      return rule
    }
  }
  return undefined
}

export function serviceNodeId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `service:${slug}`
}
