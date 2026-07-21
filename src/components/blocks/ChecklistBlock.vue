<script setup lang="ts">
/**
 * Чек-лист с эфемерными отметками (T016).
 *
 * КОНСТИТУЦИЯ I: компонент НЕ считает и НЕ показывает ничего производного от
 * отметок — ни «отмечено N из M», ни процентов, ни сумм, ни вердиктов.
 * Отметка — это визуальная закладка врача, а не вход в алгоритм.
 *
 * FR-007: состояние живёт в useChecklistState и умирает вместе с экраном
 * протокола — здесь нет ни одного обращения к storage.
 */
import type { ChecklistBlock } from '@/types/protocol'
import { checklistBlockKey, useChecklistState } from '@/composables/useChecklistState'

const props = withDefaults(
  defineProps<{
    block: ChecklistBlock
    /** Секция-владелец и позиция блока — вместе дают ключ состояния. */
    sectionId?: string
    blockIndex?: number
  }>(),
  { sectionId: 'section', blockIndex: 0 },
)

const state = useChecklistState()
const blockKey = () => checklistBlockKey(props.sectionId, props.blockIndex)
</script>

<template>
  <ul class="flex flex-col gap-1" data-block="checklist">
    <li v-for="(item, index) in block.items" :key="index">
      <label
        class="touch-target flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
        :class="state.isMarked(blockKey(), index) ? 'border-accent/70 bg-surface-raised' : ''"
        :data-marked="state.isMarked(blockKey(), index) ? 'true' : 'false'"
      >
        <input
          type="checkbox"
          class="size-6 shrink-0 accent-accent"
          :checked="state.isMarked(blockKey(), index)"
          @change="state.toggle(blockKey(), index)"
        />
        <span
          class="text-[15px] leading-snug"
          :class="state.isMarked(blockKey(), index) ? 'text-fg' : 'text-fg-muted'"
        >
          {{ item }}
        </span>
      </label>
    </li>
  </ul>
</template>
