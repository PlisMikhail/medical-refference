<script setup lang="ts">
/**
 * Каркас приложения: mobile-first тёмный layout (целевой viewport ~380px).
 *
 * Медицинского контента здесь нет и не будет — весь протокольный текст
 * приходит из src/data/protocols/*.json (конституция III). Единственная проза
 * в этом файле — дисклеймер, и та импортирована константой из
 * `constants/disclaimer.ts`, а не написана здесь (см. футер).
 *
 * Точки подключения будущих фаз помечены комментариями ниже:
 *   - Phase 7 (T036) UpdateBanner — явное обновление SW (конституция IV).
 */
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import DisclaimerGate from '@/components/DisclaimerGate.vue'
import { useDisclaimer } from '@/composables/useDisclaimer'
import { useChromeHeight } from '@/composables/useStickyChrome'
import { DISCLAIMER_TEXT } from '@/constants/disclaimer'

/**
 * Шапка закреплена (sticky top-0 z-10), а лента секций протокола должна
 * прилипать РОВНО под ней. Вместо константы в двух местах публикуем реально
 * измеренную высоту шапки в CSS-переменную `--app-header-height`: изменится
 * вёрстка шапки — смещение ленты и якорей поедет за ней само.
 */
const headerEl = ref<HTMLElement | null>(null)
useChromeHeight(headerEl, 'header')

/**
 * Дисклеймер первого запуска (T028/T029, FR-009).
 *
 * Пока подтверждения нет, каркас приложения НЕ РЕНДЕРИТСЯ вовсе: ни шапки, ни
 * `<router-view>`, ни футера. Одного оверлея сверху было бы мало — контент
 * протокола оставался бы в DOM (доступен ассистивным технологиям, поиску по
 * странице и табуляции). Здесь же «до любого контента» выполняется буквально:
 * содержимого нет, показывать поверх нечего.
 */
const { accepted, accept } = useDisclaimer()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-background text-fg">
    <DisclaimerGate v-if="!accepted" @accept="accept" />

    <template v-else>
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
        <!-- Та же строка, что в гейте: один источник — constants/disclaimer.ts -->
        <p class="text-center text-xs text-fg-subtle" data-testid="footer-disclaimer">
          {{ DISCLAIMER_TEXT }}
        </p>
      </footer>
    </template>
  </div>
</template>
