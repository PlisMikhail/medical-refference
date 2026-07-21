<script setup lang="ts">
/**
 * Таблица (T015).
 *
 * Все ячейки — СТРОКИ и рендерятся как есть: никакой арифметики, сумм,
 * пересчётов или сортировки по значению (конституция I). Контракт данных
 * (`rows: string[][]`) специально не даёт почвы для вычислений.
 *
 * Горизонтальный скролл живёт ВНУТРИ обёртки блока (`overflow-x-auto`),
 * поэтому страница целиком по горизонтали не едет даже на 380px.
 */
import type { DosageTableBlock } from '@/types/protocol'

defineProps<{ block: DosageTableBlock }>()
</script>

<template>
  <div class="rounded-lg border border-border bg-surface" data-block="dosage-table">
    <p v-if="block.title" class="px-3 pt-3 pb-2 text-sm font-semibold text-fg">
      {{ block.title }}
    </p>

    <!-- Скроллится только эта обёртка, не body -->
    <div class="max-w-full overflow-x-auto overscroll-x-contain">
      <table class="w-max min-w-full border-collapse text-left text-sm">
        <thead>
          <tr class="bg-surface-sunken">
            <th
              v-for="(column, index) in block.columns"
              :key="index"
              scope="col"
              class="border-b border-border px-3 py-2 align-top font-semibold text-fg-muted whitespace-nowrap"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in block.rows"
            :key="rowIndex"
            class="border-b border-border/60 last:border-b-0"
          >
            <td
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
              class="px-3 py-2 align-top text-fg"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
