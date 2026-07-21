import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProtocolRenderer from '../src/components/ProtocolRenderer.vue'
import type { Protocol } from '../src/types/protocol'

/**
 * Контракт каркаса рендерера (T023).
 *
 * Фикстура ниже — ТОЛЬКО технические заглушки («Пункт A», «Ячейка 1-1»):
 * медицинского текста в тестах нет и быть не может (конституция II/III).
 *
 * Проверяем три вещи:
 *  1. все шесть типов блоков v1 рендерятся и содержимое каждого видно;
 *  2. неизвестный тип блока даёт ВИДИМЫЙ фоллбэк с фактической строкой типа
 *     (FR-006) — молчаливый пропуск блока запрещён;
 *  3. `criteria-list` с нераспознанным `kind` не роняет рендер и показывает
 *     пометку (edge case спеки).
 */

// `as unknown as Protocol`: фикстура намеренно содержит данные, которых нет в
// union v1 — блок неизвестного типа и неизвестный `kind`. Именно они и
// проверяются; строгие типы здесь мешали бы воспроизвести реальный случай
// «данные новее кода».
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
      title: 'Секция 1 (заглушка)',
      kind: 'default',
      blocks: [
        { type: 'text', body: 'Абзац A (заглушка).\n\nАбзац B (заглушка).' },
        { type: 'warning', body: 'Плашка предупреждения (заглушка).' },
        { type: 'timer-note', label: 'Метка окна', body: 'Заметка об окне (заглушка).' },
      ],
    },
    {
      id: 'section-two',
      title: 'Секция 2 (заглушка)',
      kind: 'inclusion',
      blocks: [
        { type: 'criteria-list', kind: 'inclusion', items: ['Пункт A', 'Пункт B'] },
        {
          type: 'dosage-table',
          title: 'Заголовок таблицы (заглушка)',
          columns: ['Колонка 1', 'Колонка 2'],
          rows: [
            ['Ячейка 1-1', 'Ячейка 1-2'],
            ['Ячейка 2-1', 'Ячейка 2-2'],
          ],
        },
        { type: 'checklist', items: ['Отметка A', 'Отметка B'] },
      ],
    },
    {
      id: 'section-three',
      title: 'Секция 3 (заглушка)',
      blocks: [
        { type: 'bogus-type', body: 'Содержимое из будущего формата' },
        { type: 'criteria-list', kind: 'nonexistent-kind', items: ['Пункт X'] },
      ],
    },
  ],
} as unknown as Protocol

function render() {
  return mount(ProtocolRenderer, { props: { protocol: fixture } })
}

describe('ProtocolRenderer', () => {
  it('рендерит секции с якорями id для навигации', () => {
    const wrapper = render()

    expect(wrapper.find('section#section-one').exists()).toBe(true)
    expect(wrapper.find('section#section-two').exists()).toBe(true)
    expect(wrapper.find('section#section-three').exists()).toBe(true)
    expect(wrapper.text()).toContain('Секция 1 (заглушка)')
  })

  it('рендерит блок text абзацами по пустой строке', () => {
    const wrapper = render()
    const paragraphs = wrapper.findAll('[data-block="text"] p')

    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]!.text()).toBe('Абзац A (заглушка).')
    expect(paragraphs[1]!.text()).toBe('Абзац B (заглушка).')
  })

  it('рендерит блок warning отдельной плашкой', () => {
    const wrapper = render()
    const warning = wrapper.find('[data-block="warning"]')

    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('Плашка предупреждения (заглушка).')
  })

  it('рендерит блок timer-note с опциональной меткой и без таймера', () => {
    const wrapper = render()
    const note = wrapper.find('[data-block="timer-note"]')

    expect(note.exists()).toBe(true)
    expect(note.find('[data-testid="timer-note-label"]').text()).toBe('Метка окна')
    expect(note.text()).toContain('Заметка об окне (заглушка).')
  })

  it('рендерит блок criteria-list всеми пунктами', () => {
    const wrapper = render()
    const items = wrapper.findAll('[data-block="criteria-list"] li')

    expect(items.map((item) => item.text())).toContain('Пункт A')
    expect(items.map((item) => item.text())).toContain('Пункт B')
  })

  it('рендерит блок dosage-table строковыми ячейками в собственном скролл-контейнере', () => {
    const wrapper = render()
    const table = wrapper.find('[data-block="dosage-table"]')

    expect(table.text()).toContain('Заголовок таблицы (заглушка)')
    expect(table.findAll('th').map((th) => th.text())).toEqual(['Колонка 1', 'Колонка 2'])
    expect(table.findAll('td').map((td) => td.text())).toEqual([
      'Ячейка 1-1',
      'Ячейка 1-2',
      'Ячейка 2-1',
      'Ячейка 2-2',
    ])
    // Горизонтальный скролл живёт внутри блока — страница не едет вбок.
    expect(table.find('.overflow-x-auto').exists()).toBe(true)
  })

  it('рендерит блок checklist интерактивными пунктами', () => {
    const wrapper = render()
    const checklist = wrapper.find('[data-block="checklist"]')

    expect(checklist.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(checklist.text()).toContain('Отметка A')
    expect(checklist.text()).toContain('Отметка B')
  })

  it('рендерит все шесть типов блоков v1 — ни один не пропущен', () => {
    const wrapper = render()

    for (const type of ['text', 'warning', 'timer-note', 'criteria-list', 'dosage-table', 'checklist']) {
      expect(wrapper.find(`[data-block="${type}"]`).exists()).toBe(true)
    }
  })

  it('показывает видимый фоллбэк с фактическим типом для неизвестного блока (FR-006)', () => {
    const wrapper = render()
    const fallback = wrapper.find('[data-block="unknown"]')

    expect(fallback.exists()).toBe(true)
    expect(fallback.text()).toContain('Неподдерживаемый тип блока')
    // Именно строка типа из данных, а не обобщённое «неизвестный блок».
    expect(fallback.find('[data-testid="unknown-block-type"]').text()).toBe('bogus-type')
    expect(wrapper.text()).toContain('bogus-type')
  })

  it('не роняет рендер на нераспознанном kind и показывает пометку', () => {
    const wrapper = render()
    const note = wrapper.find('[data-testid="criteria-unknown-kind"]')

    expect(note.exists()).toBe(true)
    expect(note.text()).toContain('nonexistent-kind')
    // Список всё равно отрисован — данные не теряются.
    expect(wrapper.text()).toContain('Пункт X')
  })
})
