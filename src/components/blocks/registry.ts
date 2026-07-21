import type { Component } from 'vue'

import type { Block, KnownBlockType } from '@/types/protocol'
import { isKnownBlock } from '@/types/protocol'

import ChecklistBlock from './ChecklistBlock.vue'
import CriteriaListBlock from './CriteriaListBlock.vue'
import DosageTableBlock from './DosageTableBlock.vue'
import TextBlock from './TextBlock.vue'
import TimerNoteBlock from './TimerNoteBlock.vue'
import UnknownBlock from './UnknownBlock.vue'
import WarningBlock from './WarningBlock.vue'

/**
 * Реестр блоков (T018) — единственное место, где тип данных встречается с
 * компонентом. Добавление типа блока = ветка в схеме + вариант union +
 * компонент + СТРОКА ЗДЕСЬ; ни рендерер, ни экраны не трогаются.
 *
 * ГАРАНТИЯ ПОЛНОТЫ: аннотация `Record<KnownBlockType, Component>` — не
 * украшение. `KnownBlockType` выводится из union блоков в types/protocol.ts,
 * поэтому пропущенный вариант роняет `npm run type-check`:
 *   «Property 'checklist' is missing in type ... but required in type
 *    Record<KnownBlockType, Component>».
 * Лишний ключ ловится тем же способом. Проверено удалением записи.
 */
export const blockRegistry: Record<KnownBlockType, Component> = {
  text: TextBlock,
  warning: WarningBlock,
  'timer-note': TimerNoteBlock,
  'criteria-list': CriteriaListBlock,
  'dosage-table': DosageTableBlock,
  checklist: ChecklistBlock,
}

/** Компонент видимого фоллбэка — экспортируется для тестов и рендерера. */
export { UnknownBlock }

/**
 * Компонент для блока. Неизвестный тип НЕ приводит к пропуску блока —
 * возвращается видимая плашка (FR-006).
 */
export function resolveBlockComponent(block: Block): Component {
  return isKnownBlock(block) ? blockRegistry[block.type] : UnknownBlock
}
