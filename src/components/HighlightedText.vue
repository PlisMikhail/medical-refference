<script setup lang="ts">
/**
 * Текст блока с подсветкой совпадений поиска (T032).
 *
 * ПОЧЕМУ НЕ `v-html`: подсветка через склейку HTML-строки означала бы, что
 * содержимое протокола попадает в разметку. Протоколы пишутся руками, и
 * ошибка в JSON («<», кавычка, случайный тег) не должна иметь ни единого
 * шанса стать разметкой. Здесь текст режется на куски ПО СМЕЩЕНИЯМ и каждый
 * кусок выводится интерполяцией — Vue экранирует его сам, инъекция
 * невозможна в принципе, а не «предотвращена фильтром».
 *
 * БЕЗ ЗАПРОСА компонент выводит ровно один кусок — исходный текст: рендер
 * блоков не меняется, пока врач ничего не искал.
 *
 * АКТИВНОЕ совпадение отличается от остальных заливкой (сплошной акцент
 * против прозрачного) и несёт `data-search-active="true"` — по нему панель
 * поиска находит цель для прокрутки. Утилита `scroll-under-chrome` даёт
 * совпадению тот же якорный отступ, что и секциям: измеренная высота
 * обвязки, без единой константы.
 */
import { computed } from 'vue'

import { searchFieldKey, useProtocolSearch } from '@/composables/useProtocolSearch'

const props = withDefaults(
  defineProps<{
    /** Текст, как он выводится на экран. */
    text: string
    /** Адрес поля: секция, позиция блока, путь поля внутри блока. */
    sectionId?: string
    blockIndex?: number
    field?: string
  }>(),
  { sectionId: 'section', blockIndex: 0, field: 'body' },
)

const search = useProtocolSearch()
const activeOrdinal = search.activeOrdinal

/** Кусок текста: либо обычный (`ordinal: null`), либо совпадение с номером. */
interface TextPart {
  text: string
  ordinal: number | null
}

const parts = computed<TextPart[]>(() => {
  const matches = search.matchesIn(
    searchFieldKey(props.sectionId, props.blockIndex, props.field),
  )
  if (matches.length === 0) return [{ text: props.text, ordinal: null }]

  const chunks: TextPart[] = []
  let cursor = 0

  for (const match of matches) {
    if (match.start > cursor) {
      chunks.push({ text: props.text.slice(cursor, match.start), ordinal: null })
    }
    chunks.push({ text: props.text.slice(match.start, match.end), ordinal: match.ordinal })
    cursor = match.end
  }

  if (cursor < props.text.length) chunks.push({ text: props.text.slice(cursor), ordinal: null })
  return chunks
})
</script>

<template>
  <template v-for="(part, index) in parts" :key="index"
    ><mark
      v-if="part.ordinal !== null"
      class="scroll-under-chrome rounded-xs px-px"
      :class="
        part.ordinal === activeOrdinal
          ? 'bg-accent font-semibold text-fg-inverse'
          : 'bg-accent/25 text-fg'
      "
      :data-search-match="part.ordinal"
      :data-search-active="part.ordinal === activeOrdinal ? 'true' : 'false'"
      >{{ part.text }}</mark
    ><template v-else>{{ part.text }}</template></template
  >
</template>
