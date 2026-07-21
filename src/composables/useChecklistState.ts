import { getCurrentInstance, inject, onUnmounted, provide, reactive } from 'vue'
import type { InjectionKey } from 'vue'

/**
 * Эфемерные отметки чек-листов (T016, FR-007).
 *
 * ЧТО ЭТО ДЕЛАЕТ: хранит «какие пункты отмечены» на время просмотра
 * протокола. Ключ блока — `sectionId:blockIndex` (data-model), ключ отметки —
 * `sectionId:blockIndex#itemIndex`.
 *
 * ЧЕГО ЭТО НЕ ДЕЛАЕТ (осознанно):
 * - НЕ persist'ит: ни localStorage, ни sessionStorage, ни URL, ни IndexedDB.
 *   Единственное хранилище — reactive Map в памяти этого модуля-инстанса,
 *   которая уничтожается вместе с компонентом-владельцем (FR-007);
 * - НЕ считает итогов, сумм, процентов и «отмечено N из M» — интерпретация
 *   отметок запрещена конституцией I. Здесь нет и не должно появиться ни
 *   одного счётчика: наружу отдаются только `isMarked` / `toggle` / `clear`.
 */

/** Ключ блока чек-листа в рамках протокола. */
export function checklistBlockKey(sectionId: string, blockIndex: number): string {
  return `${sectionId}:${blockIndex}`
}

export interface ChecklistState {
  /** Отмечен ли пункт `itemIndex` блока `blockKey`. */
  isMarked(blockKey: string, itemIndex: number): boolean
  /** Переключить отметку пункта. */
  toggle(blockKey: string, itemIndex: number): void
  /** Снять все отметки (смена протокола, размонтирование экрана). */
  clear(): void
}

/** Создаёт независимое хранилище отметок. Ничего не регистрирует и не читает. */
export function createChecklistState(): ChecklistState {
  // reactive Map: ключ — `sectionId:blockIndex`, значение — множество
  // индексов отмеченных пунктов ЭТОГО блока.
  const marks = reactive(new Map<string, Set<number>>())

  return {
    isMarked(blockKey, itemIndex) {
      return marks.get(blockKey)?.has(itemIndex) ?? false
    },
    toggle(blockKey, itemIndex) {
      const marked = marks.get(blockKey)
      if (!marked) {
        marks.set(blockKey, new Set([itemIndex]))
        return
      }
      if (marked.has(itemIndex)) marked.delete(itemIndex)
      else marked.add(itemIndex)
    },
    clear() {
      marks.clear()
    },
  }
}

const CHECKLIST_STATE: InjectionKey<ChecklistState> = Symbol('checklist-state')

/**
 * Создаёт хранилище на уровне экрана протокола и раздаёт его вниз.
 * Отметки гарантированно исчезают при unmount владельца (FR-007).
 */
export function provideChecklistState(): ChecklistState {
  const state = createChecklistState()
  provide(CHECKLIST_STATE, state)
  if (getCurrentInstance()) onUnmounted(() => state.clear())
  return state
}

/**
 * Возвращает хранилище экрана протокола, а если провайдера нет (блок
 * смонтирован отдельно — например, в тесте) — своё собственное, живущее
 * ровно столько же, сколько компонент.
 */
export function useChecklistState(): ChecklistState {
  const provided = inject(CHECKLIST_STATE, null)
  if (provided) return provided

  const local = createChecklistState()
  if (getCurrentInstance()) onUnmounted(() => local.clear())
  return local
}
