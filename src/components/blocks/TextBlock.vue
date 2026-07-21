<script setup lang="ts">
/**
 * Блок свободного текста (T013).
 *
 * Абзацы приходят одной строкой и разделяются `\n\n` (data-model, тип
 * `TextBlock`). Компонент только разбивает и рендерит — никакого
 * медицинского текста здесь нет и быть не может (конституция III).
 *
 * T032: разбиение на абзацы взято из `splitParagraphs` — той же функции,
 * которой пользуется сборщик поискового индекса. Общая функция здесь не
 * украшение: смещение совпадения считается ВНУТРИ абзаца, и разойдись эти
 * два разбиения — подсветка резала бы текст мимо границ совпадения.
 */
import { computed } from 'vue'

import HighlightedText from '@/components/HighlightedText.vue'
import { splitParagraphs } from '@/composables/useProtocolSearch'
import type { TextBlock } from '@/types/protocol'

const props = withDefaults(
  defineProps<{
    block: TextBlock
    /** Адрес блока — из него складываются ключи полей для подсветки. */
    sectionId?: string
    blockIndex?: number
  }>(),
  { sectionId: 'section', blockIndex: 0 },
)

const paragraphs = computed(() => splitParagraphs(props.block.body))
</script>

<template>
  <div class="flex flex-col gap-3" data-block="text">
    <p
      v-for="(paragraph, index) in paragraphs"
      :key="index"
      class="text-[15px] leading-relaxed text-fg whitespace-pre-line"
    >
      <HighlightedText
        :text="paragraph"
        :section-id="sectionId"
        :block-index="blockIndex"
        :field="`body.${index}`"
      />
    </p>
  </div>
</template>
