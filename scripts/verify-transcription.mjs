#!/usr/bin/env node
/**
 * Проверка дословности транскрипции — машинное доказательство принципа II
 * конституции (research.md § R2–R4).
 *
 * Утверждение, которое доказывает скрипт: каждая строка перенесённого JSON
 * либо является непрерывным фрагментом исходного документа, либо поимённо
 * перечислена в файле исключений с обоснованием. Третьего не дано.
 *
 * Проверяет для каждой цели манифеста:
 *   1. каждая строка протокола (кроме служебных полей) — подстрока источника
 *      после одинаковой с обеих сторон нормализации;
 *   2. не прошедшая проверку строка ТОЧНО совпадает с записью исключений;
 *   3. в списке исключений нет мёртвых записей (каждая хоть раз пригодилась).
 *
 * Сравнение — подстрочное, а не нечёткое: `90 мг` и `9 мг` обязаны остаться
 * разными строками. Нормализация съедает только шум извлечения PDF (разрывы
 * слов пробелом, разрядку, мягкий перенос, потерянные надстрочные индексы).
 *
 * Вывод — по одной понятной строке на проблему: файл + путь + сообщение.
 * Exit code: 0 — всё чисто, 1 — есть хотя бы одна проблема.
 *
 * Скрипт намеренно на чистом Node ESM без зависимостей: он обязан работать
 * у владельца и у врача на голом Node, без установки пакетов и сборки.
 *
 * Использование:
 *   node scripts/verify-transcription.mjs
 *   node scripts/verify-transcription.mjs --protocol=<json> --source=<txt> --exemptions=<json>
 *
 * Второй вид — разовая сверка ещё не зарегистрированного файла (например,
 * черновика транскрипции). Все три пути обязательны вместе: проверка без
 * источника или без списка исключений смысла не имеет.
 */

import { readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)))

/**
 * Манифест целей проверки. Добавление следующего протокола — одна запись.
 *
 * Демо-протокол здесь отсутствует намеренно: его контент — заведомый
 * placeholder, исходного документа у него нет и быть не может.
 */
const TARGETS = [
  {
    protocol: 'src/data/protocols/tlt-ischemic-stroke.json',
    source: 'source-documents/protocol.txt',
    exemptions: 'specs/002-tlt-memo/transcription-exemptions.json',
  },
]

/**
 * Ключи, значения которых не являются клиническим текстом: структура,
 * идентификаторы и метаданные прослеживаемости. Всё остальное — включая
 * `title`, `label`, `body`, элементы `items`/`columns` и ячейки `rows` —
 * проверяется. Список ключей, а не типов блоков: новый тип блока покрывается
 * проверкой автоматически, без правки этого скрипта.
 */
const NON_CONTENT_KEYS = new Set([
  '$schema',
  'id',
  'type',
  'kind',
  'version',
  'sourceDocument',
  'sourceDate',
  'lastReviewed',
])

/** Поле-массив в файле исключений. */
const EXEMPTIONS_FIELD = 'exemptions'

/** Длина, после которой строка в отчёте обрезается многоточием. */
const REPORT_MAX_LENGTH = 120

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** Собранные проблемы: { file, path, message }. */
const problems = []

/**
 * @param {string} file абсолютный путь к файлу
 * @param {string} path JSON-путь или логическое место проблемы
 * @param {string} message человекочитаемое описание
 */
function report(file, path, message) {
  problems.push({ file: displayPath(file), path: path || '/', message })
}

/** Путь относительно корня репозитория; для файлов вне него — как есть. */
function displayPath(file) {
  const rel = relative(ROOT, file)
  return rel && !rel.startsWith('..') ? rel : file
}

/** Разрешает путь цели: относительный — от корня репозитория. */
function resolveTargetPath(value) {
  return isAbsolute(value) ? value : join(ROOT, value)
}

/* --- Нормализация ------------------------------------------------------ */

/**
 * Приводит текст к форме, в которой дефекты извлечения PDF исчезают, а любое
 * смысловое различие сохраняется (research.md § R2).
 *
 * Порядок шагов важен: надстрочные цифры разворачиваются до удаления пробелов,
 * иначе `10 9/л` и `10⁹/л` разойдутся.
 *
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return text
    // 1. мягкий перенос — невидимый символ, в JSON его не набирают
    .replaceAll('\u00AD', '')
    // 2. надстрочные цифры → обычные: извлечение теряет верхний индекс
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/gu, (char) => String(SUPERSCRIPT_DIGITS.indexOf(char)))
    // 3. регистр: заголовки в документе набраны иначе, чем в памятке
    .toLowerCase()
    // 4. все пробельные символы, включая неразрывный: `лекарств енный` == `лекарственный`
    .replace(/[\s\u00A0]+/gu, '')
}

/**
 * Выбрасывает из исходного текста служебный мусор извлечения ДО нормализации,
 * пока структура строк ещё видна. Иначе колонтитул, попавший между строк
 * пункта 28.4/28.5, разорвёт фразу и подстрочная проверка ложно покраснеет.
 *
 * @param {string} raw содержимое `protocol.txt`
 * @returns {string}
 */
