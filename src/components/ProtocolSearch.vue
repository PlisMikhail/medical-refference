<script setup lang="ts">
/**
 * Панель поиска по открытому протоколу (T031, FR-008).
 *
 * ПОЧЕМУ ЗАКРЕПЛЕНА: переходы «дальше/назад» нужны ровно тогда, когда экран
 * уже уехал к очередному совпадению. Уплывшая наверх панель означала бы, что
 * кнопка «дальше» недоступна именно в тот момент, ради которого она есть.
 * Панель — первый этаж обвязки (под шапкой), лента секций — второй; обе
 * высоты измеряются, ни одного зашитого смещения нет
 * (composables/useStickyChrome.ts).
 *
 * КОНСТИТУЦИЯ I: панель не интерпретирует найденное — она считает совпадения
 * и переводит взгляд, не более того. Счётчик «N / M» — арифметика по списку,
 * а не вывод о содержимом.
 *
 * КОНСТИТУЦИЯ VI: запрос никуда не сохраняется — ни в storage, ни в адрес.
 * Уходит экран — уходит строка.
 */
import { nextTick, ref, watch } from 'vue'

import { useProtocolSearch } from '@/composables/useProtocolSearch'
import { useChromeHeight } from '@/composables/useStickyChrome'

const { query, total, activeNumber, activeOrdinal, hasQuery, notFound, next, prev, reset } =
  useProtocolSearch()

const panelEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

// Публикуем собственную высоту: из неё складываются и точка прилипания ленты
// секций, и якорный отступ секций и совпадений.
useChromeHeight(panelEl, 'search')

/**
 * Прокрутка к активному совпадению.
 *
 * Цель ищется по DOM-отметке `data-search-active`, которую ставит
 * HighlightedText: панель не обязана знать, в каком блоке оказалось
 * совпадение, а подсветка не обязана знать про прокрутку. Отступ под обвязку
 * даёт `scroll-under-chrome` на самом элементе — арифметики со смещениями
 * здесь нет.
 */
watch([activeOrdinal, query], async () => {
  await nextTick()
  if (activeOrdinal.value < 0) return

  const target = document.querySelector('[data-search-active="true"]')
  // happy-dom и старые webview могут не знать scrollIntoView — подсветка
  // всё равно на месте, падать нельзя.
  target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
})

/** Очистка возвращает панель в исходное состояние и фокус в поле. */
function clear(): void {
  reset()
  inputEl.value?.focus()
}
</script>

<template>
  <div
    ref="panelEl"
    class="sticky-under-header z-6 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    data-testid="protocol-search"
    role="search"
  >
    <div class="flex items-center gap-2">
      <div class="relative flex grow items-center">
        <input
          ref="inputEl"
          v-model="query"
          type="search"
          enterkeyhint="next"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          class="touch-target w-full rounded-lg border border-border bg-surface-sunken py-2 pr-11 pl-3 text-sm text-fg placeholder:text-fg-subtle"
          placeholder="Поиск по протоколу"
          aria-label="Поиск по протоколу"
          data-testid="search-input"
          @keydown.enter.prevent="next()"
        />
        <button
          v-if="hasQuery"
          type="button"
          class="touch-target absolute right-0 flex items-center justify-center rounded-lg text-lg text-fg-muted"
          aria-label="Очистить поиск"
          data-testid="search-clear"
          @click="clear()"
        >
          ✕
        </button>
      </div>

      <p
        class="min-w-14 shrink-0 text-center text-xs tabular-nums text-fg-muted"
        data-testid="search-counter"
        role="status"
        :aria-label="`Совпадение ${activeNumber} из ${total}`"
      >
        {{ activeNumber }} / {{ total }}
      </p>

      <button
        type="button"
        class="touch-target flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised px-3 text-fg disabled:text-fg-subtle disabled:opacity-50"
        :disabled="total === 0"
        aria-label="Предыдущее совпадение"
        data-testid="search-prev"
        @click="prev()"
      >
        ↑
      </button>
      <button
        type="button"
        class="touch-target flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised px-3 text-fg disabled:text-fg-subtle disabled:opacity-50"
        :disabled="total === 0"
        aria-label="Следующее совпадение"
        data-testid="search-next"
        @click="next()"
      >
        ↓
      </button>
    </div>

    <!-- Явное состояние вместо пустоты (FR-008, сценарий 3 US3) -->
    <p
      v-if="notFound"
      class="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-fg-muted"
      data-testid="search-empty"
      role="status"
    >
      Ничего не найдено
    </p>
  </div>
</template>
