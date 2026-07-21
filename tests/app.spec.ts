import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from '../src/App.vue'
import router from '../src/router'

describe('App', () => {
  it('монтируется с роутером и рендерит заголовок приложения', async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('Med Helper')
  })
})
