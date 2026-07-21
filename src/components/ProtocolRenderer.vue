<script setup lang="ts">
/**
 * Рендерер протокола (T019): секции → якоря → блоки через реестр.
 *
 * Компонент ничего не знает о конкретных типах блоков — он знает только
 * реестр. Новый тип блока не требует правок этого файла (конституция III,
 * «каркас, а не набор частных случаев»).
 *
 * ШОВ ДЛЯ PHASE 4:
 *  - T027 покрасит заголовок/рамку секции токеном `section.kind`
 *    (пометка `data-kind` уже проставлена — красить будет CSS/класс-карта);
 *  - T026 повесит `scroll-margin-top` под высоту sticky-панели —
 *    здесь для этого уже есть `scroll-mt-*` на секции.
 * Сейчас цветовая маркировка секций НЕ реализуется намеренно.
 */
import type { Block, Protocol, Section } from '@/types/protocol'
import { resolveBlockComponent } from '@/components/blocks/registry'
import { checklistBlockKey } from '@/composables/useChecklistState'

defineProps<{ protocol: Protocol }>()

/**
 * Пропсы конкретного блока. Всем — `block`; чек-листу дополнительно координаты
 * (`sectionId`, `blockIndex`), из которых складывается ключ его эфемерного
 * состояния `sectionId:blockIndex` (data-model).
 */
function blockProps(section: Section, block: Block, blockIndex: number) {
  if (block.type === 'checklist') {
    return { block, sectionId: section.id, blockIndex }
  }
  return { block }
}

/** Стабильный ключ элемента списка: позиция + тип. */
function blockElementKey(section: Section, block: Block, blockIndex: number): string {
  return `${checklistBlockKey(section.id, blockIndex)}:${block.type}`
}
</script>

<template>
  <div class="flex flex-col gap-7" data-testid="protocol-renderer">
    <section
      v-for="section in protocol.sections"
      :id="section.id"
      :key="section.id"
      class="scroll-mt-20"
      :data-section-kind="section.kind ?? 'default'"
    >
      <!-- T027 (Phase 4): цвет заголовка/рамки по data-section-kind -->
      <h2 class="mb-3 border-b border-border pb-1.5 text-base font-semibold text-fg">
        {{ section.title }}
      </h2>

      <div class="flex flex-col gap-3">
        <component
          :is="resolveBlockComponent(block)"
          v-for="(block, blockIndex) in section.blocks"
          :key="blockElementKey(section, block, blockIndex)"
          v-bind="blockProps(section, block, blockIndex)"
        />
      </div>
    </section>
  </div>
</template>
