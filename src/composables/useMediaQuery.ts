import { onBeforeUnmount, readonly, ref } from 'vue'
import type { Ref } from 'vue'

/**
 * Реактивный медиазапрос (фича 004).
 *
 * ЗАЧЕМ ЭТО В КОДЕ, А НЕ ТОЛЬКО В СТИЛЯХ: раскладку нужно знать при рендере,
 * а не только при отрисовке. Спрятать лишний вариант навигации через
 * `hidden lg:block` было бы проще, но тогда в DOM оказались бы ДВА комплекта
 * кнопок для одних и тех же секций: поиск по странице находил бы каждую секцию
 * дважды, табуляция шла бы по невидимым кнопкам, скринридер читал бы
 * оглавление дважды, а селекторы по `data-section-chip` — на них держится и
 * подсветка активной секции, и тесты — перестали бы быть однозначными
 * (research.md § R2).
 *
 * ДЕГРАДАЦИЯ: без `matchMedia` (SSR, happy-dom, древний webview) значение
 * остаётся `false`. Для потребителей это означает мобильную раскладку —
 * осознанно выбранный безопасный дефолт: лента чипов работает на экране любой
 * ширины, а оглавление на узком отняло бы половину места у текста
 * (research.md § R3).
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false)

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return readonly(matches)
  }

  const list = window.matchMedia(query)
  matches.value = list.matches

  const update = (event: MediaQueryListEvent): void => {
    matches.value = event.matches
  }

  /* Safari до 14 не знает addEventListener на MediaQueryList — там только
     устаревший addListener. Проверка дешевле, чем неработающая раскладка
     на чьём-нибудь старом ноутбуке. */
  if (typeof list.addEventListener === 'function') {
    list.addEventListener('change', update)
    onBeforeUnmount(() => list.removeEventListener('change', update))
  } else {
    list.addListener(update)
    onBeforeUnmount(() => list.removeListener(update))
  }

  return readonly(matches)
}

/**
 * Порог десктопной раскладки — 1024 px, в ОДНОМ месте.
 *
 * Его знают трое: навигация (лента или оглавление), экран протокола (одна
 * колонка или две) и каркас приложения (ширина контейнера). Три независимых
 * литерала разъехались бы при первой же правке порога, и раскладка развалилась
 * бы наполовину — самый неприятный вид поломки, потому что каждая часть по
 * отдельности выглядит рабочей.
 *
 * Почему именно 1024: оглавление осмысленно, только если после него остаётся
 * место на читаемую колонку текста. Сайдбар ~15rem + колонка ~42rem + поля —
 * это около 1000px. На планшете (768px) сайдбар отнял бы ширину у текста,
 * ничего не дав взамен (research.md § R1).
 */
const WIDE_SCREEN_QUERY = '(min-width: 64rem)'

/** Широкий экран: показываем оглавление сбоку вместо ленты чипов. */
export function useWideScreen(): Readonly<Ref<boolean>> {
  return useMediaQuery(WIDE_SCREEN_QUERY)
}
