<script setup lang="ts">
/**
 * Список пунктов с цветовой маркировкой по `kind` (T014).
 *
 * Цвет маркера берётся ИЗ ТОКЕНОВ темы через статическую карту: классы
 * Tailwind должны быть литералами в исходнике, иначе v4 их не соберёт.
 *
 * Неизвестный `kind` (данные будущей версии формата) НЕ угадывается: список
 * рендерится нейтрально + видимая пометка о нераспознанной категории
 * (edge case спеки). Падать нельзя — расширяемость формата это контракт.
 */
import { computed } from 'vue'

import HighlightedText from '@/components/HighlightedText.vue'
import type { CriteriaKind, CriteriaListBlock } from '@/types/protocol'

const props = withDefaults(
  defineProps<{
    block: CriteriaListBlock
    /** Адрес блока — из него складываются ключи полей для подсветки (T032). */
    sectionId?: string
    blockIndex?: number
  }>(),
  { sectionId: 'section', blockIndex: 0 },
)

/** kind → классы маркера/рамки. Только литералы (см. комментарий выше). */
const KIND_STYLES = {
  inclusion: { marker: 'bg-inclusion', rail: 'border-l-inclusion' },
  'exclusion-absolute': { marker: 'bg-exclusion-absolute', rail: 'border-l-exclusion-absolute' },
  'exclusion-relative': { marker: 'bg-exclusion-relative', rail: 'border-l-exclusion-relative' },
} as const satisfies Record<CriteriaKind, { marker: string; rail: string }>

/** Нейтральный вид для нераспознанной категории — «по догадке» не красим. */
const NEUTRAL_STYLE = { marker: 'bg-fg-subtle', rail: 'border-l-border-strong' } as const

const known = computed(() => Object.hasOwn(KIND_STYLES, props.block.kind))

const style = computed(() =>
  known.value ? KIND_STYLES[props.block.kind as CriteriaKind] : NEUTRAL_STYLE,
)
</script>

<template>
  <div class="rounded-lg border border-border border-l-4 bg-surface px-3 py-3" :class="style.rail" data-block="criteria-list">
    <p
      v-if="!known"
      class="mb-2 rounded-sm bg-surface-sunken px-2 py-1.5 text-xs text-fg-muted"
      data-testid="criteria-unknown-kind"
    >
      Категория списка не распознана: «{{ block.kind }}». Показан нейтральный список без
      цветовой маркировки.
    </p>

    <ul class="flex flex-col gap-2">
      <li v-for="(item, index) in block.items" :key="index" class="flex items-start gap-2.5">
        <span
          class="mt-[0.55em] size-2 shrink-0 rounded-full"
          :class="style.marker"
          aria-hidden="true"
        />
        <span class="text-[15px] leading-relaxed text-fg">
          <HighlightedText
            :text="item"
            :section-id="sectionId"
            :block-index="blockIndex"
            :field="`items.${index}`"
          />
        </span>
      </li>
    </ul>
  </div>
</template>
