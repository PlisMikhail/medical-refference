<script setup lang="ts">
/**
 * Лента секций протокола (T025) — закреплённая горизонтально прокручиваемая
 * полоса чипов. Прилипает под шапкой и панелью поиска: точка прилипания
 * считается из ИЗМЕРЕННЫХ высот обоих (`sticky-under-search`), а не из
 * подобранной константы — см. composables/useStickyChrome.ts.
 *
 * ПОЧЕМУ ТАБЫ, А НЕ ОГЛАВЛЕНИЕ (research R10): секция достижима в ОДИН тап из
 * любой точки прокрутки, без промежуточного открытия шторки. Сценарий —
 * приёмное отделение, цейтнот: лишний тап здесь стоит секунд.
 *
 * ЦВЕТ ЧИПА = токен типа секции. Различение только цветом — осознанное решение
 * владельца для единственного известного пользователя (spec, Assumptions):
 * иконок и текстовых бейджей «для доступности» здесь намеренно нет.
 *
 * ЯКОРЬ — ТОЛЬКО ПРОГРАММНЫЙ. Роутер работает в hash-режиме
 * (`#/protocol/demo-protocol`), хеш уже занят маршрутом: `href="#section-id"`
 * снёс бы адрес маршрута и увёл приложение на редирект. Поэтому чип — <button>,
 * а переход делает `scrollIntoView`; адрес не меняется вовсе.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { chromeHeight, useChromeHeight } from '@/composables/useStickyChrome'
import type { Section, SectionKind } from '@/types/protocol'

const props = defineProps<{ sections: Section[] }>()

/**
 * kind → классы чипа. Только строковые литералы: Tailwind v4 собирает лишь те
 * классы, которые видит в исходнике (тот же приём, что в CriteriaListBlock).
 * `default` остаётся нейтральным — цветом маркируются только значимые типы.
 */
const KIND_CHIP_STYLES = {
  default: 'border-border bg-surface-raised text-fg-muted',
  inclusion: 'border-inclusion/60 bg-inclusion/15 text-inclusion',
  'exclusion-absolute':
    'border-exclusion-absolute/60 bg-exclusion-absolute/15 text-exclusion-absolute',
  'exclusion-relative':
    'border-exclusion-relative/60 bg-exclusion-relative/15 text-exclusion-relative',
} as const satisfies Record<SectionKind, string>

/**
 * Активность — ДОПОЛНИТЕЛЬНЫЙ слой поверх цвета типа, а не замена: `ring-current`
 * берёт цвет из `text-*` самого чипа, поэтому подсветка активной секции нигде
 * не перебивает цветовую маркировку типа.
 */
const ACTIVE_CHIP_STYLE = 'font-semibold ring-2 ring-current'

/** Тип секции из данных может оказаться незнакомым — красим нейтрально. */
function chipStyle(section: Section): string {
  const kind = section.kind ?? 'default'
  return Object.hasOwn(KIND_CHIP_STYLES, kind) ? KIND_CHIP_STYLES[kind] : KIND_CHIP_STYLES.default
}

const navEl = ref<HTMLElement | null>(null)
const stripEl = ref<HTMLElement | null>(null)
const activeId = ref('')

// Публикуем собственную высоту: из неё складывается scroll-margin-top секций.
useChromeHeight(navEl, 'section-nav')

/* ------------------------------------------------------------------ */
/* Активная секция                                                     */
/* ------------------------------------------------------------------ */

/** Секции, пересекающие «читаемую» зону вьюпорта. Порядок здесь не важен. */
const intersecting = new Set<string>()
let observer: IntersectionObserver | null = null

function sectionElements(): HTMLElement[] {
  return props.sections
    .map((section) => document.getElementById(section.id))
    .filter((element): element is HTMLElement => element !== null)
}

/**
 * Низ документа. Последняя секция часто короче экрана и никогда не станет
 * «самой верхней видимой» — без этой проверки её чип не подсветится вообще.
 * Порог в 2px — запас на дробные значения devicePixelRatio.
 */
function atDocumentBottom(): boolean {
  const doc = document.documentElement
  if (doc.scrollHeight <= window.innerHeight) return false
  return window.scrollY + window.innerHeight >= doc.scrollHeight - 2
}

