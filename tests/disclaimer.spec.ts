import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../src/App.vue'
import DisclaimerGate from '../src/components/DisclaimerGate.vue'
import { DISCLAIMER_STORAGE_KEY } from '../src/composables/useDisclaimer'
import { listProtocols } from '../src/composables/useProtocols'
import { DISCLAIMER_TEXT } from '../src/constants/disclaimer'
import router from '../src/router'

/**
 * Контракт дисклеймера первого запуска (T028/T029, FR-009, SC-006).
 *
 * Проверяем ровно то, ради чего он существует:
 *  1. без подтверждения контент НЕДОСТУПЕН — не «прикрыт», а отсутствует в DOM;
 *  2. подтверждение открывает контент и сохраняется ISO-датой в localStorage;
 *  3. при следующем запуске дисклеймера нет (SC-006);
 *  4. недоступное/бросающее хранилище не роняет приложение и не превращает
 *     гейт в глухую стену;
 *  5. формулировка в гейте и в футере — одна и та же строка-константа.
 *
 * Медицинского текста в тестах нет: единственные строки — служебные
 * («Демонстрационный протокол» из реестра-заглушки) и сам дисклеймер.
 */

/** Заголовок демо-протокола из реестра — маркер того, что контент отрисован. */
const demoTitle = listProtocols()[0]?.title ?? ''

const gate = '[data-testid="disclaimer-gate"]'
const confirm = '[data-testid="disclaimer-accept"]'
const protocolList = '[data-testid="protocol-list"]'

/** Монтирует приложение на главном экране с догруженным ленивым HomeView. */
async function mountApp() {
  await router.push('/')
  await router.isReady()

  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()

  return wrapper
}

/** Хранилище, которое бросает на любом обращении (приватный режим, квота, WebView). */
function throwingStorage(): Storage {
  const boom = (): never => {
    throw new Error('storage is unavailable')
  }

  return {
    get length(): number {
      return boom()
    },
    key: boom,
    getItem: boom,
    setItem: boom,
    removeItem: boom,
    clear: boom,
  } as unknown as Storage
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  // Гейт блокирует прокрутку body — не оставляем след между тестами.
  document.body.style.overflow = ''
})

describe('DisclaimerGate + useDisclaimer', () => {
  it('без подтверждения показывает гейт, а контент в DOM отсутствует', async () => {
    const wrapper = await mountApp()

    expect(wrapper.find(gate).exists()).toBe(true)

    // Контента нет вообще: ни списка протоколов, ни шапки, ни футера.
    expect(wrapper.find(protocolList).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'RouterView' }).exists()).toBe(false)
    expect(wrapper.text()).not.toContain(demoTitle)
    expect(wrapper.text()).not.toContain('Med Helper')
    expect(wrapper.find('[data-testid="footer-disclaimer"]').exists()).toBe(false)
    expect(wrapper.find('header').exists()).toBe(false)
  })

  it('по подтверждению убирает гейт, открывает контент и пишет ISO-дату', async () => {
    const wrapper = await mountApp()

    await wrapper.get(confirm).trigger('click')
    await flushPromises()

    expect(wrapper.find(gate).exists()).toBe(false)
    expect(wrapper.find(protocolList).exists()).toBe(true)
    expect(wrapper.text()).toContain(demoTitle)

    const stored = window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)
    expect(stored).not.toBeNull()
    // Значение — именно ISO-дата (data-model), а не «true» и не таймстамп.
    expect(Number.isNaN(Date.parse(stored!))).toBe(false)
    expect(new Date(stored!).toISOString()).toBe(stored)
  })

  it('при следующем запуске дисклеймер не показывается (SC-006)', async () => {
    const first = await mountApp()
    await first.get(confirm).trigger('click')
    first.unmount()

    // Новый «запуск» приложения: состояние читается из localStorage заново.
    const second = await mountApp()

    expect(second.find(gate).exists()).toBe(false)
    expect(second.find(protocolList).exists()).toBe(true)
  })

  it('с предзаполненным хранилищем не показывает гейт ни на мгновение', async () => {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, new Date().toISOString())

    const wrapper = await mountApp()

    expect(wrapper.findComponent(DisclaimerGate).exists()).toBe(false)
    expect(wrapper.find(protocolList).exists()).toBe(true)
  })

  it('считает мусор в ключе отсутствием подтверждения (безопасный дефолт)', async () => {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'yes')

    const wrapper = await mountApp()

    expect(wrapper.find(gate).exists()).toBe(true)
  })

  it('не падает, когда localStorage бросает и на чтении, и на записи', async () => {
    vi.stubGlobal('localStorage', throwingStorage())

    const wrapper = await mountApp()

    // Чтение упало → безопасный дефолт: дисклеймер показан.
    expect(wrapper.find(gate).exists()).toBe(true)
    expect(wrapper.find(protocolList).exists()).toBe(false)

    // Запись упадёт, но подтверждение обязано открыть сессию: гейт не стена.
    await wrapper.get(confirm).trigger('click')
    await flushPromises()

    expect(wrapper.find(gate).exists()).toBe(false)
    expect(wrapper.find(protocolList).exists()).toBe(true)
    expect(wrapper.text()).toContain(demoTitle)
  })

  it('не падает, когда бросает само обращение к localStorage', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get(): Storage {
        throw new Error('access to storage is denied')
      },
    })

    try {
      const wrapper = await mountApp()

      expect(wrapper.find(gate).exists()).toBe(true)

      await wrapper.get(confirm).trigger('click')
      await flushPromises()

      expect(wrapper.find(gate).exists()).toBe(false)
      expect(wrapper.find(protocolList).exists()).toBe(true)
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  it('показывает в гейте и в футере ОДНУ И ТУ ЖЕ строку дисклеймера', async () => {
    const wrapper = await mountApp()

    const gateText = wrapper.get('[data-testid="disclaimer-text"]').text()

    await wrapper.get(confirm).trigger('click')
    await flushPromises()

    const footerText = wrapper.get('[data-testid="footer-disclaimer"]').text()

    expect(gateText).toBe(DISCLAIMER_TEXT)
    expect(footerText).toBe(DISCLAIMER_TEXT)
    expect(gateText).toBe(footerText)
  })

  it('даёт кнопке подтверждения тач-таргет ≥44px (FR-012)', () => {
    const wrapper = mount(DisclaimerGate)
    const button = wrapper.get(confirm)

    // 44px живёт в токене --spacing-touch (утилита `touch-target` в theme.css).
    expect(button.classes()).toContain('touch-target')
    expect(button.attributes('type')).toBe('button')

    wrapper.unmount()
  })

  it('сам по себе ничего не хранит и лишь сообщает о подтверждении наверх', async () => {
    const wrapper = mount(DisclaimerGate)

    await wrapper.get(confirm).trigger('click')

    expect(wrapper.emitted('accept')).toHaveLength(1)
    // Хранение — дело композабла: компонент в localStorage не лезет.
    expect(window.localStorage.length).toBe(0)

    wrapper.unmount()
  })

  it('снимает блокировку прокрутки после закрытия', async () => {
    const wrapper = await mountApp()
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.get(confirm).trigger('click')
    await flushPromises()

    expect(document.body.style.overflow).toBe('')
  })
})
