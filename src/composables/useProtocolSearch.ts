import { computed, inject, provide, ref, watch } from 'vue'
import type { ComputedRef, InjectionKey, Ref } from 'vue'

import type { Block, Protocol } from '@/types/protocol'
import { isKnownBlock } from '@/types/protocol'

/**
 * Поиск по открытому протоколу (T030, FR-008, SC-005).
 *
 * ЧТО ЭТО ДЕЛАЕТ: собирает всё, что реально выведено на экран протокола, в
 * плоский список «полей», и ищет в них БУКВАЛЬНОЕ вхождение подстроки без
 * учёта регистра. Результат — список совпадений с адресом (секция, блок,
 * поле, смещение), которого хватает и для подсветки, и для перехода.
 *
 * ЧЕГО ЭТО НЕ ДЕЛАЕТ (осознанно):
 * - НЕ строит RegExp. Ни одного. Запрос идёт в `String.indexOf`, поэтому
 *   `.*`, `(`, `[a-z]`, `\` — обычные символы: ни исключения, ни «совпало
 *   всё» здесь физически невозможны (edge case спеки). Экранировать нечего,
 *   потому что нечему интерпретировать спецсимволы.
 * - НЕ ищет за пределами открытого протокола (FR-008), НЕ знает морфологии и
 *   нечёткого совпадения (Assumptions спеки).
 * - НЕ сохраняет запрос: ни storage, ни URL. Строка живёт в ref экрана.
 *
 * ЧТО ПОПАДАЕТ В ИНДЕКС: заголовки секций; `body` блоков text/warning/
 * timer-note (+ `label` у timer-note); пункты criteria-list и checklist;
 * заголовок, шапка и ячейки dosage-table.
 *
 * ЧТО НЕ ПОПАДАЕТ И ПОЧЕМУ: блоки неизвестного типа. Их содержимое НЕ
 * выводится на экран — вместо него стоит плашка фоллбэка (FR-006). Индекс
 * обязан быть зеркалом видимого: иначе счётчик обещал бы совпадение, к
 * которому нельзя перейти и которое нечем подсветить.
 *
 * ПРОИЗВОДИТЕЛЬНОСТЬ: разбор протокола на поля выполняется один раз на
 * документ (WeakMap-кэш по объекту протокола), на нажатие клавиши приходится
 * только приведение запроса к нижнему регистру и проход `indexOf` по уже
 * готовым строкам. Цель плана — <100 мс (запас к SC-005 «<1 с»).
 */

/* ------------------------------------------------------------------ */
/* Адресация                                                           */
/* ------------------------------------------------------------------ */

/**
 * Псевдо-индекс блока для заголовка секции: заголовок принадлежит секции, а
 * не какому-либо блоку, но адресуется тем же ключом.
 */
export const SECTION_TITLE_BLOCK_INDEX = -1

/**
 * Ключ текстового поля: `sectionId:blockIndex:field`.
 *
 * `field` — путь внутри блока (`body`, `body.0`, `items.2`, `rows.1.2`).
 * Один и тот же ключ строит и сборщик индекса, и компонент подсветки —
 * поэтому совпадение всегда находит своё место в DOM.
 */
export function searchFieldKey(sectionId: string, blockIndex: number, field: string): string {
  return `${sectionId}:${blockIndex}:${field}`
}

/** Текстовое поле протокола — единица индекса. */
export interface SearchField {
  key: string
  sectionId: string
  blockIndex: number
  field: string
  /** Исходный текст, как он выведен на экран. */
  text: string
  /** Тот же текст в нижнем регистре, посимвольно и БЕЗ смены длины. */
  folded: string
}

/** Одно совпадение: адрес поля + смещения внутри его исходного текста. */
export interface SearchMatch {
  /** Порядковый номер в документе, 0-based — им же нумеруется счётчик. */
  ordinal: number
  key: string
  sectionId: string
  blockIndex: number
  start: number
  end: number
}

/* ------------------------------------------------------------------ */
/* Регистр                                                             */
/* ------------------------------------------------------------------ */

/**
 * Регистронезависимость БЕЗ сдвига смещений.
 *
 * Простой `toLowerCase()` для отдельных символов меняет длину строки
 * (классический пример — «İ» → два кода). Тогда позиция, найденная в
 * приведённой строке, указывала бы мимо в исходной, и подсветка резала бы
 * текст не по границам совпадения. Поэтому символ приводится к нижнему
 * регистру только если его длина при этом не изменилась; иначе остаётся как
 * есть. Длина результата равна длине входа — смещения переносятся один в один.
 */
export function foldCase(text: string): string {
  let folded = ''
  for (const character of text) {
    const lower = character.toLowerCase()
    folded += lower.length === character.length ? lower : character
  }
  return folded
}