/**
 * Одновременно видимых секций может быть несколько — активной считаем самую
 * верхнюю по порядку документа (та, что врач читает сейчас). Если не видно ни
 * одной, прежняя остаётся активной: мигающая лента хуже слегка устаревшей.
 */
function pickActive(): void {
  if (atDocumentBottom()) {
    const last = props.sections.at(-1)
    if (last) activeId.value = last.id
    return
  }

  const topmost = props.sections.find((section) => intersecting.has(section.id))
  if (topmost) activeId.value = topmost.id
}

function disconnectObserver(): void {
  observer?.disconnect()
  observer = null
  intersecting.clear()
}

function connectObserver(): void {
  disconnectObserver()
  // happy-dom и старые webview не знают IntersectionObserver: подсветка просто
  // не работает, лента остаётся кликабельной. Падать здесь нельзя.
  if (typeof IntersectionObserver === 'undefined') return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) intersecting.add(entry.target.id)
        else intersecting.delete(entry.target.id)
      }
      pickActive()
    },
    {
      // Сверху отрезаем ровно измеренную обвязку — секция, спрятанная под
      // шапкой и лентой, не считается видимой. Снизу отрезаем 40%: активна та
      // секция, что в верхней части экрана, а не та, что едва показалась.
      rootMargin: `-${chromeHeight.value}px 0px -40% 0px`,
      threshold: 0,
    },
  )

  for (const element of sectionElements()) observer.observe(element)
}

/** Секции живут в соседнем компоненте — ждём, пока их DOM появится. */
async function refreshObserver(): Promise<void> {
  await nextTick()
  connectObserver()
  pickActive()
}

/* ------------------------------------------------------------------ */
/* Переход по тапу                                                     */
/* ------------------------------------------------------------------ */

/** Подтягивает чип в видимую часть ленты (по центру, если хватает места). */
function revealChip(id: string): void {
  const strip = stripEl.value
  const chip = strip?.querySelector<HTMLElement>(`[data-section-chip="${id}"]`)
  if (!strip || !chip) return

  const centered = chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2
  const left = Math.max(0, Math.min(centered, strip.scrollWidth - strip.clientWidth))

  if (typeof strip.scrollTo === 'function') strip.scrollTo({ left, behavior: 'smooth' })
  else strip.scrollLeft = left
}

/**
 * Тап по чипу: плавный скролл к секции. Отступ под обвязку берёт на себя
 * `scroll-under-chrome` (scroll-margin-top секции), поэтому здесь достаточно
 * `block: 'start'` — никакой ручной арифметики со смещениями.
 */
function goToSection(section: Section): void {
  activeId.value = section.id
  revealChip(section.id)
  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ------------------------------------------------------------------ */
/* Жизненный цикл                                                      */
/* ------------------------------------------------------------------ */

onMounted(() => {
  void refreshObserver()
  window.addEventListener('scroll', pickActive, { passive: true })
})

// Другой протокол или изменившаяся высота обвязки — пересобираем наблюдатель:
// rootMargin у IntersectionObserver задаётся один раз при создании.
watch(
  () => [props.sections, chromeHeight.value] as const,
  () => void refreshObserver(),
)

// Скролл увёл активную секцию — её чип не должен остаться за краем ленты.
watch(activeId, (id) => revealChip(id))

onBeforeUnmount(() => {
  disconnectObserver()
  window.removeEventListener('scroll', pickActive)
})
</script>

<template>
  <nav
    ref="navEl"
    aria-label="Секции протокола"
    class="sticky-under-search z-5 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    data-testid="section-nav"
  >
    <div
      ref="stripEl"
      class="relative flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
    >
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        class="touch-target flex shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap"
        :class="[chipStyle(section), activeId === section.id ? ACTIVE_CHIP_STYLE : '']"
        :data-section-chip="section.id"
        :data-chip-kind="section.kind ?? 'default'"
        :aria-current="activeId === section.id ? 'true' : undefined"
        @click="goToSection(section)"
      >
        {{ section.title }}
      </button>
    </div>
  </nav>
</template>
