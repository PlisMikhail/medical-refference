import { describe, expect, it } from 'vitest'

import { findIndexEntry } from '../src/composables/useProtocols'
import { KNOWN_BLOCK_TYPES, isKnownBlock } from '../src/types/protocol'
import type { Block, CriteriaListBlock, Protocol, Section } from '../src/types/protocol'

import vsteJson from '../src/data/protocols/vste-ischemic-stroke.json'

/**
 * Состав памятки по ВСТЭ (фича 003).
 *
 * Клинического текста в этом файле нет и быть не может (конституция II):
 * проверяются только СТРУКТУРНЫЕ свойства — количества, порядок, типы,
 * разметка. Ни одна формулировка документа сюда не переписывается.
 *
 * Зачем тест нужен поверх машинной проверки дословности: та доказывает, что
 * каждая строка JSON присутствует в документе непрерывным фрагментом, то есть
 * видит только то, что в файле ЕСТЬ. Здесь она слабее, чем на памятке ТЛТ,
 * и сразу по двум причинам (research.md § R8):
 *
 *   1. потерянную целиком позицию она проходит молча;
 *   2. пп. 32, 33 и 35 содержат почти одинаковые позиции — например «оценка
 *      неврологического дефицита по шкале NIHSS не менее 6 баллов» встречается
 *      в документе дословно трижды. Позиция, попавшая в секцию ЧУЖОГО
 *      временного окна, честно найдётся в источнике и не вызовет ни одной
 *      жалобы.
 *
 * Счётчики ниже закрывают первую дыру и сужают вторую: сдвиг позиции между
 * соседними окнами меняет длину обоих списков.
 */

/**
 * `as unknown as Protocol`: из JSON-импорта TS выводит структурный тип файла,
 * а не union блоков. Приведение даёт те же гарантии, что и в рантайме.
 */
const protocol = vsteJson as unknown as Protocol

/**
 * Порядок секций из FR-002 — ход решения врача, а не порядок документа
 * (research.md § R3). Сверяем по `id`: id — ещё и якорь навигации, менять его
 * молча нельзя, сломаются deep-link.
 */
const EXPECTED_SECTION_IDS = [
  'pokazaniya',
  'pokazaniya-vbba',
  'otbor-0-6',
  'otbor-6-24',
  'otbor-ktp-6-24',
  'otbor-ktp-6-16',
  'protivopokazaniya',
  'ad',
  'neirovizualizatsiya',
  'kak-vypolnyaetsya',
  'ekstrakranialnye',
  'posle-vste',
  'indikatory',
] as const

/**
 * Число позиций в каждом перечне документа. Посчитано по исходному документу
 * ДО транскрипции и независимо от неё — в этом весь смысл: тест проверяет
 * работу переписчика, а не повторяет её результат.
 *
 * Соответствие пунктам: показания — п. 31, ВББА — п. 36, отбор 0–6 ч — п. 32,
 * отбор 6–24 ч — п. 33, отбор по КТП 6–24 ч — п. 34, отбор по КТП 6–16 ч —
 * п. 35, противопоказания — п. 38.
 *
 * Числа обязаны совпадать с колонкой «Позиций» таблицы «Соответствие секций
 * пунктам документа» в specs/003-thrombectomy-memo/source-map.md — по ней врач
 * и сверяет.
 *
 * Если тест упал, правильная реакция — открыть документ и пересчитать, а НЕ
 * поправить число здесь. Правка любого из этих чисел без одновременной правки
 * source-map.md и врачебной сверки — красный флаг: она означает, что позиция
 * потеряна, продублирована или уехала в секцию соседнего временного окна.
 */
const EXPECTED_ITEM_COUNTS: Record<string, number> = {
  pokazaniya: 2,
  'pokazaniya-vbba': 3,
  'otbor-0-6': 6,
  'otbor-6-24': 5,
  'otbor-ktp-6-24': 3,
  'otbor-ktp-6-16': 5,
  protivopokazaniya: 6,
}

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

