import fs from 'node:fs'
import path from 'node:path'
import { createJiti } from 'jiti'
import { codecartoConfigSchema, type CodecartoConfig } from '@codecarto/shared'

const CONFIG_FILES = [
  'codecarto.config.ts',
  'codecarto.config.mts',
  'codecarto.config.js',
  'codecarto.config.mjs',
]

/** 載入 codecarto.config.ts(完全可選,零設定也能跑) */
export async function loadConfig(root: string): Promise<CodecartoConfig> {
  for (const name of CONFIG_FILES) {
    const file = path.resolve(root, name)
    if (!fs.existsSync(file)) continue
    const jiti = createJiti(import.meta.url)
    const mod = await jiti.import<unknown>(file, { default: true })
    return codecartoConfigSchema.parse(mod ?? {})
  }
  return {}
}
