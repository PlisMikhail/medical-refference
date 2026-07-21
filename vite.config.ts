import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base приходит из окружения: локально и в Capacitor — '/', в CI — под-путь
// GitHub Pages, который задаёт BASE_PATH в workflow (единственное место, где
// этот путь вообще написан). Никакой логики, завязанной на URL хостинга,
// в коде нет (research R4).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    vue(),
    tailwindcss(),
    /**
     * PWA-слой (T035, конституция IV, FR-013/FR-015).
     *
     * `registerType: 'prompt'` — единственная допустимая стратегия: конституция
     * запрещает И молчаливую подмену версии (`autoUpdate`), И молчаливое
     * залипание на старом кэше. Новый service worker остаётся в waiting, а
     * `UpdateBanner.vue` показывает врачу, что версия протоколов изменилась, и
     * ждёт явного нажатия.
     *
     * `generateSW` (Workbox генерирует SW сам) — кастомной логики кэша нет,
     * `injectManifest` был бы лишним кодом (research R9).
     */
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      /**
       * `includeAssets` НЕ используется намеренно: содержимое public/ уже
       * лежит в dist и целиком подпадает под `globPatterns` ниже. Указание
       * тех же файлов ещё и здесь дало бы дубли в precache-манифесте.
       * По той же причине выключен `includeManifestIcons` — иконки уже
       * попадают в precache через маску `png`.
       */
      includeManifestIcons: false,
      workbox: {
        /**
         * Прекэш всего, из чего состоит приложение. JSON протоколов сюда НЕ
         * попадает отдельными файлами и не должен: он импортируется из кода и
         * запекается Rollup внутрь JS-чанка — то есть покрыт маской `js`.
         * Проверяется глазами в dist/sw.js (список precache-манифеста).
         */
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        /**
         * SPA на hash-роутинге: любой навигационный запрос отдаём из
         * прекэшированного index.html, чтобы офлайн работал и по прямой ссылке.
         */
        navigateFallback: 'index.html',
        // Сетевых запросов у приложения нет вовсе — runtimeCaching не нужен.
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Med Helper',
        short_name: 'Med Helper',
        description: 'Офлайн-справочник клинических протоколов',
        lang: 'ru',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        /**
         * Относительные start_url/scope, а не '/': под GitHub Pages приложение
         * живёт на под-пути, и абсолютный корень увёл бы standalone-окно на
         * чужую страницу. Относительные значения резолвятся от адреса самого
         * манифеста, поэтому одинаково верны и локально ('/'), и на под-пути
         * GitHub Pages, и в WebView Capacitor.
         */
        start_url: './',
        scope: './',
        // Совпадает с <meta name="theme-color"> и --color-background темы.
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      /**
       * В dev service worker не регистрируется: он кэшировал бы модули Vite и
       * ломал HMR. Виртуальный модуль `virtual:pwa-register/vue` при этом
       * резолвится всегда, поэтому UpdateBanner в dev просто ничего не
       * показывает. Проверять поведение баннера следует на `npm run preview`.
       */
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.spec.ts'],
    /**
     * В Vitest сборка не идёт через плагин PWA, и виртуальный модуль
     * `virtual:pwa-register/vue` резолвить некому. Подменяем его тестовым
     * двойником с тем же контрактом — так UpdateBanner тестируется как обычный
     * компонент, без поднятия service worker.
     */
    alias: {
      'virtual:pwa-register/vue': fileURLToPath(
        new URL('./tests/mocks/pwa-register-vue.ts', import.meta.url),
      ),
    },
  },
})
