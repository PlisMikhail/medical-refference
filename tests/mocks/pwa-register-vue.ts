import { ref } from 'vue'

/**
 * Тестовый двойник виртуального модуля `virtual:pwa-register/vue`.
 *
 * ЗАЧЕМ: модуль генерирует vite-plugin-pwa на лету во время сборки; в Vitest
 * плагин не участвует, и импорт из UpdateBanner.vue упал бы на резолве. Алиас
 * в `test.alias` (vite.config.ts) подставляет сюда этот файл — контракт тот же,
 * состояние доступно тесту напрямую, service worker не поднимается.
 *
 * Состояние модульное (как и у настоящего useRegisterSW — там один регистратор
 * на приложение), поэтому тест обязан звать `resetRegisterSW()` перед каждым
 * случаем.
 */

export const needRefresh = ref(false)
export const offlineReady = ref(false)

/** Аргументы, с которыми компонент вызвал применение обновления. */
export const updateCalls = ref<boolean[]>([])

export function useRegisterSW() {
  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async (reloadPage?: boolean): Promise<void> => {
      updateCalls.value.push(reloadPage ?? false)
    },
  }
}

export function resetRegisterSW(): void {
  needRefresh.value = false
  offlineReady.value = false
  updateCalls.value = []
}
