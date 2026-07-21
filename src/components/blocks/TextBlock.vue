<script setup lang="ts">
/**
 * Блок свободного текста (T013).
 *
 * Абзацы приходят одной строкой и разделяются `\n\n` (data-model, тип
 * `TextBlock`). Компонент только разбивает и рендерит — никакого
 * медицинского текста здесь нет и быть не может (конституция III).
 */
import { computed } from 'vue'

import type { TextBlock } from '@/types/protocol'

const props = defineProps<{ block: TextBlock }>()

/**
 * Разбиение на абзацы: пустая строка (с любыми пробелами и CRLF) —
 * разделитель. Пустые куски отбрасываются, чтобы лишние переводы строк
 * в данных не давали пустых <p>.
 */
const paragraphs = computed(() =>
  props.block.body
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0),
)
</script>

<template>
  <div class="flex flex-col gap-3" data-block="text">
    <p
      v-for="(paragraph, index) in paragraphs"
      :key="index"
      class="text-[15px] leading-relaxed text-fg whitespace-pre-line"
    >
      {{ paragraph }}
    </p>
  </div>
</template>
