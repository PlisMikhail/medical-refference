import { readonly, ref, shallowRef } from 'vue'

import type { IndexEntry, Protocol, ProtocolIndex } from '@/types/protocol'

import indexJson from '../data/protocols/index.json'

/**
 * Доступ к контенту протоколов.
 *
 * Конституция IV: НИКАКИХ сетевых запросов. Реестр импортируется eager
 * (нужен главному экрану сразу), файлы протоколов — через `import.meta.glob`
 * без `eager`, то есть попадают в отдельные чанки одной и той же сборки и
 * подгружаются локально. Сетевых запросов здесь нет и быть не должно.
 */

/** Реестр протоколов — единственный источник списка на главном экране. */
const registry: ProtocolIndex = indexJson

/**
 * Все JSON-файлы протоколов, известные сборщику. Ключи — пути вида
 * `../data/protocols/<id>.json`; значения — ленивые загрузчики чанка.
 * `index.json` исключён явно: это реестр (импортируется eager выше),
 * а не протокол.
 */
const protocolModules = import.meta.glob<{ default: unknown }>([
  '../data/protocols/*.json',
  '!../data/protocols/index.json',
])

/** id (== имя файла без расширения) → ленивый загрузчик. */
const loaderById = new Map<string, () => Promise<{ default: unknown }>>(
  Object.entries(protocolModules).map(
    ([path, loader]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), loader] as const,
  ),
)

export type ProtocolErrorCode =
  /** id отсутствует в `index.json` — например, битый deep-link. */
  | 'not-in-registry'
  /** Запись в реестре есть, а файла `<id>.json` в сборке нет. */
  | 'file-missing'
  /** Файл есть, но чанк не загрузился / содержимое не разобралось. */
  | 'load-failed'

export interface ProtocolLoadError {
  code: ProtocolErrorCode
  /** Запрошенный id — для отображения и логов. */
  id: string
  /** Готовое к показу сообщение на русском. */
  message: string
}

/** Список записей реестра в исходном порядке файла (= порядок в UI). */
export function listProtocols(): readonly IndexEntry[] {
  return registry.protocols
}

/** Запись реестра по id или `undefined`. */
export function findIndexEntry(id: string): IndexEntry | undefined {
  return registry.protocols.find((entry) => entry.id === id)
}

export function useProtocols() {
  const entries = shallowRef<readonly IndexEntry[]>(registry.protocols)
  const entry = shallowRef<IndexEntry | null>(null)
  const protocol = shallowRef<Protocol | null>(null)
  const loading = ref(false)
  const error = shallowRef<ProtocolLoadError | null>(null)

  function fail(code: ProtocolErrorCode, id: string, message: string) {
    protocol.value = null
    error.value = { code, id, message }
  }

  /**
   * Загружает протокол по id. Состояния loading/error/data — реактивные;
   * повторные вызовы (смена route param) перетирают предыдущий результат.
   */
  async function loadProtocol(id: string): Promise<Protocol | null> {
    loading.value = true
    error.value = null
    protocol.value = null

    const registryEntry = findIndexEntry(id)
    entry.value = registryEntry ?? null

    try {
      if (!registryEntry) {
        fail('not-in-registry', id, `Протокол «${id}» не найден в реестре протоколов.`)
        return null
      }

      const loader = loaderById.get(id)
      if (!loader) {
        fail(
          'file-missing',
          id,
          `Протокол «${id}» указан в реестре, но файл ${id}.json отсутствует в сборке.`,
        )
        return null
      }

      const loaded = (await loader()).default
      if (loaded === null || typeof loaded !== 'object') {
        fail('load-failed', id, `Файл ${id}.json повреждён: ожидался JSON-объект протокола.`)
        return null
      }

      protocol.value = loaded as Protocol
      return protocol.value
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      fail('load-failed', id, `Не удалось загрузить протокол «${id}»: ${detail}`)
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    entries,
    entry,
    protocol,
    loading: readonly(loading),
    error,
    loadProtocol,
  }
}
