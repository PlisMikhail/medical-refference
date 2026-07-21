/**
 * TS-зеркало канонических JSON Schema из `src/data/schema/`.
 *
 * Правила (конституция III, contracts/README.md):
 * - здесь НЕТ медицинского текста — только структура;
 * - схема каноничнее типов: при расхождении правится этот файл;
 * - неизвестный тип блока — валидные данные (FR-006), поэтому `Block`
 *   включает `UnknownBlock`, а рендерер обязан иметь видимый фоллбэк.
 */

/** Служебная ссылка на схему в JSON-файлах контента (разрешена схемой). */
interface SchemaRef {
  /** Относительный путь к JSON Schema — подсказки в редакторе, не данные. */
  $schema?: string
}

/* ------------------------------------------------------------------ */
/* Блоки v1                                                            */
/* ------------------------------------------------------------------ */

/** Свободный текст. Абзацы разделяются `\n\n`. */
export interface TextBlock {
  type: 'text'
  body: string
}

/** Акцентная плашка-предупреждение. */
export interface WarningBlock {
  type: 'warning'
  body: string
}

/**
 * Статическая плашка временного окна.
 * Таймера/обратного отсчёта НЕТ и не будет — это заметка, а не логика
 * (решение спеки; конституция I).
 */
export interface TimerNoteBlock {
  type: 'timer-note'
  /** Необязательная подпись слева от текста (например, обозначение окна). */
  label?: string
  body: string
}

/** Вид критериев: определяет цветовой токен маркера пункта. */
export type CriteriaKind = 'inclusion' | 'exclusion-absolute' | 'exclusion-relative'

/**
 * Список критериев. Схема допускает только три `kind`; если в данных всё же
 * окажется другой (например, из будущей версии формата), рендерер обязан
 * показать нейтральный список с пометкой, а не упасть (edge case спеки).
 */
export interface CriteriaListBlock {
  type: 'criteria-list'
  kind: CriteriaKind
  /** Минимум один пункт (minItems: 1 в схеме). */
  items: string[]
}

/**
 * Таблица дозировок. ВСЕ ячейки — строки, никогда числа: контракт не даёт
 * почвы для арифметики над дозировками (конституция I).
 */
export interface DosageTableBlock {
  type: 'dosage-table'
  title?: string
  /** Заголовки колонок, минимум один. */
  columns: string[]
  /** Строки таблицы; каждая ячейка — строка. */
  rows: string[][]
}

/**
 * Чек-лист с интерактивными отметками. Состояние эфемерно (FR-007),
 * итоги/суммы не вычисляются (конституция I).
 */
export interface ChecklistBlock {
  type: 'checklist'
  items: string[]
}

/** Все строго валидируемые блоки v1. */
export type KnownBlock =
  | TextBlock
  | WarningBlock
  | TimerNoteBlock
  | CriteriaListBlock
  | DosageTableBlock
  | ChecklistBlock

/**
 * Строковый union известных типов — выводится ИЗ union блоков, а не пишется
 * руками. Реестр компонентов (`Record<KnownBlockType, Component>`) благодаря
 * этому падает на компиляции, если новый вариант блока не покрыт (T018).
 */
export type KnownBlockType = KnownBlock['type']

/**
 * Блок неизвестного типа. Обязателен только `type: string`; любые
 * дополнительные поля допустимы и остаются `unknown` — код не вправе
 * трактовать их без обновления схемы.
 */
export interface UnknownBlock {
  type: string
  [extraField: string]: unknown
}

/** Любой блок протокола. */
export type Block = KnownBlock | UnknownBlock

/** Type guard: блок относится к строго валидируемым типам v1. */
export const KNOWN_BLOCK_TYPES = [
  'text',
  'warning',
  'timer-note',
  'criteria-list',
  'dosage-table',
  'checklist',
] as const satisfies readonly KnownBlockType[]

export function isKnownBlock(block: Block): block is KnownBlock {
  return (KNOWN_BLOCK_TYPES as readonly string[]).includes(block.type)
}

/* ------------------------------------------------------------------ */
/* Секции и документ                                                   */
/* ------------------------------------------------------------------ */

/** Тип секции — определяет цветовую маркировку (FR-004). */
export type SectionKind = 'default' | 'inclusion' | 'exclusion-absolute' | 'exclusion-relative'

export interface Section {
  /** Якорь навигации, `^[a-z0-9][a-z0-9-]*$`; уникален внутри протокола. */
  id: string
  title: string
  /** Отсутствие поля эквивалентно `'default'`. */
  kind?: SectionKind
  blocks: Block[]
}

/** Документ протокола: `src/data/protocols/<id>.json`. */
export interface Protocol extends SchemaRef {
  /** Совпадает с именем файла и записью реестра. */
  id: string
  title: string
  /** Поля прослеживаемости — обязательны (конституция V). */
  version: string
  sourceDocument: string
  /** ISO-дата (format: date). */
  sourceDate: string
  /** ISO-дата последней ручной проверки врачом. */
  lastReviewed: string
  /** Минимум одна секция. */
  sections: Section[]
}

/* ------------------------------------------------------------------ */
/* Реестр                                                              */
/* ------------------------------------------------------------------ */

/**
 * Запись реестра. `title/version/sourceDate` денормализованы, чтобы главный
 * экран не грузил все файлы; равенство с файлом протокола гарантирует
 * `validate:data` (инвариант 3 data-model).
 */
export interface IndexEntry {
  id: string
  title: string
  version: string
  sourceDate: string
}

/** Реестр протоколов: `src/data/protocols/index.json`. Порядок = порядок в UI. */
export interface ProtocolIndex extends SchemaRef {
  protocols: IndexEntry[]
}
