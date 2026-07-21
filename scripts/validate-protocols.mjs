#!/usr/bin/env node
/**
 * Валидация контента протоколов — рубеж сборки и CI (конституция II/V,
 * data-model.md § «Инварианты»).
 *
 * Проверяет:
 *   1. схемную валидность `index.json` и каждого `<id>.json`;
 *   2. биекцию «реестр ↔ файлы» в обе стороны;
 *   3. строгое равенство `title` / `version` / `sourceDate` в реестре и файле;
 *   4. `id` внутри файла == имя файла; уникальность `section.id` в протоколе.
 *
 * Вывод — по одной понятной строке на проблему: файл + путь + сообщение.
 * Exit code: 0 — всё чисто, 1 — есть хотя бы одна проблема.
 *
 * Скрипт намеренно на чистом Node ESM (без TS/Vite): он обязан работать
 * в CI до и независимо от сборки приложения.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)))
const SCHEMA_DIR = join(ROOT, 'src/data/schema')
const PROTOCOLS_DIR = join(ROOT, 'src/data/protocols')
const INDEX_FILE = join(PROTOCOLS_DIR, 'index.json')

/** Собранные проблемы: { file, path, message }. */
const problems = []

/**
 * @param {string} file абсолютный путь к файлу
 * @param {string} path instancePath или логическое место проблемы
 * @param {string} message человекочитаемое описание
 */
function report(file, path, message) {
  problems.push({ file: relative(ROOT, file), path: path || '/', message })
}

/**
 * Читает и парсит JSON, отделяя ошибку чтения от ошибки разбора.
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false }>}
 */
async function readJson(file) {
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    report(file, '/', `файл не читается: ${error.message}`)
    return { ok: false }
  }

  try {
    return { ok: true, data: JSON.parse(raw) }
  } catch (error) {
    report(file, '/', `невалидный JSON: ${error.message}`)
    return { ok: false }
  }
}

/** Превращает ошибки Ajv в строки отчёта. */
function reportAjvErrors(file, errors) {
  for (const error of errors ?? []) {
    const detail = error.params && Object.keys(error.params).length > 0
      ? ` (${JSON.stringify(error.params)})`
      : ''
    report(file, error.instancePath, `${error.message}${detail}`)
  }
}

async function main() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true })
  addFormats(ajv)

  const protocolSchemaFile = join(SCHEMA_DIR, 'protocol.schema.json')
  const indexSchemaFile = join(SCHEMA_DIR, 'index.schema.json')

  const protocolSchemaRead = await readJson(protocolSchemaFile)
  const indexSchemaRead = await readJson(indexSchemaFile)
  if (!protocolSchemaRead.ok || !indexSchemaRead.ok) return finish()

  const validateProtocol = ajv.compile(protocolSchemaRead.data)
  const validateIndex = ajv.compile(indexSchemaRead.data)

  /* --- Реестр --------------------------------------------------------- */

  const indexRead = await readJson(INDEX_FILE)
  if (!indexRead.ok) return finish()

  const index = indexRead.data
  if (!validateIndex(index)) reportAjvErrors(INDEX_FILE, validateIndex.errors)

  const entries = Array.isArray(index?.protocols) ? index.protocols : []

  const seenIds = new Set()
  for (const [position, entry] of entries.entries()) {
    if (typeof entry?.id !== 'string') continue
    if (seenIds.has(entry.id)) {
      report(INDEX_FILE, `/protocols/${position}/id`, `дубликат id «${entry.id}» в реестре`)
    }
    seenIds.add(entry.id)
  }

  /* --- Файлы протоколов ----------------------------------------------- */

  let files
  try {
    files = (await readdir(PROTOCOLS_DIR))
      .filter((name) => name.endsWith('.json') && name !== 'index.json')
      .sort()
  } catch (error) {
    report(PROTOCOLS_DIR, '/', `каталог протоколов не читается: ${error.message}`)
    return finish()
  }

  const entryById = new Map(entries.filter((e) => typeof e?.id === 'string').map((e) => [e.id, e]))
  const fileIds = new Set(files.map((name) => name.slice(0, -'.json'.length)))

  // Инвариант 2 — реестр → файл
  for (const [position, entry] of entries.entries()) {
    if (typeof entry?.id !== 'string') continue
    if (!fileIds.has(entry.id)) {
      report(
        INDEX_FILE,
        `/protocols/${position}/id`,
        `в реестре есть «${entry.id}», но файла src/data/protocols/${entry.id}.json нет`,
      )
    }
  }

  for (const name of files) {
    const file = join(PROTOCOLS_DIR, name)
    const fileId = name.slice(0, -'.json'.length)

    const read = await readJson(file)
    if (!read.ok) continue
    const protocol = read.data

    // Инвариант 1 — схема
    if (!validateProtocol(protocol)) reportAjvErrors(file, validateProtocol.errors)

    // Инвариант 4 — id == имя файла
    if (protocol?.id !== fileId) {
      report(file, '/id', `id «${protocol?.id}» не совпадает с именем файла «${fileId}.json»`)
    }

    // Инвариант 4 — уникальность section.id
    const sections = Array.isArray(protocol?.sections) ? protocol.sections : []
    const seenSectionIds = new Set()
    for (const [position, section] of sections.entries()) {
      if (typeof section?.id !== 'string') continue
      if (seenSectionIds.has(section.id)) {
        report(file, `/sections/${position}/id`, `дубликат section.id «${section.id}» внутри протокола`)
      }
      seenSectionIds.add(section.id)
    }

    // Инвариант 2 — файл → реестр
    const entry = entryById.get(fileId)
    if (!entry) {
      report(
        file,
        '/id',
        `файл протокола не зарегистрирован: нет записи «${fileId}» в src/data/protocols/index.json`,
      )
      continue
    }

    // Инвариант 3 — согласованность метаданных прослеживаемости
    for (const field of ['title', 'version', 'sourceDate']) {
      if (entry[field] !== protocol?.[field]) {
        report(
          file,
          `/${field}`,
          `рассинхрон с реестром: index.json = ${JSON.stringify(entry[field])}, ` +
            `${name} = ${JSON.stringify(protocol?.[field])}`,
        )
      }
    }
  }

  return finish(files.length)
}

function finish(protocolCount = 0) {
  if (problems.length > 0) {
    console.error(`validate:data — НАЙДЕНО ПРОБЛЕМ: ${problems.length}\n`)
    for (const { file, path, message } of problems) {
      console.error(`  ${file} ${path} — ${message}`)
    }
    console.error('')
    process.exitCode = 1
    return
  }

  console.log(
    `validate:data — OK: реестр и ${protocolCount} протокол(ов) валидны, ` +
      'биекция реестр↔файлы соблюдена, метаданные согласованы.',
  )
  process.exitCode = 0
}

await main()
