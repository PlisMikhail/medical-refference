import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ProtocolMeta from '../src/components/ProtocolMeta.vue'
import { listProtocols } from '../src/composables/useProtocols'
import type { Protocol } from '../src/types/protocol'

/**
 * Прослеживаемость контента (конституция V, FR-002).
 *
 * Схема не даёт создать протокол без четырёх полей — этот тест сторожит
 * вторую половину требования: что они ДОХОДЯТ ДО ЭКРАНА. Поля могут
 * незаметно исчезнуть из вёрстки при рефакторинге, и валидатор данных
 * этого не заметит: с точки зрения данных всё в порядке.
 */
const protocol = {
  id: 'p',
  title: 'Заголовок',
  version: '3.1.4',
  sourceDocument: 'Название исходного документа',
  sourceDate: '2026-01-15',
  lastReviewed: '2026-07-20',
  sections: [],
} satisfies Protocol

describe('прослеживаемость протокола', () => {
  it('показывает все четыре поля прослеживаемости', () => {
    const text = mount(ProtocolMeta, { props: { protocol } }).text()

    expect(text).toContain('3.1.4')
    expect(text).toContain('Название исходного документа')
    expect(text).toContain('2026-01-15')
    expect(text).toContain('2026-07-20')
  })

  it('показывает их сразу, без раскрытия и без прокрутки внутри блока', () => {
    const wrapper = mount(ProtocolMeta, { props: { protocol } })

    // details/summary или overflow спрятали бы метаданные за действием
    expect(wrapper.find('details').exists()).toBe(false)
    expect(wrapper.html()).not.toMatch(/overflow-(y-)?(auto|scroll|hidden)/)
  })

  it('каждая запись реестра несёт версию и дату источника (FR-001)', () => {
    const entries = listProtocols()
    expect(entries.length).toBeGreaterThan(0)

    for (const entry of entries) {
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.version.length).toBeGreaterThan(0)
      expect(entry.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
