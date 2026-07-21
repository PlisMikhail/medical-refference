import { mount } from '@vue/test-utils'
import { defineComponent, h, shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'

import HighlightedText from '../src/components/HighlightedText.vue'
import ProtocolRenderer from '../src/components/ProtocolRenderer.vue'
import ProtocolSearch from '../src/components/ProtocolSearch.vue'
import {
  collectSearchFields,
  findMatches,
  protocolSearchFields,
  provideProtocolSearch,
} from '../src/composables/useProtocolSearch'
import type { Protocol } from '../src/types/protocol'

import demoProtocolJson from './fixtures/demo-protocol.json'

/**
 * Контракт поиска по открытому протоколу (T033; US3, FR-008, SC-005).
 *
 * Фикстура ниже — ТОЛЬКО технические заглушки («Пункт A», «Ячейка альфа»):
 * медицинского текста в тестах нет и быть не может (конституция II/III).
 * Искомый токен — бессмысленное слово «альфа» в разном регистре.
 *
 * Проверяется ровно то, что делает поиск пригодным в цейтноте:
 *  1. регистр не имеет значения;
 *  2. спецсимволы — обычные символы, а не язык шаблонов;
 *  3. пустой результат — явное состояние, а не пустота;
 *  4. счётчик считает всё, а prev/next ходят по кольцу;
 *  5. совпадения находятся в РАЗНЫХ типах блоков;
 *  6. очистка запроса убирает подсветку без следов.
 */

/**
 * `as unknown as Protocol`: фикстура намеренно содержит блок неизвестного
 * типа — он проверяет, что индекс зеркалит ВИДИМОЕ (содержимое такого блока
 * не отрисовано, FR-006, значит и в поиск не попадает).
 */
const fixture = {
  id: 'fixture-protocol',
  title: 'Заголовок протокола (заглушка)',
  version: '9.9.9-fixture',
  sourceDocument: 'Документ-заглушка',
  sourceDate: '2020-01-01',
  lastReviewed: '2020-02-02',
  sections: [
    {
      id: 'section-one',
      title: 'Секция АЛЬФА (заглушка)',
      kind: 'default',
      blocks: [
        { type: 'text', body: 'Абзац с альфа внутри.\n\nВторой абзац без токена.' },
        { type: 'warning', body: 'Плашка Альфа (заглушка).' },
        { type: 'timer-note', label: 'Метка альфа', body: 'Заметка без токена.' },
      ],
    },
    {
      id: 'section-two',
      title: 'Секция 2 (заглушка)',
      kind: 'inclusion',
      blocks: [
        { type: 'criteria-list', kind: 'inclusion', items: ['Пункт АльФа', 'Пункт B'] },
        {
          type: 'dosage-table',
          title: 'Заголовок таблицы (заглушка)',
          columns: ['Колонка 1', 'Колонка 2'],
          rows: [['Ячейка альфа', 'Ячейка 1-2']],
        },
        { type: 'checklist', items: ['Отметка АЛЬфа', 'Отметка B'] },
      ],
    },
    {
      id: 'section-three',
      title: 'Секция 3 (заглушка)',
      blocks: [
        // Неизвестный тип: содержимое не отрисовано → и в индекс не попадает.
        { type: 'bogus-type', body: 'Альфа из будущего формата' },
        { type: 'text', body: 'Спецсимволы: .* ( [a-z] \\ и альфа снова.' },
      ],
    },
  ],
} as unknown as Protocol

/**
 * Независимый оракул: ВЕСЬ текст фикстуры, который реально попадает на экран.
 * Содержимого блока неизвестного типа здесь нет — оно не отрисовано (FR-006).
 *
 * Список выписан руками специально: ожидаемые количества совпадений считаются
 * по нему через `String.split` (буквальное деление по подстроке), а не той же
 * функцией, которую тест проверяет.
 */
const VISIBLE_TEXTS = [
  'Секция АЛЬФА (заглушка)',
  'Абзац с альфа внутри.',
  'Второй абзац без токена.',
  'Плашка Альфа (заглушка).',
  'Метка альфа',
  'Заметка без токена.',
  'Секция 2 (заглушка)',
  'Пункт АльФа',
  'Пункт B',
  'Заголовок таблицы (заглушка)',
  'Колонка 1',
  'Колонка 2',
  'Ячейка альфа',
  'Ячейка 1-2',
  'Отметка АЛЬфа',
  'Отметка B',
  'Секция 3 (заглушка)',
  'Спецсимволы: .* ( [a-z] \\ и альфа снова.',
]

/** Сколько непересекающихся буквальных вхождений запроса видно на экране. */
function expectedMatches(query: string): number {
  const needle = query.toLowerCase()
  return VISIBLE_TEXTS.reduce(
    (total, text) => total + (text.toLowerCase().split(needle).length - 1),
    0,
  )
}

/** Все вхождения «альфа» в ВИДИМОМ тексте фикстуры. */
const TOTAL_ALPHA_MATCHES = expectedMatches('альфа')

const demoProtocol = demoProtocolJson as unknown as Protocol

/* ------------------------------------------------------------------ */
/* Уровень composable                                                  */
/* ------------------------------------------------------------------ */

function matchesFor(query: string) {
  return findMatches(collectSearchFields(fixture), query)
}

describe('useProtocolSearch — сопоставление', () => {
  it('находит вхождения независимо от регистра запроса и текста', () => {
    const lower = matchesFor('альфа')
    const upper = matchesFor('АЛЬФА')
    const mixed = matchesFor('АльФа')

    expect(lower).toHaveLength(TOTAL_ALPHA_MATCHES)
    expect(upper).toHaveLength(TOTAL_ALPHA_MATCHES)
    expect(mixed).toHaveLength(TOTAL_ALPHA_MATCHES)
    // Регистр запроса не должен менять ни одного адреса совпадения.
    expect(upper).toEqual(lower)
    expect(mixed).toEqual(lower)
  })

  it('смещения совпадения указывают на исходный текст, а не мимо', () => {
    const fields = collectSearchFields(fixture)
    for (const match of findMatches(fields, 'альфа')) {
      const field = fields.find((candidate) => candidate.key === match.key)
      expect(field).toBeDefined()
      expect(field!.text.slice(match.start, match.end).toLowerCase()).toBe('альфа')
    }
  })

  it('не индексирует содержимое блока неизвестного типа — оно не отрисовано', () => {
    const fields = collectSearchFields(fixture)

    expect(fields.some((field) => field.text.includes('будущего формата'))).toBe(false)
    // При этом заголовок той же секции в индексе есть.
    expect(fields.some((field) => field.key === 'section-three:-1:title')).toBe(true)
  })

  it('индексирует заголовки секций и все текстовые поля известных блоков', () => {
    const keys = collectSearchFields(fixture).map((field) => field.key)

    expect(keys).toContain('section-one:-1:title')
    expect(keys).toContain('section-one:0:body.0')
    expect(keys).toContain('section-one:0:body.1')
    expect(keys).toContain('section-one:1:body')
    expect(keys).toContain('section-one:2:label')
    expect(keys).toContain('section-two:0:items.1')
    expect(keys).toContain('section-two:1:title')
    expect(keys).toContain('section-two:1:columns.0')
    expect(keys).toContain('section-two:1:rows.0.1')
    expect(keys).toContain('section-two:2:items.0')
  })

  it('фикстура даёт ожидаемое число вхождений искомого токена', () => {
    expect(TOTAL_ALPHA_MATCHES).toBe(8)
  })

  it('трактует спецсимволы буквально: ни исключения, ни «совпало всё»', () => {
    const specials = ['.*', '(', '[a-z]', '\\', ')', '?', '+', '^', '$', '|', '{2}', '\\d', '.']

    for (const query of specials) {
      let matches: ReturnType<typeof matchesFor> | null = null
      expect(() => {
        matches = matchesFor(query)
      }, `запрос ${JSON.stringify(query)} не должен бросать`).not.toThrow()

      const found = matches! as ReturnType<typeof matchesFor>
      // Ровно столько, сколько раз эта последовательность символов реально
      // встречается на экране — ни больше (шаблон не «раскрылся»), ни меньше.
      expect(found.length, `запрос ${JSON.stringify(query)}`).toBe(expectedMatches(query))
    }
  })

  it('регексо-подобный запрос не совпадает со всем подряд', () => {
    const fields = collectSearchFields(fixture)

    // `.*` как шаблон совпал бы с каждым полем; буквально — только с одним.
    expect(findMatches(fields, '.*')).toHaveLength(1)
    expect(fields.length).toBeGreaterThan(10)

    // `[a-z]` буквально есть ровно в одной строке фикстуры, хотя латиница —
    // ещё в двух («Пункт B», «Отметка B»).
    expect(findMatches(fields, '[a-z]')).toHaveLength(1)

    // Одиночная точка совпадает только с точками, а не «с любым символом».
    const dots = findMatches(fields, '.')
    expect(dots).toHaveLength(expectedMatches('.'))
    for (const match of dots) {
      const field = fields.find((candidate) => candidate.key === match.key)!
      expect(field.text.slice(match.start, match.end)).toBe('.')
    }
  })

  it('на пустом запросе и запросе из пробелов не находит ничего', () => {
    expect(matchesFor('')).toHaveLength(0)
    expect(matchesFor('   ')).toHaveLength(0)
  })

  it('считает вхождения непересекающимися и в порядке документа', () => {
    const repeated = {
      id: 'p',
      title: 't',
      version: '0',
      sourceDocument: 'd',
      sourceDate: '2020-01-01',
      lastReviewed: '2020-01-01',
      sections: [
        { id: 'a', title: 'аааа', blocks: [{ type: 'warning', body: 'аа' }] },
      ],
    } as unknown as Protocol

    const matches = findMatches(collectSearchFields(repeated), 'аа')

    // «аааа» → два непересекающихся вхождения, «аа» → одно; заголовок раньше блока.
    expect(matches.map((match) => `${match.key}@${match.start}`)).toEqual([
      'a:-1:title@0',
      'a:-1:title@2',
      'a:0:body@0',
    ])
    expect(matches.map((match) => match.ordinal)).toEqual([0, 1, 2])
  })
})

/* ------------------------------------------------------------------ */
/* Уровень экрана: панель + подсветка                                  */
/* ------------------------------------------------------------------ */

/**
 * Мини-экран: ровно та связка, что живёт в ProtocolView — состояние поиска
 * раздаётся сверху, панель и рендерер получают его через inject.
 */
const SearchScreen = defineComponent({
  name: 'SearchScreen',
  setup() {
    const protocol = shallowRef<Protocol>(fixture)
    provideProtocolSearch(protocol)
    return () => h('div', [h(ProtocolSearch), h(ProtocolRenderer, { protocol: protocol.value })])
  },
})

async function screenWithQuery(query: string) {
  const wrapper = mount(SearchScreen)
  await wrapper.get('[data-testid="search-input"]').setValue(query)
  return wrapper
}

const activeMatchOrdinal = (wrapper: ReturnType<typeof mount>) =>
  wrapper.get('[data-search-active="true"]').attributes('data-search-match')

describe('ProtocolSearch + подсветка', () => {
  it('без запроса блоки рендерятся как обычно, подсветки нет', () => {
    const wrapper = mount(SearchScreen)

    expect(wrapper.findAll('mark')).toHaveLength(0)
    expect(wrapper.find('[data-testid="search-empty"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="search-counter"]').text()).toBe('0 / 0')
    // Контент на месте: подсветка не подменяет рендер.
    expect(wrapper.text()).toContain('Плашка Альфа (заглушка).')
    expect(wrapper.text()).toContain('Ячейка альфа')
  })

  it('подсвечивает все совпадения и показывает счётчик «N / M»', async () => {
    const wrapper = await screenWithQuery('АЛЬФА')

    expect(wrapper.findAll('mark')).toHaveLength(TOTAL_ALPHA_MATCHES)
    expect(wrapper.get('[data-testid="search-counter"]').text()).toBe(`1 / ${TOTAL_ALPHA_MATCHES}`)
    expect(wrapper.find('[data-testid="search-empty"]').exists()).toBe(false)

    // Разрезание текста на куски не должно добавить ни одного пробела:
    // строка блока с подсветкой посимвольно равна строке без неё.
    expect(wrapper.get('[data-block="warning"]').text()).toBe('Плашка Альфа (заглушка).')
    expect(wrapper.get('[data-block="dosage-table"] tbody td').text()).toBe('Ячейка альфа')
    expect(wrapper.get('#section-one h2').text()).toBe('Секция АЛЬФА (заглушка)')
  })

  it('подсвечивает исходный регистр текста, а не регистр запроса', async () => {
    const wrapper = await screenWithQuery('альфа')
    const highlighted = wrapper.findAll('mark').map((mark) => mark.text())

    expect(highlighted).toContain('АЛЬФА')
    expect(highlighted).toContain('Альфа')
    expect(highlighted).toContain('АльФа')
    expect(highlighted).toContain('альфа')
  })

  it('находит совпадения в разных типах блоков и в заголовке секции', async () => {
    const wrapper = await screenWithQuery('альфа')

    expect(wrapper.findAll('[data-block="text"] mark').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-block="warning"] mark').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-block="timer-note"] mark').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-block="criteria-list"] mark').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-block="dosage-table"] mark').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-block="checklist"] mark').length).toBeGreaterThan(0)
    expect(wrapper.findAll('h2 mark').length).toBeGreaterThan(0)
    // Блок неизвестного типа не подсвечивается: его содержимого на экране нет.
    expect(wrapper.findAll('[data-block="unknown"] mark')).toHaveLength(0)
  })

  it('выделяет активное совпадение отдельно от остальных', async () => {
    const wrapper = await screenWithQuery('альфа')

    expect(wrapper.findAll('[data-search-active="true"]')).toHaveLength(1)
    expect(activeMatchOrdinal(wrapper)).toBe('0')

    const active = wrapper.get('[data-search-active="true"]').attributes('class') ?? ''
    const inactive = wrapper.get('[data-search-active="false"]').attributes('class') ?? ''
    // Какие именно цвета — дело темы; важно, что вид РАЗНЫЙ.
    expect(active).not.toBe(inactive)
  })

  it('next и prev ходят по кольцу: с последнего на первый и обратно', async () => {
    const wrapper = await screenWithQuery('альфа')
    const next = wrapper.get('[data-testid="search-next"]')
    const prev = wrapper.get('[data-testid="search-prev"]')

    for (let step = 1; step < TOTAL_ALPHA_MATCHES; step += 1) {
      await next.trigger('click')
      expect(activeMatchOrdinal(wrapper)).toBe(String(step))
      expect(wrapper.get('[data-testid="search-counter"]').text()).toBe(
        `${step + 1} / ${TOTAL_ALPHA_MATCHES}`,
      )
    }

    // С последнего — на первый.
    await next.trigger('click')
    expect(activeMatchOrdinal(wrapper)).toBe('0')
    expect(wrapper.get('[data-testid="search-counter"]').text()).toBe(`1 / ${TOTAL_ALPHA_MATCHES}`)

    // С первого назад — на последний.
    await prev.trigger('click')
    expect(activeMatchOrdinal(wrapper)).toBe(String(TOTAL_ALPHA_MATCHES - 1))
    expect(wrapper.get('[data-testid="search-counter"]').text()).toBe(
      `${TOTAL_ALPHA_MATCHES} / ${TOTAL_ALPHA_MATCHES}`,
    )
  })

  it('новый запрос возвращает активное совпадение на первое', async () => {
    const wrapper = await screenWithQuery('альфа')
    await wrapper.get('[data-testid="search-next"]').trigger('click')
    expect(activeMatchOrdinal(wrapper)).toBe('1')

    await wrapper.get('[data-testid="search-input"]').setValue('заглушка')
    expect(activeMatchOrdinal(wrapper)).toBe('0')
  })

  it('показывает явное «ничего не найдено» вместо пустоты', async () => {
    const wrapper = await screenWithQuery('абракадабра-которой-нет')

    const empty = wrapper.get('[data-testid="search-empty"]')
    expect(empty.text()).toBe('Ничего не найдено')
    expect(wrapper.findAll('mark')).toHaveLength(0)
    expect(wrapper.get('[data-testid="search-counter"]').text()).toBe('0 / 0')
    expect(wrapper.get('[data-testid="search-next"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="search-prev"]').attributes('disabled')).toBeDefined()
    // Содержимое протокола осталось на экране — это не белый экран (FR-014).
    expect(wrapper.text()).toContain('Ячейка альфа')
  })

  it('спецсимволы в поле ввода не роняют экран и не подсвечивают всё подряд', async () => {
    for (const query of ['.*', '(', '[a-z]', '\\']) {
      const wrapper = await screenWithQuery(query)
      const expected = expectedMatches(query)

      const marks = wrapper.findAll('mark')
      expect(marks.length, `запрос ${JSON.stringify(query)}`).toBe(expected)
      expect(marks.length).toBeLessThan(VISIBLE_TEXTS.length)
      expect(wrapper.get('[data-testid="search-counter"]').text()).toBe(`1 / ${expected}`)
      // Подсвечен ровно введённый набор символов, а не «раскрытый шаблон».
      for (const mark of marks) expect(mark.text()).toBe(query)
      wrapper.unmount()
    }
  })

  it('очистка запроса убирает всю подсветку и состояние «не найдено»', async () => {
    const wrapper = await screenWithQuery('альфа')
    expect(wrapper.findAll('mark')).toHaveLength(TOTAL_ALPHA_MATCHES)

    await wrapper.get('[data-testid="search-clear"]').trigger('click')

    expect(wrapper.findAll('mark')).toHaveLength(0)
    expect(wrapper.find('[data-testid="search-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="search-clear"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="search-counter"]').text()).toBe('0 / 0')
    expect((wrapper.get('[data-testid="search-input"]').element as HTMLInputElement).value).toBe('')
    // Текст блоков вернулся целым куском, без остатков разрезания.
    expect(wrapper.text()).toContain('Плашка Альфа (заглушка).')
  })

  it('вне экрана протокола компонент подсветки рендерит просто текст', () => {
    const wrapper = mount(HighlightedText, { props: { text: 'Текст-заглушка' } })

    expect(wrapper.text()).toBe('Текст-заглушка')
    expect(wrapper.findAll('mark')).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/* SC-005: скорость                                                    */
/* ------------------------------------------------------------------ */

describe('производительность поиска (SC-005)', () => {
  it('укладывается в целевые 100 мс на запрос по реальному демо-протоколу', () => {
    const iterations = 1000
    const queries = ['текст', 'ТЕКСТ', 'раздел', '.*', 'заглушка']

    // Холодный прогон: разбор протокола на поля (один раз на документ).
    const coldStart = performance.now()
    const fields = protocolSearchFields(demoProtocol)
    const cold = performance.now() - coldStart

    const start = performance.now()
    let found = 0
    for (let index = 0; index < iterations; index += 1) {
      found += findMatches(fields, queries[index % queries.length]!).length
    }
    const perIteration = (performance.now() - start) / iterations

    console.log(
      `[perf] полей: ${fields.length}; сборка индекса: ${cold.toFixed(3)} мс; ` +
        `поиск: ${perIteration.toFixed(4)} мс/итерация (${iterations} итераций, ` +
        `${found} совпадений суммарно)`,
    )

    expect(found).toBeGreaterThan(0)
    expect(perIteration).toBeLessThan(100)
    expect(cold).toBeLessThan(100)
  })
})
