import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli.ts', index: 'src/index.ts' },
  format: 'esm',
  dts: { entry: { index: 'src/index.ts' } },
  sourcemap: true,
  clean: true,
  // 內部 workspace 套件 bundle 進發佈檔;對外依賴維持 external
  noExternal: [/^@codecarto\//],
})
