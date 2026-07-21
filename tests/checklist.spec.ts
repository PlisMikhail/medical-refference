import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import ChecklistBlock from '../src/components/blocks/ChecklistBlock.vue'
import ProtocolRenderer from '../src/components/ProtocolRenderer.vue'
import { provideChecklistState } from '../src/composables/useChecklistState'
import type { ChecklistBlock as ChecklistBlockData, Protocol } from '../src/types/protocol'

/**
 * Контракт чек-листа (T024).
 *
 * Данные — только заглушки (конституция II/III).
 *
 * Проверяем:
 *  1. отметка появляется по клику и видна (FR-007, первая половина);
 *  2. после unmount + повторного mount отметок НЕТ — состояние эфемерно
 *     (FR-007, вторая половина): и у отдельного блока, и у общего хранилища
 *     экрана протокола;
 *  3. никаких итогов/сумм/процентов не отрисовывается (конституция I);
 *  4. отметки не уезжают ни в localStorage, ни в sessionStorage.
 */

const block: ChecklistBlockData = {
  type: 'checklist',
  items: ['Отметка A', 'Отметка B', 'Отметка C'],
}

const protocol = {
  id: 'fixture-protocol',
  title: 'Заголовок протокола (заглушка)',
  version: '9.9.9-fixture',
  sourceDocument: 'Документ-заглушка',
  sourceDate: '2020-01-01',
  lastReviewed: '2020-02-02',
  sections: [{ id: 'section-one', title: 'Секция 1 (заглушка)', blocks: [block] }],
} satisfies Protocol

/** Экран-обёртка: раздаёт общее хранилище так же, как это делает ProtocolView. */
const ScreenStub = defineComponent({
  name: 'ScreenStub',
  setup() {
    provideChecklistState()
    return () => h(ProtocolRenderer, { protocol })
  },
})

function markedFlags(html: string): string[] {
  return [...html.matchAll(/data-marked="(true|false)"/g)].map((match) => match[1]!)
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('ChecklistBlock', () => {
  it('показывает отметку после клика', async () => {
    const wrapper = mount(ChecklistBlock, {
      props: { block, sectionId: 'section-one', blockIndex: 0 },
    })

    expect(markedFlags(wrapper.html())).toEqual(['false', 'false', 'false'])

    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)

    expect(markedFlags(wrapper.html())).toEqual(['false', 'true', 'false'])
    expect(
      (wrapper.findAll('input[type="checkbox"]')[1]!.element as HTMLInputElement).checked,
    ).toBe(true)
  })

  it('теряет отметки после unmount и повторного mount (FR-007)', async () => {
    const first = mount(ChecklistBlock, {
      props: { block, sectionId: 'section-one', blockIndex: 0 },
    })
    await first.findAll('input[type="checkbox"]')[0]!.setValue(true)
    expect(markedFlags(first.html())).toContain('true')
    first.unmount()

    const second = mount(ChecklistBlock, {
      props: { block, sectionId: 'section-one', blockIndex: 0 },
    })

    expect(markedFlags(second.html())).toEqual(['false', 'false', 'false'])
    expect(
      second
        .findAll('input[type="checkbox"]')
        .every((input) => !(input.element as HTMLInputElement).checked),
    ).toBe(true)
  })

  it('теряет отметки при переоткрытии экрана протокола (общее хранилище)', async () => {
    const first = mount(ScreenStub)
    await first.findAll('input[type="checkbox"]')[2]!.setValue(true)
    expect(markedFlags(first.html())).toEqual(['false', 'false', 'true'])
    first.unmount()

    const second = mount(ScreenStub)

    expect(markedFlags(second.html())).toEqual(['false', 'false', 'false'])
  })

  it('не сохраняет отметки ни в localStorage, ни в sessionStorage', async () => {
    const wrapper = mount(ChecklistBlock, {
      props: { block, sectionId: 'section-one', blockIndex: 0 },
    })
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)

    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('не отрисовывает никаких итогов, сумм и процентов (конституция I)', async () => {
    const wrapper = mount(ChecklistBlock, {
      props: { block, sectionId: 'section-one', blockIndex: 0 },
    })
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)

    const text = wrapper.text()

    // Видимый текст блока — ровно подписи пунктов и ничего сверх них.
    const leftover = block.items.reduce((rest, item) => rest.split(item).join(''), text).trim()
    expect(leftover).toBe('')

    // Прямые проверки на характерные формы интерпретации отметок.
    expect(text).not.toMatch(/\d+\s*(из|\/)\s*\d+/i)
    expect(text).not.toMatch(/%/)
    expect(text).not.toMatch(/итог|всего|сумм|отмечено|выполнено/i)
  })
})
