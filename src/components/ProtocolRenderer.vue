<script setup lang="ts">
/**
 * Рендерер протокола (T019): секции → якоря → блоки через реестр.
 *
 * Компонент ничего не знает о конкретных типах блоков — он знает только
 * реестр. Новый тип блока не требует правок этого файла (конституция III,
 * «каркас, а не набор частных случаев»).
 *
 * PHASE 4:
 *  - T027 — цветовая маркировка секции по `kind` (FR-004): три значимых типа
 *    секций различаются с первого взгляда, без чтения заголовка. Различение
 *    только цветом — осознанное решение владельца (spec, Assumptions),
 *    значков-дублёров здесь нет;
 *  - T026 — `scroll-under-chrome` вместо прежнего `scroll-mt-20`: отступ
 *    якоря считается из измеренных высот шапки и ленты секций, а не из
 *    подобранной руками константы (см. composables/useStickyChrome.ts).
 *
 * PHASE 6 (T032): каждому блоку сообщается его адрес — id секции и позиция в
 * ней. Из адреса складывается ключ текстового поля, по которому компонент
 * подсветки находит «свои» совпадения поиска. Рендерер по-прежнему ничего не
 * знает о типах блоков: адрес одинаков для всех.
 */
import HighlightedText from '@/components/HighlightedText.vue'
import type { Block, Protocol, Section, SectionKind } from '@/types/protocol'
import { isKnownBlock } from '@/types/protocol'
import { resolveBlockComponent } from '@/components/blocks/registry'
import { checklistBlockKey } from '@/composables/useChecklistState'
import { SECTION_TITLE_BLOCK_INDEX } from '@/composables/useProtocolSearch'

defineProps<{ protocol: Protocol }>()

/**
 * kind → классы заголовка секции: левая «рельса» и подчёркивание берут цвет
 * токена типа. Только литералы — Tailwind v4 не видит вычисленных имён
 * классов (тот же приём, что в CriteriaListBlock).
 *
 * `default` намеренно нейтрален: цвет тут — сигнал, а сигнал, который горит
 * всегда, ничего не сообщает.
 */
const KIND_HEADING_STYLES = {
  default: 'border-l-border border-b-border text-fg',
  inclusion: 'border-l-inclusion border-b-inclusion/40 text-inclusion',
  'exclusion-absolute':
    'border-l-exclusion-absolute border-b-exclusion-absolute/40 text-exclusion-absolute',
  'exclusion-relative':
    'border-l-exclusion-relative border-b-exclusion-relative/40 text-exclusion-relative',
} as const satisfies Record<SectionKind, string>

/** Незнакомый тип секции (данные новее кода) — нейтрально, без догадок. */
function headingStyle(section: Section): string {
  const kind = section.kind ?? 'default'
  return Object.hasOwn(KIND_HEADING_STYLES, kind)
    ? KIND_HEADING_STYLES[kind]
    : KIND_HEADING_STYLES.default
}

/**
 * Пропсы конкретного блока.
 *
 * Известным блокам, кроме самого блока, передаётся его адрес
 * (`sectionId`, `blockIndex`): из него складываются и ключ эфемерного
 * состояния чек-листа `sectionId:blockIndex` (data-model), и ключи текстовых
 * полей для подсветки поиска (T032).
 *
 * Блок неизвестного типа адреса не получает: его содержимое не отрисовано
 * (FR-006), подсвечивать нечего, а лишние пропсы осели бы атрибутами на
 * плашке фоллбэка.
 */
function blockProps(section: Section, block: Block, blockIndex: number) {
  if (!isKnownBlock(block)) return { block }
  return { block, sectionId: section.id, blockIndex }
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
      class="scroll-under-chrome"
      :data-section-kind="section.kind ?? 'default'"
    >
      <h2
        class="mb-3 border-b border-l-4 pb-1.5 pl-2.5 text-base font-semibold"
        :class="headingStyle(section)"
      >
        <HighlightedText
          :text="section.title"
          :section-id="section.id"
          :block-index="SECTION_TITLE_BLOCK_INDEX"
          field="title"
        />
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
