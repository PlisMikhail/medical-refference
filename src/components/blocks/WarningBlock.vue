<script setup lang="ts">
/**
 * Акцентная плашка-предупреждение (T013).
 *
 * Цвет — только токен `--color-warning` из theme.css: смена палитры не
 * требует правок компонента (FR-004 «не зашито в компоненты»).
 * Текст целиком приходит из данных (конституция III).
 */
import type { WarningBlock } from '@/types/protocol'

defineProps<{ block: WarningBlock }>()
</script>

<template>
  <div
    class="rounded-lg border border-warning/60 border-l-4 border-l-warning bg-warning/10 px-3 py-3"
    data-block="warning"
    role="note"
  >
    <p class="text-[15px] leading-relaxed text-fg whitespace-pre-line">
      {{ block.body }}
    </p>
  </div>
</template>
