import { z } from 'zod'

export const serviceRuleSchema = z.object({
  /** 偵測規則,目前支援 `import:<module-specifier-prefix>` */
  match: z.string(),
  label: z.string(),
  icon: z.string().optional(),
})
export type ServiceRule = z.infer<typeof serviceRuleSchema>

export const codecartoConfigSchema = z.object({
  root: z.string().optional(),
  tsconfig: z.string().optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  /** 自訂 service 偵測,疊加在內建規則表之上 */
  services: z.array(serviceRuleSchema).optional(),
})
export type CodecartoConfig = z.infer<typeof codecartoConfigSchema>

export function defineConfig(config: CodecartoConfig): CodecartoConfig {
  return config
}
