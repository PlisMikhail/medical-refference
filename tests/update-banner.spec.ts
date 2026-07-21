import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import UpdateBanner from '../src/components/UpdateBanner.vue'
import {
  needRefresh,
  offlineReady,
  resetRegisterSW,
  updateCalls,
} from './mocks/pwa-register-vue'

/**
 * Конституция IV: обновление кэша выполняется ТОЛЬКО с явным уведомлением и
 * явным действием пользователя. Тест сторожит обе половины: пока обновления
 * нет — на экране пусто; когда есть — есть кнопка, и только её нажатие
 * запускает применение.
 *
 * Виртуальный модуль `virtual:pwa-register/vue` подменён двойником через
 * `test.alias` в vite.config.ts.
 */
beforeEach(() => {
  resetRegisterSW()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('UpdateBanner', () => {
  it('не рендерит ничего, пока обновления нет', () => {
    const wrapper = mount(UpdateBanner)

    expect(wrapper.find('[data-testid="update-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="offline-ready-notice"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('показывает «Доступно обновление» с кнопкой применения, когда SW ждёт', async () => {
    const wrapper = mount(UpdateBanner)

    needRefresh.value = true
    await nextTick()

    expect(wrapper.get('[data-testid="update-banner"]').text()).toContain('Доступно обновление')
    expect(wrapper.get('[data-testid="update-banner-apply"]').text()).toBe('Обновить')
  })

  it('применяет обновление только по нажатию кнопки', async () => {
    needRefresh.value = true
    const wrapper = mount(UpdateBanner)
    await nextTick()

    // Сам факт появления баннера ничего не обновляет — молчаливого наката нет.
    expect(updateCalls.value).toEqual([])

    await wrapper.get('[data-testid="update-banner-apply"]').trigger('click')

    expect(updateCalls.value).toEqual([true])
  })

  it('игнорирует повторные нажатия, пока обновление применяется', async () => {
    needRefresh.value = true
    const wrapper = mount(UpdateBanner)
    await nextTick()

    const button = wrapper.get('[data-testid="update-banner-apply"]')
    await button.trigger('click')
    await button.trigger('click')

    expect(updateCalls.value).toEqual([true])
  })

  it('показывает офлайн-готовность и сам убирает её через таймаут', async () => {
    vi.useFakeTimers()
    const wrapper = mount(UpdateBanner)

    offlineReady.value = true
    await nextTick()
    expect(wrapper.get('[data-testid="offline-ready-notice"]').text()).toContain('без сети')

    vi.advanceTimersByTime(6000)
    await nextTick()

    expect(wrapper.find('[data-testid="offline-ready-notice"]').exists()).toBe(false)
  })

  it('уступает место обновлению, если пришло и то и другое', async () => {
    const wrapper = mount(UpdateBanner)

    offlineReady.value = true
    needRefresh.value = true
    await nextTick()

    expect(wrapper.find('[data-testid="offline-ready-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="update-banner"]').exists()).toBe(true)
  })
})
