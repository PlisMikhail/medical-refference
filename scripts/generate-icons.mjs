#!/usr/bin/env node
/**
 * Генератор иконок PWA (T034) — `node scripts/generate-icons.mjs`.
 *
 * ЗАЧЕМ СКРИПТ, А НЕ ПРОСТО ФАЙЛЫ: иконки — производный артефакт. Изменится
 * палитра в `src/assets/theme.css` — правится один блок констант ниже и
 * иконки пересобираются, а не перерисовываются вручную в трёх размерах.
 *
 * БЕЗ ЗАВИСИМОСТЕЙ: PNG кодируется здесь же (zlib из стандартной библиотеки).
 * Тянуть sharp/canvas ради трёх статических картинок — лишняя зависимость в
 * дереве сборки.
 *
 * ЗНАК: абстрактная геометрия — вертикальная акцентная «корешок»-полоса и три
 * горизонтальных штриха разной длины (метафора указателя/справочника).
 * Сознательно НЕ используются красный крест, кадуцей, чаша со змеёй и прочая
 * медицинская эмблематика: это охраняемые знаки с реальным юридическим и
 * институциональным значением, приложение не вправе ими прикрываться.
 *
 * MASKABLE: Android накладывает произвольную маску и гарантирует видимой
 * только внутреннюю окружность диаметром 80% холста. Поэтому у maskable-512
 * фон занимает весь холст, а знак вписан в квадрат 50% стороны по центру —
 * его полудиагональ (181px при 512) меньше радиуса безопасной зоны (205px),
 * то есть при любой маске знак не обрезается.
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/** Токены — копия значений из assets/theme.css (иконка вне пайплайна CSS). */
const COLORS = {
  background: '#0b0f14',
  border: '#2a3541',
  accent: '#38bdf8',
  fg: '#e8eef5',
  fgMuted: '#9fb0c0',
  fgSubtle: '#6b7d8f',
}

/** Кратность суперсэмплинга: сглаживание скруглений считается по подпикселям. */
const SS = 4

// ---------------------------------------------------------------- растеризация

function parseColor(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function createCanvas(size) {
  return { size, data: new Uint8Array(size * size * 4) }
}

/** Доля площади пикселя, попавшая внутрь скруглённого прямоугольника. */
function coverage(px, py, x, y, w, h, r) {
  let hits = 0
  for (let sy = 0; sy < SS; sy += 1) {
    for (let sx = 0; sx < SS; sx += 1) {
      const cx = px + (sx + 0.5) / SS
      const cy = py + (sy + 0.5) / SS
      if (cx < x || cx > x + w || cy < y || cy > y + h) continue

      // Расстояние до ближайшего центра скругления по каждой оси.
      const dx = Math.max(x + r - cx, cx - (x + w - r), 0)
      const dy = Math.max(y + r - cy, cy - (y + h - r), 0)
      if (dx * dx + dy * dy <= r * r) hits += 1
    }
  }
  return hits / (SS * SS)
}

/** Рисует скруглённый прямоугольник поверх холста (обычный source-over). */
function roundRect(canvas, x, y, w, h, r, hex) {
  const [cr, cg, cb] = parseColor(hex)
  const radius = Math.min(r, w / 2, h / 2)
  const x0 = Math.max(0, Math.floor(x))
  const y0 = Math.max(0, Math.floor(y))
  const x1 = Math.min(canvas.size, Math.ceil(x + w))
  const y1 = Math.min(canvas.size, Math.ceil(y + h))

  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const a = coverage(px, py, x, y, w, h, radius)
      if (a === 0) continue

      const i = (py * canvas.size + px) * 4
      const dstA = canvas.data[i + 3] / 255
      const outA = a + dstA * (1 - a)
      for (let c = 0; c < 3; c += 1) {
        const src = [cr, cg, cb][c]
        const dst = canvas.data[i + c]
        canvas.data[i + c] = Math.round((src * a + dst * dstA * (1 - a)) / outA)
      }
      canvas.data[i + 3] = Math.round(outA * 255)
    }
  }
}

