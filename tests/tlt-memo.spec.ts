import { describe, expect, it } from 'vitest'

import { findIndexEntry } from '../src/composables/useProtocols'
import { KNOWN_BLOCK_TYPES, isKnownBlock } from '../src/types/protocol'
import type {
  Block,
  CriteriaListBlock,
  DosageTableBlock,
  Protocol,
  Section,
} from '../src/types/protocol'

import tltJson from '../src/data/protocols/tlt-ischemic-stroke.json'

/**
 * Состав памятки ВВ ТЛТ (фича 002).
 *
 * Клинического текста в этом файле нет и быть не может (конституция II):
 * проверяются только СТРУКТУРНЫЕ свойства — количества, порядок, типы,
 * разметка. Ни одна формулировка документа сюда не переписывается.
 *
 * Зачем тест вообще нужен, если есть машинная проверка дословности
 * (`npm run verify:transcription`): она доказывает, что каждая строка JSON
 * присутствует в исходном документе непрерывным фрагментом, — то есть видит
 * только то, что в файле ЕСТЬ. Потерянный целиком подпункт она пройдёт молча
 * (research.md § R3, ограничение 1). Ровно эту дыру и закрывает тест ниже.
 *
 * Схему, обязательность полей прослеживаемости и биекцию реестр↔файлы
 * проверяет `npm run validate:data`; отображение полей на экране —
 * tests/traceability.spec.ts. Здесь этого нет намеренно.
 */

/**
 * `as unknown as Protocol`: из JSON-импорта TS выводит структурный тип файла,
 * а не union блоков. Приведение даёт те же гарантии, что и в рантайме
 * приложения, где протокол приходит именно как `Protocol`.
 */
const protocol = tltJson as unknown as Protocol

/** Порядок секций из FR-002: показания → противопоказания → дозировки → АД →
 *  нейровизуализация → после ТЛТ. Сверяем по `id`, а не по заголовку: id —
 *  это ещё и якорь навигации, менять его молча нельзя (сломаются deep-link). */
const EXPECTED_SECTION_IDS = [
  'pokazaniya',
  'protivopokazaniya',
  'dozirovki',
  'ad',
  'neirovizualizatsiya',
  'posle-tlt',
] as const

function sectionById(id: string): Section {
  const found = protocol.sections.find((section) => section.id === id)
  if (!found) throw new Error(`секция «${id}» отсутствует в памятке`)
  return found
}

function criteriaListsOf(section: Section): CriteriaListBlock[] {
  return section.blocks
    .filter(isKnownBlock)
    .filter((block): block is CriteriaListBlock => block.type === 'criteria-list')
}

function allBlocks(): Block[] {
  return protocol.sections.flatMap((section) => section.blocks)
}

