# Implementation Plan: Просмотрщик клинических протоколов (offline)

**Branch**: `001-protocol-viewer` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Repository**: <https://github.com/PlisMikhail/medical-refference> (public,
GitHub Pages; локальный git инициализирован, remote `origin` настроен)

**Input**: Feature specification from `/specs/001-protocol-viewer/spec.md`

## Summary

Мобильный офлайн-справочник клинических протоколов: SPA на Vue 3, собираемое
Vite в полностью статическую PWA, деплой на GitHub Pages. Контент — только
JSON в `src/data/protocols/` (реестр + файлы протоколов), рендеринг — через
генерический реестр блок-компонентов с видимым фоллбэком для неизвестных
типов. Полный офлайн после первого открытия (vite-plugin-pwa, precache всего),
обновления — только через явный баннер. Валидация данных против JSON Schema —
в dev-рантайме и в CI. Путь к упаковке в Android APK (Capacitor) держится
открытым: hash-роутинг, base через переменную окружения, никаких web-only API.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Vue SFC `<script setup lang="ts">`; Node 22 LTS для сборки

**Primary Dependencies**: Vue ^3.5 (стабильная ветка; 3.6 в RC — не берём), vue-router ^4.5 (hash-режим), Vite ^8 (Rolldown), Tailwind CSS ^4.3 через `@tailwindcss/vite`, vite-plugin-pwa ^1.3 (Workbox, `registerType: 'prompt'`), Ajv ^8 (только dev-рантайм и CI-скрипт)

**Storage**: контент — JSON, бандлится через `import.meta.glob` (сетевых запросов за данными нет); `localStorage` — только флаг подтверждения дисклеймера; состояние чек-листов — эфемерное (в памяти)

**Testing**: Vitest ^4.1 + @vue/test-utils (happy-dom) — smoke-тесты по FR; `scripts/validate-protocols.mjs` (Ajv, JSON Schema 2020-12 + кросс-проверка реестра и файлов) — локально и в CI

**Target Platform**: Android Chrome (mobile-first, viewport ~380px), десктоп-браузер — вторично; хостинг GitHub Pages (статический); будущий канал — Capacitor WebView (не блокировать)

**Project Type**: SPA/PWA, полностью статическая, без бэкенда

**Performance Goals**: первый рендер < 2 с на среднем смартфоне; JS-бандл (gzip, без данных) ≤ ~200 КБ; поиск по открытому протоколу < 100 мс (запас к SC-005 «< 1 с»)

**Constraints**: полный офлайн после первого открытия; ноль запросов к внешним доменам (шрифты/CDN/аналитика запрещены); тёмная тема по умолчанию; тач-таргеты ≥ 44×44 CSS px; медицинский текст только в JSON-данных

**Scale/Scope**: 1 пользователь; < 20 протоколов; 2 экрана (Home, Protocol) + оверлеи (дисклеймер, баннер обновления)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Как выполняется |
|---------|--------|-----------------|
| I. Справочник, а не советчик | PASS | Только рендеринг данных; чек-лист без итогов и интерпретаций; калькуляторов в этой фиче нет; `dosage-table` хранит строки, никакой арифметики |
| II. Запрет генерации медконтента | PASS | Единственный контент фичи — демо-протокол с явными заглушками («Критерий 1», «Пример дозировки»); реальный контент — отдельная фича с переносом из документов владельца |
| III. Данные отдельно от кода | PASS | JSON в `src/data/protocols/` + `import.meta.glob`: новый протокол = JSON-файл + запись в `index.json`, ноль правок кода; в компонентах медицинского текста нет |
| IV. Полный офлайн | PASS | vite-plugin-pwa: precache всех ассетов (данные внутри JS-чанков); `registerType: 'prompt'` + баннер «Доступно обновление» — молчаливых обновлений нет; внешних рантайм-запросов нет |
| V. Прослеживаемость контента | PASS | `version/sourceDocument/sourceDate/lastReviewed` обязательны в схеме (валидация не пропустит), отображаются компонентом ProtocolMeta; кросс-проверка реестра и файлов в CI |
| VI. Без аккаунтов/аналитики/синхронизации/пушей | PASS | Ничего из перечисленного не подключается; `localStorage` — единственное локальное хранилище (флаг дисклеймера) |
| VII. Работоспособность web-сборки | PASS | `npm run dev` / `npm run build` — основной путь; PWA и будущий Capacitor — надстройки, не изменяющие web-путь; `base` через env не ломает локальную сборку |

**Post-design re-check (после Phase 1)**: PASS — дизайн данных и контрактов не
ввёл новых отступлений; Complexity Tracking пуст.

## Project Structure

### Documentation (this feature)

```text
specs/001-protocol-viewer/
├── spec.md              # Спецификация фичи
├── plan.md              # Этот файл
├── research.md          # Phase 0: решения и обоснования
├── data-model.md        # Phase 1: модель данных
├── quickstart.md        # Phase 1: сценарии проверки
├── contracts/           # Phase 1: JSON Schema контрактов данных
│   ├── README.md
│   ├── protocol.schema.json
│   └── index.schema.json
├── checklists/requirements.md
└── tasks.md             # Phase 2: создаётся командой /speckit-tasks
```

