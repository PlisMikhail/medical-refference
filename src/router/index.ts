import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * Hash-роутинг (research R1): GitHub Pages не умеет SPA-fallback без костыля
 * с 404.html, а будущий Capacitor WebView с file:// протоколом — тем более.
 * `import.meta.env.BASE_URL` приходит из `base` в vite.config.ts (BASE_PATH).
 */
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      // Lazy: экраны попадают в отдельные чанки, стартовый бандл минимален.
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/protocol/:id',
      name: 'protocol',
      component: () => import('@/views/ProtocolView.vue'),
      props: true,
    },
    {
      // Неизвестный маршрут (устаревший deep-link) — на главный экран,
      // а не в белый экран.
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

export default router
