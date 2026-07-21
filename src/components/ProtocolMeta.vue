<script setup lang="ts">
/**
 * Метаданные прослеживаемости (T020, FR-002, конституция V).
 *
 * Эти четыре поля видимы ВСЕГДА, без раскрытия аккордеона и без прокрутки к
 * низу: врач в любой момент должен видеть, из какого документа и какой
 * давности взят текст и когда его последний раз проверяли.
 *
 * Подписи полей — интерфейсная лексика, а не контент протокола; значения
 * целиком приходят из JSON.
 */
import type { Protocol } from '@/types/protocol'

defineProps<{ protocol: Protocol }>()
</script>

<template>
  <dl
    class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-xs"
    data-testid="protocol-meta"
  >
    <dt class="text-fg-subtle">Версия</dt>
    <dd class="text-fg break-words">{{ protocol.version }}</dd>

    <dt class="text-fg-subtle">Источник</dt>
    <dd class="text-fg break-words">{{ protocol.sourceDocument }}</dd>

    <dt class="text-fg-subtle">Дата источника</dt>
    <dd class="text-fg break-words">{{ protocol.sourceDate }}</dd>

    <dt class="text-fg-subtle">Проверено</dt>
    <dd class="text-fg break-words">{{ protocol.lastReviewed }}</dd>
  </dl>
</template>