function stripExtractionArtifacts(raw) {
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      // маркер страницы, вставленный извлечением: ===== PAGE 17 =====
      if (/^=+\s*PAGE\s+\d+\s*=+$/i.test(trimmed)) return false
      // бегущий колонтитул источника публикации
      if (trimmed.startsWith('Национальный правовой Интернет-портал')) return false
      // одинокий номер страницы
      if (/^\d{1,3}$/.test(trimmed)) return false
      return true
    })
    .join('\n')
}

/* --- Обход протокола --------------------------------------------------- */

/**
 * Рекурсивно собирает все строковые значения протокола, кроме значений по
 * служебным ключам.
 *
 * @param {unknown} node
 * @param {string} path JSON-путь до узла
 * @param {{ path: string, text: string }[]} collected аккумулятор
 */
function collectStrings(node, path, collected) {
  if (typeof node === 'string') {
    collected.push({ path, text: node })
    return
  }

  if (Array.isArray(node)) {
    node.forEach((item, position) => collectStrings(item, `${path}/${position}`, collected))
    return
  }

  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (NON_CONTENT_KEYS.has(key)) continue
      collectStrings(value, `${path}/${key}`, collected)
    }
  }
}

/** Обрезает строку для отчёта, оставляя видимым начало. */
function forReport(text) {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length > REPORT_MAX_LENGTH ? `${flat.slice(0, REPORT_MAX_LENGTH)}…` : flat
}

/* --- Чтение файлов ----------------------------------------------------- */

/**
 * Читает текстовый файл. Отсутствие файла — не молчаливый зелёный экран,
 * а проблема с объяснением, что это за файл и где его взять.
 *
 * @returns {Promise<{ ok: true, raw: string } | { ok: false }>}
 */
async function readText(file, missingHint) {
  try {
    return { ok: true, raw: await readFile(file, 'utf8') }
  } catch (error) {
    const message = error.code === 'ENOENT' ? `файла нет. ${missingHint}` : `файл не читается: ${error.message}`
    report(file, '/', message)
    return { ok: false }
  }
}

/** Читает и разбирает JSON, отделяя ошибку чтения от ошибки разбора. */
async function readJson(file, missingHint) {
  const read = await readText(file, missingHint)
  if (!read.ok) return { ok: false }

  try {
    return { ok: true, data: JSON.parse(read.raw) }
  } catch (error) {
    report(file, '/', `невалидный JSON: ${error.message}`)
    return { ok: false }
  }
}

/* --- Проверка одной цели ----------------------------------------------- */

/**
 * @param {{ protocol: string, source: string, exemptions: string }} target
 * @returns {Promise<{ checked: number, inSource: number, exempted: number, exemptions: number } | null>}
 */
