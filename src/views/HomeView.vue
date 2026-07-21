<script setup lang="ts">
/**
 * Главный экран (T021, FR-001/FR-014).
 *
 * Список строится ИСКЛЮЧИТЕЛЬНО из реестра `src/data/protocols/index.json` —
 * добавление протокола не требует правок этого файла (конституция III).
 * Вся строка целиком — тач-таргет ≥44px: попасть пальцем в цейтноте важнее,
 * чем аккуратная ссылка на заголовке.
 * Пустой реестр — явное состояние, а не пустой экран (FR-014).
 */
import { RouterLink } from 'vue-router'

import { listProtocols } from '@/composables/useProtocols'

const protocols = listProtocols()
</script>

<template>
  <section>
    <h1 class="text-lg font-semibold text-fg">Протоколы</h1>

    <p
      v-if="protocols.length === 0"
      class="mt-3 rounded-lg border border-border bg-surface px-3 py-4 text-sm text-fg-muted"
      data-testid="home-empty"
    >
      Протоколы недоступны.
    </p>

    <ul v-else class="mt-3 flex flex-col gap-2" data-testid="protocol-list">
      <li v-for="entry in protocols" :key="entry.id">
        <RouterLink
          class="touch-target flex w-full flex-col justify-center gap-0.5 rounded-lg border border-border bg-surface px-4 py-3 text-fg"
          :to="{ name: 'protocol', params: { id: entry.id } }"
        >
          <span class="text-[15px] leading-snug font-medium">{{ entry.title }}</span>
          <span class="text-xs text-fg-muted">
            Версия {{ entry.version }} · {{ entry.sourceDate }}
          </span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
