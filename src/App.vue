<script setup lang="ts">
/**
 * Каркас приложения: mobile-first тёмный layout (целевой viewport ~380px).
 *
 * Фича 004: на экранах от 1024px контейнер расширяется до 57rem — ровно под
 * сетку экрана протокола (оглавление 15rem + промежуток 2rem + колонка текста
 * 40rem). Шире не делаем: свободная ширина монитора уходит в поля, а не в длину
 * строки. Порог здесь — единственное место, где он записан классом Tailwind,
 * а не берётся из composables/useMediaQuery.ts; значение обязано совпадать.
 *
 * Медицинского контента здесь нет и не будет — весь протокольный текст
 * приходит из src/data/protocols/*.json (конституция III). Единственная проза
 * в этом файле — дисклеймер, и та импортирована константой из
 * `constants/disclaimer.ts`, а не написана здесь (см. футер).
 *
 * Над шапкой смонтирован UpdateBanner (T036): явное обновление service worker
 * по нажатию, без молчаливой подмены версии (конституция IV).
 */
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import DisclaimerGate from '@/components/DisclaimerGate.vue'
import UpdateBanner from '@/components/UpdateBanner.vue'
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
        Баннер обновления (T036, FR-015) — НАД шапкой и в обычном потоке.
        Он намеренно не участвует в измерениях закреплённой обвязки
        (useStickyChrome): шапка по-прежнему липнет к top: 0, а баннер просто
        раздвигает контент вниз и уезжает при прокрутке. Обоснование —
        в шапке самого компонента.
      -->
      <UpdateBanner />

      <header
        ref="headerEl"
        class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div class="mx-auto flex w-full max-w-screen-sm lg:max-w-[57rem] items-center gap-3 px-4 py-3">
          <RouterLink
            to="/"
            class="flex items-center text-base font-semibold tracking-tight text-fg"
          >
            Med Helper
          </RouterLink>
        </div>
      </header>

      <main class="mx-auto w-full max-w-screen-sm lg:max-w-[57rem] grow px-4 py-5">
        <RouterView />
      </main>

      <footer class="mx-auto w-full max-w-screen-sm lg:max-w-[57rem] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        <!-- Та же строка, что в гейте: один источник — constants/disclaimer.ts -->
        <p class="text-center text-xs text-fg-subtle" data-testid="footer-disclaimer">
          {{ DISCLAIMER_TEXT }}
        </p>
      </footer>
    </template>
  </div>
</template>