async function verifyTarget(target) {
  const protocolFile = resolveTargetPath(target.protocol)
  const sourceFile = resolveTargetPath(target.source)
  const exemptionsFile = resolveTargetPath(target.exemptions)

  const protocolRead = await readJson(
    protocolFile,
    'это транскрипция протокола; она обязана лежать в репозитории — ' +
      'либо файл ещё не создан, либо путь в манифесте TARGETS устарел.',
  )
  const sourceRead = await readText(
    sourceFile,
    'это исходный документ владельца, он вне гита (см. .gitignore). ' +
      'Получить: извлечь текст из source-documents/protocol.pdf постранично, ' +
      'с маркерами страниц (см. specs/002-tlt-memo/research.md § R1).',
  )
  const exemptionsRead = await readJson(
    exemptionsFile,
    'это список строк, которых в источнике нет; он обязан лежать в репозитории ' +
      'рядом со спецификацией фичи.',
  )

  if (!protocolRead.ok || !sourceRead.ok || !exemptionsRead.ok) return null

  /* Исключения: точное совпадение по нормализованной форме. Подстрочное
     сравнение здесь дало бы дыру — короткое исключение начало бы покрывать
     длинные клинические строки. */
  const entries = exemptionsRead.data?.[EXEMPTIONS_FIELD]
  if (!Array.isArray(entries)) {
    report(exemptionsFile, `/${EXEMPTIONS_FIELD}`, `ожидался массив записей { text, reason }`)
    return null
  }

  /** @type {Map<string, { position: number, text: string, used: boolean }>} */
  const exemptions = new Map()
  for (const [position, entry] of entries.entries()) {
    const path = `/${EXEMPTIONS_FIELD}/${position}`

    if (typeof entry?.text !== 'string' || entry.text.trim() === '') {
      report(exemptionsFile, path, 'запись без непустого поля text')
      continue
    }
    if (typeof entry?.reason !== 'string' || entry.reason.trim() === '') {
      report(exemptionsFile, path, `запись без обоснования (reason): «${forReport(entry.text)}»`)
      continue
    }

    const key = normalize(entry.text)
    if (key === '') {
      report(exemptionsFile, path, 'запись пуста после нормализации')
      continue
    }
    if (exemptions.has(key)) {
      report(exemptionsFile, path, `дубликат исключения: «${forReport(entry.text)}»`)
      continue
    }

    exemptions.set(key, { position, text: entry.text, used: false })
  }

  const normalizedSource = normalize(stripExtractionArtifacts(sourceRead.raw))

  /** @type {{ path: string, text: string }[]} */
  const strings = []
  collectStrings(protocolRead.data, '', strings)

  let inSource = 0
  let exempted = 0

  for (const { path, text } of strings) {
    const normalized = normalize(text)

    // Пустая после нормализации строка была бы подстрокой чего угодно —
    // проверка на ней вырождается, поэтому такая строка сама по себе проблема.
    if (normalized === '') {
      report(protocolFile, path, 'строка пуста после нормализации — проверить нечего')
      continue
    }

    /* Список исключений проверяется ПЕРВЫМ, до поиска в источнике.
       Иначе короткая наша строка может случайно оказаться подстрокой
       документа — «Показания» лежит внутри «показаниям» из чужого пункта —
       пройти проверку и не попасть в список, который врач читает глазами.
       А попытка внести её туда честно ловилась бы как мёртвая запись.
       Исключение — это заявление «эта строка не из документа, прочти её
       сам»; такое заявление должно быть сильнее случайного совпадения. */
    const exemption = exemptions.get(normalized)
    if (exemption) {
      exemption.used = true
      exempted += 1
      continue
    }

    if (normalizedSource.includes(normalized)) {
      inSource += 1
      continue
    }

    report(
      protocolFile,
      path,
      `нет в источнике ${displayPath(sourceFile)} и нет в списке исключений: «${forReport(text)}»`,
    )
  }

  // Мёртвая запись в списке исключений — либо строку удалили из протокола,
  // либо исключение написано с опечаткой и ничего не покрывает.
  for (const [, exemption] of exemptions) {
    if (exemption.used) continue
    report(
      exemptionsFile,
      `/${EXEMPTIONS_FIELD}/${exemption.position}`,
      `исключение не понадобилось ни разу — удалить или исправить: «${forReport(exemption.text)}»`,
    )
  }

  return { checked: strings.length, inSource, exempted, exemptions: exemptions.size }
}

/* --- CLI --------------------------------------------------------------- */

/**
 * Разбирает `--protocol=`, `--source=`, `--exemptions=`. Все три обязательны
 * вместе; пути — относительно текущего каталога.
 *
 * @returns {{ ok: true, targets: typeof TARGETS } | { ok: false, message: string }}
 */
function resolveTargets(argv) {
  const overrides = {}
  for (const arg of argv) {
    const match = /^--(protocol|source|exemptions)=(.+)$/u.exec(arg)
    if (!match) return { ok: false, message: `неизвестный аргумент: ${arg}` }
    overrides[match[1]] = resolve(process.cwd(), match[2])
  }

  const given = Object.keys(overrides)
  if (given.length === 0) return { ok: true, targets: TARGETS }
  if (given.length < 3) {
    return {
      ok: false,
      message:
        'аргументы --protocol, --source и --exemptions задаются только все вместе: ' +
        `сейчас задан(ы) ${given.map((name) => `--${name}`).join(', ')}.`,
    }
  }

  return { ok: true, targets: [overrides] }
}

/* --- Точка входа ------------------------------------------------------- */

async function main() {
  const resolved = resolveTargets(process.argv.slice(2))
  if (!resolved.ok) {
    console.error(`verify:transcription — ${resolved.message}\n`)
    console.error(
      '  Использование: node scripts/verify-transcription.mjs ' +
        '[--protocol=<json> --source=<txt> --exemptions=<json>]\n',
    )
    process.exitCode = 1
    return
  }

  const summaries = []
  for (const target of resolved.targets) {
    const summary = await verifyTarget(target)
    if (summary) summaries.push({ target, summary })
  }

  finish(summaries)
}

function finish(summaries) {
  if (problems.length > 0) {
    console.error(`verify:transcription — НАЙДЕНО ПРОБЛЕМ: ${problems.length}\n`)
    for (const { file, path, message } of problems) {
      console.error(`  ${file} ${path} — ${message}`)
    }
    console.error('')
    process.exitCode = 1
    return
  }

  for (const { target, summary } of summaries) {
    console.log(
      `verify:transcription — OK: ${target.protocol} — строк проверено: ${summary.checked}, ` +
        `найдено в источнике: ${summary.inSource}, покрыто исключениями: ${summary.exempted}.`,
    )
    console.log(
      `  Исключений в списке: ${summary.exemptions} — ` +
        'это ровно то, что врач обязан прочитать глазами; всё остальное доказано машинно.',
    )
  }

  process.exitCode = 0
}

await main()
