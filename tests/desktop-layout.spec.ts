import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProtocolSectionNav from '../src/components/ProtocolSectionNav.vue'
import type { Section } from '../src/types/protocol'

/**
 * Раскладка навигации (фича 004).
 *
 * Фикстура — ТОЛЬКО технические заглушки: медицинского текста в тестах нет
 * и быть не может (конституция II/III).
 *
 * Здесь проверяется ровно то, чего не видит ни одна другая проверка:
 *
 *  1. на широком экране рендерится оглавление, на узком — лента чипов;
 *  2. в DOM живёт РОВНО ОДНО представление. Это не косметика: два комплекта
 *     кнопок на одни и те же секции сломали бы поиск по странице, табуляцию,
 *     скринридер и однозначность селекторов, на которых держится подсветка
 *     активной секции (research.md § R2);
 *  3. без `matchMedia` показывается мобильная раскладка. Дефолт выбран
 *     осознанно: лента работает на экране любой ширины, а оглавление на узком
 *     отняло бы половину места у текста (research.md § R3).
 *
 * Что этот тест НЕ проверяет: как оно выглядит. Ширины колонок, липкость
 * и отступ якоря — в сценариях приёмки quickstart.md, глазами.
 */

const sections = [
  { id: 'section-one', title: 'Секция 1 (заглушка)', kind: 'default', blocks: [] },
  { id: 'section-two', title: 'Секция 2 (заглушка)', kind: 'inclusion', blocks: [] },
  { id: 'section-three', title: 'Секция 3 (заглушка)', kind: 'exclusion-absolute', blocks: [] },
] as unknown as Section[]

/**
 * Подменяет `matchMedia` так, чтобы медиазапрос совпадал или не совпадал.
 * `addEventListener`/`removeEventListener` обязаны существовать: композабл
 * подписывается на изменение, и без них компонент упал бы при монтировании.
 */
function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('раскладка навигации по секциям', () => {
  it('на широком экране показывает оглавление и не показывает ленту', () => {
    stubMatchMedia(true)
    const wrapper = mount(ProtocolSectionNav, { props: { sections } })

    expect(wrapper.get('[data-testid="section-nav"]').attributes('data-nav-layout')).toBe('sidebar')
    expect(wrapper.findAll('[data-nav-layout="strip"]')).toHaveLength(0)
  })

  it('на узком экране показывает ленту и не показывает оглавление', () => {
    stubMatchMedia(false)
    const wrapper = mount(ProtocolSectionNav, { props: { sections } })

    expect(wrapper.get('[data-testid="section-nav"]').attributes('data-nav-layout')).toBe('strip')
    expect(wrapper.findAll('[data-nav-layout="sidebar"]')).toHaveLength(0)
  })

  /**
   * Безопасный дефолт (research.md § R3). Заодно объясняет, почему все
   * остальные тесты навигации продолжают видеть привычную ленту и не
   * потребовали ни одной правки — это и есть SC-003.
   */
  it('без matchMedia откатывается на мобильную раскладку', () => {
    vi.stubGlobal('matchMedia', undefined)
    const wrapper = mount(ProtocolSectionNav, { props: { sections } })

    expect(wrapper.get('[data-testid="section-nav"]').attributes('data-nav-layout')).toBe('strip')
  })

  /**
   * Главное структурное требование фичи (FR-003): секция представлена в DOM
   * ровно один раз, в какой бы раскладке ни находилось приложение.
   */
  it('в любой раскладке даёт ровно одну кнопку на секцию', () => {
    for (const wide of [true, false]) {
      stubMatchMedia(wide)
      const wrapper = mount(ProtocolSectionNav, { props: { sections } })

      const buttons = wrapper.findAll('[data-section-chip]')
      expect(buttons, `широкий экран: ${wide}`).toHaveLength(sections.length)

      const ids = buttons.map((button) => button.attributes('data-section-chip'))
      expect(new Set(ids).size, `широкий экран: ${wide}`).toBe(sections.length)

      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })

  /**
   * Цветовая маркировка типов секций — не украшение: по ней врач отличает
   * показания от противопоказаний. При переезде в оглавление она обязана
   * сохраниться (FR-009). Конкретные цвета тест не фиксирует — это дело темы.
   */
  it('сохраняет маркировку типа секции в оглавлении', () => {
    stubMatchMedia(true)
    const wrapper = mount(ProtocolSectionNav, { props: { sections } })

    const kinds = wrapper
      .findAll('[data-section-chip]')
      .map((button) => button.attributes('data-chip-kind'))

    expect(kinds).toEqual(['default', 'inclusion', 'exclusion-absolute'])

    const classesOf = (id: string) =>
      wrapper.get(`[data-section-chip="${id}"]`).attributes('class') ?? ''
    expect(classesOf('section-two')).not.toBe(classesOf('section-three'))
  })

  /**
   * Переход по клику — общий для обоих представлений (FR-007). Если оглавление
   * когда-нибудь заведёт собственный обработчик, этот тест это заметит.
   */
  it('в оглавлении клик уводит к секции так же, как тап по чипу', async () => {
    stubMatchMedia(true)

    const target = document.createElement('section')
    target.id = 'section-two'
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView
    document.body.appendChild(target)

    const wrapper = mount(ProtocolSectionNav, { props: { sections } })
    await wrapper.get('[data-section-chip="section-two"]').trigger('click')

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })
})
