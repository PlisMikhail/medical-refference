import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

/**
 * Измерение высоты закреплённой «обвязки» экрана (T025/T026).
 *
 * ЗАЧЕМ: sticky-лента секций стоит ПОД шапкой приложения, а якорь секции не
 * должен уезжать под них обе. И то и другое — смещения в пикселях, которые
 * нельзя писать константой: поменяется шрифт/паддинг шапки — и «магическое
 * число» тихо разъедется.
 *
 * КАК: каждый элемент обвязки регистрирует себя здесь, его фактическая высота
 * измеряется (ResizeObserver) и публикуется в CSS-переменную на <html>:
 *   --app-header-height       ← <header> из App.vue
 *   --protocol-search-height  ← панель поиска из ProtocolSearch.vue
 *   --section-nav-height      ← лента секций из ProtocolSectionNav.vue
 * Порядок слотов = порядок в DOM: панель поиска липнет под шапкой, лента
 * секций — под шапкой и панелью. Дальше CSS считает смещения сам (утилиты
 * `sticky-under-header`, `sticky-under-search` и `scroll-under-chrome` в
 * assets/theme.css), а JS-потребителям доступна суммарная высота
 * `chromeHeight` (нужна для rootMargin IntersectionObserver).
 *
 * Деградация: без ResizeObserver — разовое измерение + пересчёт по resize
 * окна; без DOM (SSR/тест) высота остаётся 0, а CSS берёт fallback 0px.
 * Ничего не ломается, просто исчезает компенсация — это безопасный дефолт.
 */

/** Слот обвязки: у каждого своя CSS-переменная и своя измеренная высота. */
export type ChromeSlot = 'header' | 'search' | 'section-nav'

const CSS_VAR: Record<ChromeSlot, string> = {
  header: '--app-header-height',
  search: '--protocol-search-height',
  'section-nav': '--section-nav-height',
}

const measured: Record<ChromeSlot, Ref<number>> = {
  header: ref(0),
  search: ref(0),
  'section-nav': ref(0),
}

/**
 * Суммарная высота закреплённой обвязки в пикселях: шапка + панель поиска +
 * лента секций. Ровно на столько верх вьюпорта «занят» и не годится для
 * чтения.
 */
export const chromeHeight: ComputedRef<number> = computed(
  () => measured.header.value + measured.search.value + measured['section-nav'].value,
)

/**
 * Привязывает элемент к слоту обвязки: следит за его высотой, пока компонент
 * жив, и снимает измерение при размонтировании (экран протокола ушёл — ленты
 * больше нет, компенсация в 0).
 */
export function useChromeHeight(element: Ref<HTMLElement | null>, slot: ChromeSlot): void {
  const height = measured[slot]
  let resizeObserver: ResizeObserver | null = null

  function publish(value: number): void {
    height.value = value
    document.documentElement.style.setProperty(CSS_VAR[slot], `${value}px`)
  }

  function measure(): void {
    const node = element.value
    publish(node ? Math.round(node.getBoundingClientRect().height) : 0)
  }

  function observe(node: HTMLElement | null): void {
    resizeObserver?.disconnect()
    resizeObserver = null
    measure()
    if (!node || typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(node)
  }

  onMounted(() => {
    observe(element.value)
    window.addEventListener('resize', measure, { passive: true })
  })

  // Элемент может появиться/исчезнуть позже (v-if вокруг ленты секций).
  watch(element, (node) => observe(node))

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    window.removeEventListener('resize', measure)
    height.value = 0
    document.documentElement.style.removeProperty(CSS_VAR[slot])
  })
}
