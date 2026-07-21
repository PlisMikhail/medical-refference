import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import App from '../src/App.vue'
import { DISCLAIMER_STORAGE_KEY } from '../src/composables/useDisclaimer'
import router from '../src/router'

/**
 * До подтверждения дисклеймера App НЕ рендерит ни шапку, ни `<router-view>`
 * (T029, FR-009) — это проверяется в tests/disclaimer.spec.ts. Здесь предметом
 * теста остаётся каркас приложения, поэтому «первый запуск» уже пройден:
 * подтверждение кладётся в localStorage ровно так, как его пишет
 * `useDisclaimer` — ISO-датой.
 */
beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, new Date().toISOString())
})

describe('App', () => {
  it('монтируется с роутером и рендерит заголовок приложения', async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('Med Helper')
  })
})