describe('памятка по ВСТЭ: состав и статус', () => {
  /**
   * Полнота переноса (FR-003…FR-006, SC-002, SC-005).
   */
  it('переносит все позиции каждого перечня документа, ни одной больше', () => {
    for (const [id, expected] of Object.entries(EXPECTED_ITEM_COUNTS)) {
      const lists = criteriaListsOf(sectionById(id))

      // По одному списку на секцию: разбиение на несколько означало бы
      // редакторскую группировку, которой в документе нет.
      expect(lists, `секция ${id}: списков критериев`).toHaveLength(1)
      expect(lists[0]!.items, `секция ${id}: позиций`).toHaveLength(expected)
    }
  })

  /**
   * Четыре набора критериев отбора — четыре секции (FR-005, решение R2).
   *
   * Слияние двух окон в одну секцию или потеря одного из наборов не ломает
   * ни схему, ни проверку дословности. Заметить это может только тест.
   */
  it('держит четыре набора критериев отбора отдельными секциями', () => {
    const selection = ['otbor-0-6', 'otbor-6-24', 'otbor-ktp-6-24', 'otbor-ktp-6-16']

    for (const id of selection) {
      const section = sectionById(id)
      expect(section.kind, `секция ${id}`).toBe('inclusion')
      expect(criteriaListsOf(section)[0]!.kind, `список ${id}`).toBe('inclusion')
    }

    // Названия должны различаться: по ним врач выбирает чип, не открывая секцию
    // (FR-026). Одинаковые заголовки сделали бы ленту чипов бесполезной.
    const titles = selection.map((id) => sectionById(id).title)
    expect(new Set(titles).size).toBe(selection.length)
  })

  /**
   * Порядок секций (FR-002, решение R3).
   */
  it('содержит ровно тринадцать секций в порядке хода решения врача', () => {
    expect(protocol.sections.map((section) => section.id)).toEqual([...EXPECTED_SECTION_IDS])
  })

  /**
   * Разметка противопоказаний (FR-006).
   *
   * Документ не делит противопоказания на абсолютные и относительные — п. 38
   * идёт одним списком, и деление придумывать запрещено.
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
   * Прослеживаемость (FR-018, FR-022, конституция V).
   *
   * Запись реестра обязана нести те же значения: главный экран берёт версию
   * оттуда, и именно там врач видит пометку черновика до открытия памятки.
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
   * Каждая секция несёт ссылку на пункт документа (FR-018).
   *
   * Без неё сверка превращается в поиск по документу вслепую. Проверяем
   * структурно: первым содержательным блоком секции идёт `text` — сама строка
   * ссылки лежит в списке исключений и читается врачом глазами.
   */
  it('начинает каждую секцию блоком со ссылкой на пункт документа', () => {
    for (const section of protocol.sections) {
      // У первой секции первым может стоять предупреждение о черновике.
      const blocks = section.blocks.filter((block) => block.type !== 'warning')
      expect(blocks.length, `секция ${section.id}: блоков`).toBeGreaterThan(0)
      expect(blocks[0]!.type, `секция ${section.id}: первый блок`).toBe('text')
    }
  })

  /**
   * Черновой статус (FR-023/FR-024, наследует решение R7 фичи 002).
   *
   * Проверка двусторонняя и снимается сама: пока версия несёт суффикс
   * `-draft`, первым блоком памятки обязан идти `warning`; как только врач
   * снимет черновик, тот же тест начнёт требовать его отсутствия. Правки
   * в этом файле при снятии черновика НЕ требуется.
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
   * Никакой интерпретации и никаких вычислений (конституция I).
   *
   * Схема допускает блок НЕИЗВЕСТНОГО типа как валидные данные (осознанное
   * решение фичи 001), поэтому блок вроде «подбери окно по времени» прошёл бы
   * `validate:data` молча. Ловим здесь: все типы блоков — из набора v1.
   *
   * Отдельно `checklist`: он интерактивен, и разметить им алгоритм ВСТЭ было бы
   * соблазнительно, но неверно — это описание метода, а не список действий
   * врача-невролога (research.md § R6).
   */
  it('не заводит блоков вне набора v1 и не размечает алгоритм чеклистом', () => {
    for (const block of allBlocks()) {
      expect(KNOWN_BLOCK_TYPES).toContain(block.type)
    }

    expect(allBlocks().some((block) => block.type === 'checklist')).toBe(false)
  })
})