// --------------------------------------------------------------- кодирование

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, body) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length)
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), body])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([length, typed, crc])
}

/** Минимальный кодировщик PNG: 8 бит, RGBA (тип 6), фильтр 0 на строку. */
function encodePng(canvas) {
  const { size, data } = canvas
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: truecolour with alpha
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// -------------------------------------------------------------------- рисунок

/**
 * Геометрия знака в долях его квадратной рамки (0..1) — одна и та же для PNG
 * и для SVG-фавикона, чтобы знак не разъезжался между форматами.
 */
const GLYPH = {
  spine: { x: 0, y: 0, w: 0.16, h: 1, r: 0.08, color: COLORS.accent },
  bars: [
    { x: 0.3, y: 0.08, w: 0.7, h: 0.16, r: 0.08, color: COLORS.fg },
    { x: 0.3, y: 0.42, w: 0.56, h: 0.16, r: 0.08, color: COLORS.fgMuted },
    { x: 0.3, y: 0.76, w: 0.38, h: 0.16, r: 0.08, color: COLORS.fgSubtle },
  ],
}

function drawGlyph(canvas, boxSize, offset) {
  const place = ({ x, y, w, h, r, color }) =>
    roundRect(
      canvas,
      offset + x * boxSize,
      offset + y * boxSize,
      w * boxSize,
      h * boxSize,
      r * boxSize,
      color,
    )

  place(GLYPH.spine)
  GLYPH.bars.forEach(place)
}

/**
 * @param {number} size сторона холста в пикселях
 * @param {'any' | 'maskable'} purpose
 *   `any` — плитка со скруглением 22% и тонкой рамкой, знак на 62% стороны;
 *   `maskable` — фон во весь холст, знак на 50% стороны (безопасная зона).
 */
function renderIcon(size, purpose) {
  const canvas = createCanvas(size)
  const maskable = purpose === 'maskable'

  if (maskable) {
    roundRect(canvas, 0, 0, size, size, 0, COLORS.background)
  } else {
    const r = size * 0.22
    roundRect(canvas, 0, 0, size, size, r, COLORS.border)
    const inset = Math.max(1, Math.round(size * 0.012))
    roundRect(canvas, inset, inset, size - inset * 2, size - inset * 2, r - inset, COLORS.background)
  }

  const box = size * (maskable ? 0.5 : 0.62)
  drawGlyph(canvas, box, (size - box) / 2)
  return encodePng(canvas)
}

function renderFaviconSvg(size = 64) {
  const box = size * 0.62
  const offset = (size - box) / 2
  const rect = ({ x, y, w, h, r, color }) =>
    `  <rect x="${(offset + x * box).toFixed(2)}" y="${(offset + y * box).toFixed(2)}" ` +
    `width="${(w * box).toFixed(2)}" height="${(h * box).toFixed(2)}" ` +
    `rx="${(r * box).toFixed(2)}" fill="${color}" />`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Med Helper">`,
    `  <rect width="${size}" height="${size}" rx="${(size * 0.22).toFixed(2)}" fill="${COLORS.background}" stroke="${COLORS.border}" stroke-width="1.5" />`,
    rect(GLYPH.spine),
    ...GLYPH.bars.map(rect),
    '</svg>',
    '',
  ].join('\n')
}

// ----------------------------------------------------------------------- main

mkdirSync(OUT_DIR, { recursive: true })

const written = [
  ['pwa-192.png', renderIcon(192, 'any')],
  ['pwa-512.png', renderIcon(512, 'any')],
  ['maskable-512.png', renderIcon(512, 'maskable')],
  ['favicon.svg', renderFaviconSvg()],
]

for (const [name, content] of written) {
  writeFileSync(join(OUT_DIR, name), content)
  console.log(`icons: ${name} (${content.length} bytes)`)
}