### Source Code (repository root)

```text
med_helper/
├── .github/workflows/deploy.yml   # официальный Pages-workflow: validate → test → build → deploy
├── index.html
├── vite.config.ts                 # base: process.env.BASE_PATH ?? '/'; PWA-манифест; precache
├── package.json                   # scripts: dev, build, preview, test, validate:data
├── tsconfig.json
├── .nvmrc                         # 22 (LTS)
├── public/
│   └── icons/                     # pwa-192.png, pwa-512.png, maskable-512.png, favicon.svg
├── scripts/
│   └── validate-protocols.mjs     # Ajv: схема + кросс-проверка index ↔ файлы протоколов
├── src/
│   ├── main.ts
│   ├── App.vue                    # каркас: DisclaimerGate, UpdateBanner, router-view
│   ├── assets/theme.css           # Tailwind v4 @theme: тёмная палитра, токены цветов типов секций
│   ├── router/index.ts            # createWebHashHistory
│   ├── types/protocol.ts          # discriminated union блоков + типы реестра
│   ├── views/
│   │   ├── HomeView.vue           # список из index.json: название, версия, дата источника
│   │   └── ProtocolView.vue       # мета + секции + sticky-табы + поиск
│   ├── components/
│   │   ├── ProtocolRenderer.vue   # секции → блоки → реестр компонентов
│   │   ├── ProtocolSectionNav.vue # sticky-табы секций (цвет по kind секции)
│   │   ├── ProtocolMeta.vue       # version / sourceDocument / sourceDate / lastReviewed
│   │   ├── ProtocolSearch.vue     # поиск по открытому протоколу, подсветка, переходы
│   │   ├── DisclaimerGate.vue     # первый запуск, явное подтверждение
│   │   ├── UpdateBanner.vue       # SW prompt-обновление
│   │   └── blocks/
│   │       ├── registry.ts        # Record<BlockType, Component>; ключи проверяются типом
│   │       ├── TextBlock.vue
│   │       ├── WarningBlock.vue
│   │       ├── TimerNoteBlock.vue
│   │       ├── CriteriaListBlock.vue
│   │       ├── DosageTableBlock.vue
│   │       ├── ChecklistBlock.vue
│   │       └── UnknownBlock.vue   # видимый фоллбэк с указанием типа
│   ├── composables/
│   │   ├── useProtocols.ts        # index (eager) + протокол по id (lazy import.meta.glob)
│   │   ├── useDisclaimer.ts       # localStorage-флаг
│   │   ├── useChecklistState.ts   # эфемерные отметки, сброс при unmount
│   │   ├── useProtocolSearch.ts   # подстрочный поиск без учёта регистра
│   │   └── useDevValidation.ts    # DEV-only: динамический импорт Ajv, понятная ошибка
│   └── data/
│       ├── schema/
│       │   ├── protocol.schema.json   # копия контракта (каноник после старта реализации)
│       │   └── index.schema.json
│       └── protocols/
│           ├── index.json             # реестр: id, title, version, sourceDate
│           └── demo-protocol.json     # все типы блоков v1, placeholder-контент
└── tests/
    ├── renderer.spec.ts           # все типы v1 рендерятся; unknown → фоллбэк
    ├── checklist.spec.ts          # отметки не персистятся
    └── search.spec.ts             # регистронезависимость, «ничего не найдено»
```

**Structure Decision**: единый фронтенд-проект (вариант «single project»,
web-специфика без backend). Структура повторяет заданную владельцем
(`src/data/protocols/*`, `src/components/blocks/*`, `src/views/*`) и расширяет
её реестром блоков, composables и валидационным скриптом. Модульность:
новый протокол = JSON + строка в реестре данных; новый тип блока = компонент +
строка в `registry.ts` + ветка в схеме + вариант в union-типе (компилятор и
валидатор указывают все точки); новая фича (например, ТЛТ-калькулятор) = новый
view + маршрут, существующие модули не трогаются.

## Ключевые решения (кратко; обоснования в research.md)

1. **SPA-fallback: hash-режим роутера** (`createWebHashHistory`), а не
   404.html-копия. Зафиксировано.
2. **`base` через переменную окружения** `BASE_PATH` (default `/`);
   CI задаёт `/medical-refference/`. Никакой логики, завязанной на URL
   хостинга.
3. **Версии стека (июль 2026)**: Vite 8 / Tailwind 4.3 / vite-plugin-pwa 1.3 /
   Vitest 4.1 / Vue 3.5 stable.
4. **TypeScript strict** — компилятор охраняет модульность рендерера.
5. **JSON Schema 2020-12 — канонический контракт данных**: dev-рантайм (Ajv,
   только DEV), CI-скрипт, `$schema`-ссылка в JSON для подсказок в редакторе.
6. **Навигация по секциям: sticky-табы** (один тап, всегда видимы).

## Complexity Tracking

Нарушений Constitution Check нет — таблица не заполняется.
