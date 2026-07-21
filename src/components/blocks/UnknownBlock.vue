<script setup lang="ts">
/**
 * Фоллбэк неизвестного типа блока (T017, FR-006).
 *
 * Молчаливый пропуск блока ЗАПРЕЩЁН: если данные принесли тип, которого этот
 * билд не знает, врач обязан увидеть, что здесь что-то есть и оно не
 * отображено. Плашка нарочно заметная и показывает фактическую строку типа —
 * по ней разработчик сразу понимает, чего не хватает в реестре (T018).
 */
import type { Block } from '@/types/protocol'

defineProps<{ block: Block }>()
</script>

<template>
  <div
    class="rounded-lg border-2 border-dashed border-exclusion-absolute bg-exclusion-absolute/10 px-3 py-3"
    data-block="unknown"
    role="alert"
  >
    <p class="text-sm font-semibold text-exclusion-absolute">
      Неподдерживаемый тип блока: «<span data-testid="unknown-block-type">{{ block.type }}</span>»
    </p>
    <p class="mt-1 text-xs text-fg-muted">
      Содержимое не отображено. Обновите приложение до версии, которая знает этот тип.
    </p>
  </div>
</template>