describe('памятка ВВ ТЛТ: состав и статус', () => {
  /**
   * Полнота переноса (FR-003, FR-004, SC-002).
   *
   * Откуда числа: 6 — это подпункты 28.1–28.6 исходного документа, каждый
   * отдельной позицией списка; 10 — позиции перечисления п. 29, посчитанные
   * при транскрипции. Оба числа обязаны совпадать с колонкой «Позиций»
   * таблицы «Соответствие секций пунктам документа» в
   * specs/002-tlt-memo/source-map.md — по ней врач и сверяет.
   *
   * Если этот тест упал, правильная реакция — открыть документ и пересчитать,
   * а НЕ поправить число в тесте. Изменение любого из этих двух чисел без
   * одновременной правки source-map.md и врачебной сверки — красный флаг:
   * оно означает, что пункт документа потерян, продублирован или склеен
   * с соседним, а машинная проверка дословности такое пропускает.
   */
  it('переносит все 6 подпунктов показаний и все 10 позиций противопоказаний', () => {
    const inclusion = criteriaListsOf(sectionById('pokazaniya'))
    const exclusion = criteriaListsOf(sectionById('protivopokazaniya'))

    // По одному списку на секцию: разбиение на несколько списков означало бы
    // редакторскую группировку, которой в документе нет.
    expect(inclusion).toHaveLength(1)
    expect(exclusion).toHaveLength(1)

    expect(inclusion[0]!.items).toHaveLength(6)
    expect(exclusion[0]!.items).toHaveLength(10)
  })

  /**
   * Порядок секций (FR-002, решение R6): он повторяет ход решения у постели
   * пациента и сознательно отличается от порядка документа. Перестановка
   * секций не ломает ни схему, ни проверку дословности — заметить её может
   * только этот тест.
   */
  it('содержит ровно шесть секций в порядке хода решения врача', () => {
    expect(protocol.sections.map((section) => section.id)).toEqual([...EXPECTED_SECTION_IDS])
  })

  /**
   * Разметка противопоказаний (FR-004).
   *
   * Документ не делит противопоказания на абсолютные и относительные — п. 29
   * идёт одним сплошным списком, и деление придумывать запрещено. Поэтому:
   * секция и её список помечены `exclusion-absolute`, а `exclusion-relative`
   * в этой памятке не встречается вовсе. Появление такой метки означало бы,
   * что кто-то ввёл градацию, которой в источнике нет.
   */
  it('помечает противопоказания как абсолютные и нигде не вводит относительные', () => {
    const section = sectionById('protivopokazaniya')

    expect(section.kind).toBe('exclusion-absolute')
    expect(criteriaListsOf(section)[0]!.kind).toBe('exclusion-absolute')

    const everyList = allBlocks()
      .filter(isKnownBlock)
      .filter((block): block is CriteriaListBlock => block.type === 'criteria-list')

    expect(protocol.sections.every((s) => s.kind !== 'exclusion-relative')).toBe(true)
    expect(everyList.every((list) => list.kind !== 'exclusion-relative')).toBe(true)
  })

  /**
   * Прослеживаемость именно этой памятки (FR-001, FR-015, конституция V).
   *
   * Схема требует четыре поля от любого протокола — здесь проверяется, что
   * они не пустые заглушки и что запись реестра несёт ТЕ ЖЕ значения. Второе
   * важно не ради консистентности как таковой (её стережёт `validate:data`),
   * а потому что главный экран берёт версию из реестра: именно там врач
   * видит пометку черновика ещё до того, как откроет памятку (SC-006).
   */
  it('несёт заполненные поля прослеживаемости, совпадающие с записью реестра', () => {
    expect(protocol.version.length).toBeGreaterThan(0)
    expect(protocol.sourceDocument.length).toBeGreaterThan(0)
    expect(protocol.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(protocol.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const entry = findIndexEntry(protocol.id)
    expect(entry).toBeDefined()
    expect(entry!.title).toBe(protocol.title)
    expect(entry!.version).toBe(protocol.version)
    expect(entry!.sourceDate).toBe(protocol.sourceDate)
  })

  /**
   * Черновой статус (FR-016/FR-017, решение R7).
   *
   * Проверка двусторонняя и снимается сама. Пока версия несёт суффикс
   * `-draft`, первым блоком памятки обязан идти `warning`: врач должен узнать
   * о несверенной транскрипции до первого клинического пункта. Как только
   * врач снимет черновик (версия → `1.0.0`), тот же тест начнёт требовать
   * обратного — что предупреждения больше нет. Правки в этом файле при снятии
   * черновика НЕ требуется: три правки в данных из раздела «После сверки»
   * source-map.md переводят тест на другую ветку сами.
   *
   * Смысл в том, что рассогласование «версия уже чистовая, а предупреждение
   * висит» так же опасно, как обратное: и то и другое врёт врачу о статусе.
   */
  it('держит предупреждение о черновике ровно до снятия чернового статуса', () => {
    const isDraft = protocol.version.includes('-draft')
    const firstBlock = protocol.sections[0]!.blocks[0]!
    const warnings = allBlocks().filter((block) => block.type === 'warning')

    if (isDraft) {
      expect(firstBlock.type).toBe('warning')
      expect(warnings).toHaveLength(1)
    } else {
      expect(firstBlock.type).not.toBe('warning')
      expect(warnings).toHaveLength(0)
    }
  })

  /**
   * Никакой арифметики над дозировками (конституция I).
   *
   * Формат данных не даёт почвы для вычислений: ячейки таблицы — строки, а не
   * числа, и подставлять в них вес пациента некуда. Схема допускает блок
   * НЕИЗВЕСТНОГО типа как валидные данные (это осознанное решение фичи 001),
   * поэтому блок вроде «калькулятор дозы» прошёл бы `validate:data` молча —
   * ловим его здесь, требуя, чтобы все типы блоков памятки были из набора v1.
   */
  it('оставляет дозировки статическим текстом и не заводит вычисляющих блоков', () => {
    const tables = allBlocks()
      .filter(isKnownBlock)
      .filter((block): block is DosageTableBlock => block.type === 'dosage-table')

    expect(tables.length).toBeGreaterThan(0)

    for (const table of tables) {
      for (const row of table.rows) {
        // Ячейка-число открыла бы дорогу арифметике над дозой.
        expect(row.every((cell) => typeof cell === 'string')).toBe(true)
        // Сдвиг строки относительно заголовков переставил бы дозы местами —
        // машинная проверка дословности этого не видит (research.md § R3).
        expect(row).toHaveLength(table.columns.length)
      }
    }

    for (const block of allBlocks()) {
      expect(KNOWN_BLOCK_TYPES).toContain(block.type)
    }
  })
})