/* ------------------------------------------------------------------ */
/* Сбор индекса                                                        */
/* ------------------------------------------------------------------ */

/** Разделитель абзацев блока text — пустая строка (data-model, `TextBlock`). */
const PARAGRAPH_SEPARATOR = /\r?\n\s*\r?\n/

/**
 * Разбиение `body` на абзацы. Живёт здесь, а не в TextBlock, потому что
 * индекс и компонент ОБЯЗАНЫ резать текст одинаково: иначе смещение
 * совпадения, посчитанное по целому `body`, не попадёт в отрисованный абзац.
 */
export function splitParagraphs(body: string): string[] {
  return body
    .split(PARAGRAPH_SEPARATOR)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

/**
 * Данные могут оказаться новее или битее кода (dev-валидация — отдельный
 * рубеж). Поиск не вправе ронять открытый экран, поэтому не-массив и
 * не-строки просто выпадают из индекса.
 */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/** Возвращает «класть поле сюда» для конкретного адреса секция+блок. */
function fieldPusher(fields: SearchField[], sectionId: string, blockIndex: number) {
  return (field: string, text: unknown): void => {
    if (typeof text !== 'string' || text.length === 0) return
    fields.push({
      key: searchFieldKey(sectionId, blockIndex, field),
      sectionId,
      blockIndex,
      field,
      text,
      folded: foldCase(text),
    })
  }
}

function collectBlock(
  fields: SearchField[],
  sectionId: string,
  blockIndex: number,
  block: Block,
): void {
  // Неизвестный тип: содержимое не отрисовано (FR-006) — в индекс не идёт.
  if (!isKnownBlock(block)) return

  const push = fieldPusher(fields, sectionId, blockIndex)

  switch (block.type) {
    case 'text':
      splitParagraphs(block.body).forEach((paragraph, index) => push(`body.${index}`, paragraph))
      return
    case 'warning':
      push('body', block.body)
      return
    case 'timer-note':
      push('label', block.label)
      push('body', block.body)
      return
    case 'criteria-list':
    case 'checklist':
      stringList(block.items).forEach((item, index) => push(`items.${index}`, item))
      return
    case 'dosage-table':
      push('title', block.title)
      stringList(block.columns).forEach((column, index) => push(`columns.${index}`, column))
      if (Array.isArray(block.rows)) {
        block.rows.forEach((row, rowIndex) => {
          stringList(row).forEach((cell, cellIndex) => push(`rows.${rowIndex}.${cellIndex}`, cell))
        })
      }
      return
    default: {
      // Новый вариант KnownBlock без ветки здесь уронит type-check.
      const unreachable: never = block
      void unreachable
      return
    }
  }
}

/** Собирает поля протокола в порядке документа. Побочных эффектов нет. */
export function collectSearchFields(protocol: Protocol): SearchField[] {
  const fields: SearchField[] = []

  for (const section of protocol.sections ?? []) {
    fieldPusher(fields, section.id, SECTION_TITLE_BLOCK_INDEX)('title', section.title)
    const blocks = Array.isArray(section.blocks) ? section.blocks : []
    blocks.forEach((block, blockIndex) => collectBlock(fields, section.id, blockIndex, block))
  }

  return fields
}

/**
 * Кэш индекса по объекту протокола: пересборка на каждое нажатие клавиши не
 * нужна, а протокол за время просмотра не меняется. WeakMap — чтобы закрытый
 * протокол не удерживался в памяти.
 */
const fieldsCache = new WeakMap<Protocol, SearchField[]>()

export function protocolSearchFields(protocol: Protocol): SearchField[] {
  const cached = fieldsCache.get(protocol)
  if (cached) return cached

  const fields = collectSearchFields(protocol)
  fieldsCache.set(protocol, fields)
  return fields
}

/* ------------------------------------------------------------------ */
/* Поиск                                                               */
/* ------------------------------------------------------------------ */

/**
 * Все непересекающиеся вхождения запроса в поля, в порядке документа.
 *
 * Единственная операция сравнения — `indexOf` по приведённым строкам.
 * Спецсимволы запроса не значат ничего сверх самих себя.
 */
export function findMatches(fields: readonly SearchField[], query: string): SearchMatch[] {
  const needle = foldCase(query)
  const matches: SearchMatch[] = []
  // Запрос из одних пробелов — не запрос: он совпал бы почти со всем текстом.
  if (query.trim().length === 0) return matches

  for (const field of fields) {
    let from = 0
    for (;;) {
      const start = field.folded.indexOf(needle, from)
      if (start === -1) break

      const end = start + needle.length
      matches.push({
        ordinal: matches.length,
        key: field.key,
        sectionId: field.sectionId,
        blockIndex: field.blockIndex,
        start,
        end,
      })
      from = end
    }
  }

  return matches
}

/* ------------------------------------------------------------------ */
/* Состояние экрана                                                    */
/* ------------------------------------------------------------------ */

export interface ProtocolSearchContext {
  /** Строка запроса. Нигде не сохраняется (конституция VI). */
  query: Ref<string>
  matches: ComputedRef<readonly SearchMatch[]>
  total: ComputedRef<number>
  /** Активное совпадение, 0-based; `-1`, когда совпадений нет. */
  activeOrdinal: ComputedRef<number>
  /** Активное совпадение, 1-based — для счётчика «N / M»; `0`, если нет. */
  activeNumber: ComputedRef<number>
  /** Введено что-то содержательное (не пусто и не одни пробелы). */
  hasQuery: ComputedRef<boolean>
  /** Запрос есть, совпадений нет — состояние «ничего не найдено». */
  notFound: ComputedRef<boolean>
  /** Совпадения конкретного текстового поля, в порядке возрастания смещения. */
  matchesIn(fieldKey: string): readonly SearchMatch[]
  /** Следующее совпадение; с последнего переходит на первое. */
  next(): void
  /** Предыдущее совпадение; с первого переходит на последнее. */
  prev(): void
  /** Полный сброс: пустой запрос, нет подсветки, нет активного совпадения. */
  reset(): void
}

const NO_MATCHES: readonly SearchMatch[] = Object.freeze([])

/**
 * Создаёт независимое состояние поиска поверх ссылки на протокол.
 * Ничего не регистрирует глобально и ничего не читает из окружения.
 */
export function createProtocolSearch(
  protocol: Ref<Protocol | null | undefined>,
): ProtocolSearchContext {
  const query = ref('')
  /** Сырое положение курсора; наружу отдаётся только через `activeOrdinal`. */
  const cursor = ref(0)

  const fields = computed(() => (protocol.value ? protocolSearchFields(protocol.value) : []))
  const matches = computed<readonly SearchMatch[]>(() => findMatches(fields.value, query.value))
  const total = computed(() => matches.value.length)

  const byField = computed(() => {
    const map = new Map<string, SearchMatch[]>()
    for (const match of matches.value) {
      const bucket = map.get(match.key)
      if (bucket) bucket.push(match)
      else map.set(match.key, [match])
    }
    return map
  })

  // Курсор клампится, а не доверяется: набранный символ мог укоротить список
  // раньше, чем сработает watch ниже.
  const activeOrdinal = computed(() =>
    total.value === 0 ? -1 : Math.min(Math.max(cursor.value, 0), total.value - 1),
  )
  const activeNumber = computed(() => activeOrdinal.value + 1)

  const hasQuery = computed(() => query.value.trim().length > 0)
  const notFound = computed(() => hasQuery.value && total.value === 0)

  // Новый набор совпадений (изменился запрос или протокол) — врач ждёт первое
  // сверху, а не то место, где он был до правки строки.
  watch(matches, () => {
    cursor.value = 0
  })

  function step(delta: number): void {
    if (total.value === 0) return
    // Кольцо: с последнего — на первое, с первого — на последнее.
    cursor.value = (activeOrdinal.value + delta + total.value) % total.value
  }

  return {
    query,
    matches,
    total,
    activeOrdinal,
    activeNumber,
    hasQuery,
    notFound,
    matchesIn: (fieldKey) => byField.value.get(fieldKey) ?? NO_MATCHES,
    next: () => step(1),
    prev: () => step(-1),
    reset: () => {
      query.value = ''
      cursor.value = 0
    },
  }
}

const PROTOCOL_SEARCH: InjectionKey<ProtocolSearchContext> = Symbol('protocol-search')

/**
 * Создаёт состояние поиска на уровне экрана протокола и раздаёт его вниз —
 * панели поиска и всем компонентам подсветки.
 */
export function provideProtocolSearch(
  protocol: Ref<Protocol | null | undefined>,
): ProtocolSearchContext {
  const context = createProtocolSearch(protocol)
  provide(PROTOCOL_SEARCH, context)
  return context
}

/**
 * Инертный контекст: блок смонтирован вне экрана протокола (отдельный тест,
 * витрина компонента). Запрос в нём пуст всегда, совпадений нет — подсветка
 * просто не появляется, а компонент рендерится как обычно.
 *
 * Создаётся один раз на модуль: общий на всех безопасно именно потому, что
 * он неизменен.
 */
const INERT_SEARCH: ProtocolSearchContext = createProtocolSearch(ref(null))

/** Состояние поиска экрана протокола; вне экрана — инертная заглушка. */
export function useProtocolSearch(): ProtocolSearchContext {
  return inject(PROTOCOL_SEARCH, INERT_SEARCH)
}
