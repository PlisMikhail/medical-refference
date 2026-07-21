<script setup lang="ts">
/**
 * Статическая плашка временного окна (T013).
 *
 * ЭТО ЗАМЕТКА, А НЕ ТАЙМЕР: ни отсчёта, ни setInterval, ни вычислений над
 * временем здесь нет и не будет — решение спеки (assumptions) и
 * конституция I («справочник, а не советчик»).
 *
 * `label` опционален (тип `TimerNoteBlock`); при отсутствии плашка
 * рендерится без подписи.
 */
import HighlightedText from '@/components/HighlightedText.vue'
import type { TimerNoteBlock } from '@/types/protocol'

withDefaults(
  defineProps<{
    block: TimerNoteBlock
    /** Адрес блока — из него складываются ключи полей для подсветки (T032). */
    sectionId?: string
    blockIndex?: number
  }>(),
  { sectionId: 'section', blockIndex: 0 },
)
</script>

<template>
  <div
    class="rounded-lg border border-timer-note/60 border-l-4 border-l-timer-note bg-timer-note/10 px-3 py-3"
    data-block="timer-note"
    role="note"
  >
    <p
      v-if="block.label"
      class="mb-1 text-xs font-semibold uppercase tracking-wide text-timer-note"
      data-testid="timer-note-label"
    >
      <HighlightedText
        :text="block.label ?? ''"
        :section-id="sectionId"
        :block-index="blockIndex"
        field="label"
      />
    </p>
    <p class="text-[15px] leading-relaxed text-fg whitespace-pre-line">
      <HighlightedText
        :text="block.body"
        :section-id="sectionId"
        :block-index="blockIndex"
        field="body"
      />
    </p>
  </div>
</template>
