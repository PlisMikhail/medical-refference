import { shallowRef } from 'vue'

import type { Block, Protocol } from '@/types/protocol'
import { KNOWN_BLOCK_TYPES } from '@/types/protocol'

/**
 * DEV-рубеж валидации контента (второй после `npm run validate:data`).
 *
 * Всё тело работы спрятано за `import.meta.env.DEV`, а Ajv и схема тянутся
 * ТОЛЬКО динамическим `import()`. В прод-сборке `import.meta.env.DEV`
 * заменяется на `false`, ветка вырезается — Ajv в бандл не попадает
 * (проверяется grep'ом по `dist/`). Ajv остаётся devDependency.
 */

export interface DevValidationIssue {
  /** Файл, к которому относится проблема: `<id>.json`. */
  file: string
  /** JSON-путь внутри документа (`instancePath` из Ajv). */
  instancePath: string
  message: string
}

/** Типы блоков v1 — всё прочее валидно, но заслуживает предупреждения. */
const knownBlockTypes = new Set<string>(KNOWN_BLOCK_TYPES)

function collectUnknownBlockTypes(protocol: Protocol): string[] {
  const unknown = new Set<string>()

  for (const section of protocol.sections ?? []) {
    for (const block of (section.blocks ?? []) as Block[]) {
      if (typeof block?.type === 'string' && !knownBlockTypes.has(block.type)) {
        unknown.add(block.type)
      }
    }
  }

  return [...unknown]
}

export function useDevValidation() {
  const issues = shallowRef<DevValidationIssue[]>([])
  const unknownBlockTypes = shallowRef<string[]>([])

  /**
   * Валидирует загруженный протокол против канонической схемы.
   * В прод-сборке — no-op.
   */
  async function validate(protocol: Protocol | null): Promise<DevValidationIssue[]> {
    issues.value = []
    unknownBlockTypes.value = []

    if (!import.meta.env.DEV || !protocol) return issues.value

    const file = `${protocol.id ?? 'unknown'}.json`

    // Неизвестный тип блока — ПРЕДУПРЕЖДЕНИЕ, а не ошибка:
    // расширяемость формата — контракт (FR-006, contracts/README.md §1).
    const unknown = collectUnknownBlockTypes(protocol)
    unknownBlockTypes.value = unknown
    if (unknown.length > 0) {
      console.warn(
        `[dev-validation] ${file}: блоки неизвестного типа (будут показаны фоллбэком): ` +
          unknown.map((type) => `«${type}»`).join(', '),
      )
    }

    try {
      const [{ default: Ajv2020 }, { default: addFormats }, { default: schema }] = await Promise.all([
        import('ajv/dist/2020'),
        import('ajv-formats'),
        import('../data/schema/protocol.schema.json'),
      ])

      const ajv = new Ajv2020({ allErrors: true, strict: false })
      addFormats(ajv)

      const validateProtocol = ajv.compile(schema)
      if (!validateProtocol(protocol)) {
        issues.value = (validateProtocol.errors ?? []).map((error) => ({
          file,
          instancePath: error.instancePath || '/',
          message: error.message ?? 'схема не пройдена',
        }))

        console.error(
          `[dev-validation] ${file}: протокол не соответствует схеме:\n` +
            issues.value.map((i) => `  ${i.instancePath} — ${i.message}`).join('\n'),
        )
      }
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      issues.value = [
        { file, instancePath: '/', message: `dev-валидация не выполнена: ${detail}` },
      ]
      console.error(`[dev-validation] ${file}: ${detail}`)
    }

    return issues.value
  }

  return { issues, unknownBlockTypes, validate }
}
