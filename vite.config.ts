import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// base приходит из окружения: локально и в Capacitor — '/',
// в GitHub Actions — '/medical-refference/'. Никакой логики,
// завязанной на URL хостинга, в коде нет (research R4).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.spec.ts'],
  },
})
