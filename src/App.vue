<script setup lang="ts">
/**
 * Каркас приложения: mobile-first тёмный layout (целевой viewport ~380px).
 *
 * Медицинского контента здесь нет и не будет — весь протокольный текст
 * приходит из src/data/protocols/*.json (конституция III).
 *
 * Точки подключения будущих фаз помечены комментариями ниже:
 *   - Phase 5 (T029) DisclaimerGate — оверлей до любого контента (FR-009);
 *   - Phase 7 (T036) UpdateBanner — явное обновление SW (конституция IV).
 */
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import { useChromeHeight } from '@/composables/useStickyChrome'

/**
 * Шапка закреплена (sticky top-0 z-10), а лента секций протокола должна
 * прилипать РОВНО под ней. Вместо константы в двух местах публикуем реально
 * измеренную высоту шапки в CSS-переменную `--app-header-height`: изменится
 * вёрстка шапки — смещение ленты и якорей поедет за ней само.
 */
const headerEl = ref<HTMLElement | null>(null)
useChromeHeight(headerEl, 'header')
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-background text-fg">
    <!--
      Phase 5 (T029): <DisclaimerGate /> монтируется ЗДЕСЬ — до шапки и
      <router-view>, полноэкранным оверлеем с явным подтверждением.
    -->

    <!--
      Phase 7 (T036): <UpdateBanner /> монтируется ЗДЕСЬ — над шапкой,
      баннер «Доступно обновление» + кнопка применения.
    -->

    <header
      ref="headerEl"
      class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div class="mx-auto flex w-full max-w-screen-sm items-center gap-3 px-4 py-3">
        <RouterLink
          to="/"
          class="flex items-center text-base font-semibold tracking-tight text-fg"
        >
          Med Helper
        </RouterLink>
      </div>
    </header>

    <main class="mx-auto w-full max-w-screen-sm grow px-4 py-5">
      <RouterView />
    </main>

    <footer class="mx-auto w-full max-w-screen-sm px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
      <p class="text-center text-xs text-fg-subtle">
        Справочный материал. Не заменяет официальный протокол и клиническое суждение врача.
      </p>
    </footer>
  </div>
</template>
