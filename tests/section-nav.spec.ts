import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProtocolSectionNav from '../src/components/ProtocolSectionNav.vue'
import type { Section } from '../src/types/protocol'

/**
 * Контракт ленты секций (T025/T026).
 *
 * Фикстура — ТОЛЬКО технические заглушки («Секция 1»): медицинского текста в
 * тестах нет и быть не может (конституция II/III).
 *
 * Проверяем ровно то, что делает лента полезной в цейтноте:
 *  1. чип на каждую секцию с её заголовком из данных;
 *  2. тап по чипу уводит к нужной секции (scrollIntoView на её элементе) —
 *     программно, потому что хеш занят роутером;
 *  3. без IntersectionObserver лента не падает, а просто теряет подсветку;
 *  4. три типа критериев дают РАЗНЫЕ классы чипа (какие именно цвета — дело
 *     темы, тест их не фиксирует).
 */

const sections = [
  { id: 'section-one', title: 'Секция 1 (заглушка)', kind: 'default', blocks: [] },
  { id: 'section-two', title: 'Секция 2 (заглушка)', kind: 'inclusion', blocks: [] },
  { id: 'section-three', title: 'Секция 3 (заглушка)', kind: 'exclusion-absolute', blocks: [] },
  { id: 'section-four', title: 'Секция 4 (заглушка)', kind: 'exclusion-relative', blocks: [] },
  { id: 'section-five', title: 'Секция 5 (заглушка)', blocks: [] },
] as unknown as Section[]

/** Кладёт в документ элементы секций — цели навигации живут вне компонента. */
function mountSectionTargets(): Map<string, ReturnType<typeof vi.fn>> {
  const spies = new Map<string, ReturnType<typeof vi.fn>>()

  for (const section of sections) {
    const element = document.createElement('section')
    element.id = section.id
    const spy = vi.fn()
    element.scrollIntoView = spy
    spies.set(section.id, spy)
    document.body.appendChild(element)
  }

  return spies
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function chipOf(wrapper: ReturnType<typeof mount>, id: string) {
  return wrapper.get(`[data-section-chip="${id}"]`)
}

describe('ProtocolSectionNav', () => {
  it('рендерит по одному чипу на секцию с заголовком из данных', () => {
    const wrapper = mount(ProtocolSectionNav, { props: { sections } })
    const chips = wrapper.findAll('[data-section-chip]')

    expect(chips).toHaveLength(sections.length)
    expect(chips.map((chip) => chip.text())).toEqual(sections.map((section) => section.title))
  })

  it('по тапу скроллит к элементу соответствующей секции', async () => {
    const spies = mountSectionTargets()
    const wrapper = mount(ProtocolSectionNav, { props: { sections }, attachTo: document.body })

    await chipOf(wrapper, 'section-three').trigger('click')

    expect(spies.get('section-three')).toHaveBeenCalledTimes(1)
    expect(spies.get('section-three')).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
    // Соседние секции не трогаем — переход строго адресный.
    expect(spies.get('section-one')).not.toHaveBeenCalled()
    expect(spies.get('section-two')).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('не падает и остаётся кликабельной без IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const spies = mountSectionTargets()

    const wrapper = mount(ProtocolSectionNav, { props: { sections }, attachTo: document.body })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-section-chip]')).toHaveLength(sections.length)

    await chipOf(wrapper, 'section-two').trigger('click')
    expect(spies.get('section-two')).toHaveBeenCalledTimes(1)

    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('даёт трём типам критериев различающиеся классы чипа', () => {
    const wrapper = mount(ProtocolSectionNav, { props: { sections } })

    const classesFor = (id: string) => chipOf(wrapper, id).attributes('class') ?? ''
    const inclusion = classesFor('section-two')
    const absolute = classesFor('section-three')
    const relative = classesFor('section-four')
    const neutral = classesFor('section-five')

    // Конкретные цвета — дело темы; здесь важно только, что они РАЗНЫЕ.
    expect(new Set([inclusion, absolute, relative, neutral]).size).toBe(4)
    // Секция без kind остаётся нейтральной — как и явный 'default'.
    expect(neutral).toBe(classesFor('section-one'))
  })
})
