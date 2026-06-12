import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    // 開發時把 API 轉給跑著的 codecarto server
    proxy: {
      '/api': 'http://127.0.0.1:4870',
      '/ws': { target: 'ws://127.0.0.1:4870', ws: true },
    },
  },
})
