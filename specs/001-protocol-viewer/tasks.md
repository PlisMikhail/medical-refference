# Tasks: Просмотрщик клинических протоколов (offline)

**Input**: Design documents from `/specs/001-protocol-viewer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: включены точечно — спека/план (R12) требуют smoke-тесты контракта каркаса (рендерер, фоллбэк, чек-лист, поиск) и обязательную валидацию данных. TDD не запрошен — тесты идут после реализации внутри своей истории.

**Organization**: задачи сгруппированы по user stories (US1–US4 из spec.md) для независимой реализации и проверки.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: принадлежность user story (US1, US2, US3, US4)

## Path Conventions

Single project (SPA), корень репозитория: `src/`, `tests/`, `scripts/`, `public/` — структура из plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: каркас проекта на актуальном стеке (Vite 8, Vue 3.5, TS strict, Tailwind 4.3, Vitest 4.1)

- [ ] T001 Скаффолд проекта в корне репозитория: `package.json` (scripts: dev/build/preview/test/validate:data), `vite.config.ts` (`base: process.env.BASE_PATH ?? '/'`), `tsconfig.json` (strict), `index.html` (viewport, `lang="ru"`, тёмный фон до гидрации), `src/main.ts`, `src/App.vue` (заглушка), `.gitignore`, `.nvmrc` (22)
- [ ] T002 Подключить Tailwind CSS 4 через `@tailwindcss/vite`; создать `src/assets/theme.css`: `@theme` с тёмной палитрой (поверхности, текст) и токенами типов секций `--color-inclusion`, `--color-exclusion-absolute`, `--color-exclusion-relative`, акценты для warning/timer-note; базовые правила: тач-таргеты ≥44px, `color-scheme: dark`; импорт в `src/main.ts`
- [ ] T003 [P] Настроить Vitest 4 + @vue/test-utils + happy-dom (`vitest` секция в `vite.config.ts` или `vitest.config.ts`), smoke-тест `tests/app.spec.ts` (App монтируется)
- [ ] T004 Первый коммит скаффолда и push в `origin main` (проверка доступа к https://github.com/PlisMikhail/medical-refference)

**Checkpoint**: `npm run dev` открывает пустое тёмное приложение; `npm run test` зелёный

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: типы, схемы, данные, роутер, загрузка и валидация — фундамент всех историй

**⚠️ CRITICAL**: работы по user stories не начинать до завершения этой фазы

- [ ] T005 [P] Создать `src/types/protocol.ts`: discriminated union блоков v1 (`TextBlock | WarningBlock | TimerNoteBlock | CriteriaListBlock | DosageTableBlock | ChecklistBlock`), `UnknownBlock` (произвольный `type: string`), `Section` (`kind: 'default' | 'inclusion' | 'exclusion-absolute' | 'exclusion-relative'`), `Protocol`, `ProtocolIndex`, `IndexEntry` — строго по data-model.md
- [ ] T006 [P] Скопировать канонические схемы из `specs/001-protocol-viewer/contracts/` в `src/data/schema/protocol.schema.json` и `src/data/schema/index.schema.json`
- [ ] T007 [P] Создать `src/data/protocols/demo-protocol.json` (все 6 типов блоков v1, все три `kind` критериев, секции всех четырёх `kind`, ТОЛЬКО placeholder-контент: «Критерий 1», «Пример дозировки» — конституция II/FR-010) и `src/data/protocols/index.json` (реестр с записью демо-протокола); в оба файла — `"$schema"`-ссылки на схемы
- [ ] T008 Написать `scripts/validate-protocols.mjs` (Ajv 2020 + ajv-formats): валидация index и всех протоколов по схемам; кросс-проверки из data-model.md (биекция реестр↔файлы, равенство `title/version/sourceDate`, `id` = имя файла, уникальность `section.id`); понятный вывод: файл + путь + сообщение; ненулевой exit code; npm script `validate:data` (зависит от T006, T007)
- [ ] T009 [P] Создать `src/router/index.ts`: `createWebHashHistory`, маршруты `/` → HomeView, `/protocol/:id` → ProtocolView (lazy); подключить в `src/main.ts`
- [ ] T010 Реализовать `src/composables/useProtocols.ts`: eager-импорт `index.json`, lazy `import.meta.glob('/src/data/protocols/*.json')` по id, состояния loading/error (протокол в реестре, но файла нет / битый JSON) (зависит от T005, T007)
- [ ] T011 Реализовать `src/composables/useDevValidation.ts`: только при `import.meta.env.DEV` — динамический импорт Ajv, валидация загруженного протокола, читаемая ошибка (файл, `instancePath`, сообщение) + warning на неизвестный тип блока (зависит от T005, T006)
- [ ] T012 Оформить каркас `src/App.vue`: тёмный layout mobile-first (~380px), `<router-view>`, слоты под будущие DisclaimerGate/UpdateBanner

**Checkpoint**: `npm run validate:data` зелёный; dev-сервер рендерит пустые маршруты; порча демо-JSON даёт понятную ошибку в обоих рубежах

---

## Phase 3: User Story 1 — Открыть протокол и прочитать содержимое (Priority: P1) 🎯 MVP

**Goal**: список протоколов из реестра → экран протокола со всеми типами блоков v1, метаданными прослеживаемости и видимым фоллбэком неизвестного типа

**Independent Test**: сценарии 1, 2, 4 из quickstart.md — открыть демо-протокол, увидеть все 6 типов блоков и метаданные; подложить блок неизвестного типа → видимая плашка; отметки чек-листа сбрасываются при переоткрытии

- [ ] T013 [P] [US1] Компоненты `src/components/blocks/TextBlock.vue` (абзацы по `\n\n`), `WarningBlock.vue` (акцентная плашка), `TimerNoteBlock.vue` (статическая плашка временного окна, опциональный `label`) — стили только через токены темы, никакого медицинского текста в компонентах
- [ ] T014 [P] [US1] Компонент `src/components/blocks/CriteriaListBlock.vue`: маркеры пунктов цветом токена `kind`; неизвестный `kind` → нейтральный список с видимой пометкой (edge case спеки)
- [ ] T015 [P] [US1] Компонент `src/components/blocks/DosageTableBlock.vue`: таблица со строковыми ячейками, горизонтальный скролл внутри блока на узком экране
- [ ] T016 [P] [US1] `src/composables/useChecklistState.ts` (эфемерные отметки, ключ `sectionId:blockIndex`, сброс при unmount) + компонент `src/components/blocks/ChecklistBlock.vue` (крупные тач-таргеты, без итогов/сумм — конституция I)
- [ ] T017 [P] [US1] Компонент `src/components/blocks/UnknownBlock.vue`: заметная плашка «Неподдерживаемый тип блока: <type>» (FR-006)
- [ ] T018 [US1] Реестр `src/components/blocks/registry.ts`: `Record<KnownBlockType, Component>` с типовой проверкой полноты (компилятор падает, если тип из union не покрыт), резолвер с фоллбэком на UnknownBlock (зависит от T013–T017)
- [ ] T019 [US1] Компонент `src/components/ProtocolRenderer.vue`: секции → заголовки с якорями `id` → блоки через реестр (зависит от T018)
- [ ] T020 [P] [US1] Компонент `src/components/ProtocolMeta.vue`: version, sourceDocument, sourceDate, lastReviewed — всегда видимы (FR-002, конституция V)
- [ ] T021 [US1] Экран `src/views/HomeView.vue`: список из реестра (название, версия, дата источника), тап → `/protocol/:id`, явное пустое состояние «протоколы недоступны» (FR-001, FR-014)
- [ ] T022 [US1] Экран `src/views/ProtocolView.vue`: загрузка по id через useProtocols, dev-валидация (useDevValidation), ProtocolMeta + ProtocolRenderer, понятная ошибка при отсутствующем/битом файле (зависит от T019, T020)
- [ ] T023 [P] [US1] Тест `tests/renderer.spec.ts`: фикстура со всеми 6 типами v1 — каждый отрендерен; блок `{"type":"bogus"}` → фоллбэк с текстом типа; данные фикстуры — только заглушки
- [ ] T024 [P] [US1] Тест `tests/checklist.spec.ts`: отметки видимы после клика и сброшены после remount компонента

**Checkpoint**: US1 полностью работает — MVP готов к показу

---

## Phase 4: User Story 2 — Мгновенно попасть в нужную секцию (Priority: P2)

**Goal**: sticky-табы секций с цветовой маркировкой типов, один тап до секции из любой точки прокрутки

**Independent Test**: сценарий 3 quickstart.md — на демо-протоколе с ≥5 секциями перейти в каждую через табы; типы секций различимы цветом не читая заголовков; табы видны после прокрутки в конец

- [ ] T025 [US2] Компонент `src/components/ProtocolSectionNav.vue`: закреплённая (sticky) горизонтально прокручиваемая лента чипов секций, цвет чипа = токен `kind` секции, тач-таргеты ≥44px; активная секция подсвечивается через IntersectionObserver
- [ ] T026 [US2] Интегрировать навигацию в `src/views/ProtocolView.vue`: плавный скролл к якорю по тапу, `scroll-margin-top` у секций под высоту sticky-панели, deep-link `#/protocol/:id` корректно работает с внутренними якорями hash-роутера (зависит от T025)
- [ ] T027 [P] [US2] Цветовая маркировка секций в `src/components/ProtocolRenderer.vue`: заголовок/рамка секции окрашены токеном `kind` — мгновенное различение показаний / абсолютных / относительных противопоказаний (FR-004)

**Checkpoint**: US1 + US2 работают; «≤3 тапа и ≤10 секунд до секции» (SC-001) выполняется

---

## Phase 5: User Story 4 — Дисклеймер при первом запуске (Priority: P2)

**Goal**: до любого контента — дисклеймер с явным подтверждением; повторно не показывается

**Independent Test**: сценарий 6 quickstart.md — очистить localStorage → дисклеймер; подтвердить → перезагрузка → сразу главный экран

- [ ] T028 [US4] Реализовать `src/composables/useDisclaimer.ts`: флаг в `localStorage` (ключ `med-helper:disclaimer-accepted`, значение — ISO-дата подтверждения)
- [ ] T029 [US4] Компонент `src/components/DisclaimerGate.vue`: полноэкранный оверлей с текстом «Справочный материал. Не заменяет официальный протокол и клиническое суждение врача», кнопка явного подтверждения ≥44px; подключить в `src/App.vue` до `<router-view>` (FR-009) (зависит от T028)

**Checkpoint**: первый запуск ведёт через дисклеймер; повторные — нет

---

## Phase 6: User Story 3 — Поиск по открытому протоколу (Priority: P3)

**Goal**: регистронезависимый подстрочный поиск по содержимому открытого протокола с подсветкой и переходами

**Independent Test**: сценарий 5 quickstart.md — строка в другом регистре находится во всех блоках; переходы между совпадениями работают; абракадабра → «ничего не найдено»

- [ ] T030 [US3] Реализовать `src/composables/useProtocolSearch.ts`: сбор текстового содержимого блоков протокола (body, items, ячейки таблиц, заголовки секций), регистронезависимый поиск буквального вхождения (спецсимволы экранируются), результат — список совпадений с привязкой к секции/блоку
- [ ] T031 [US3] Компонент `src/components/ProtocolSearch.vue`: поле ввода, счётчик «N из M», кнопки prev/next (≥44px), состояние «ничего не найдено»; разместить в `src/views/ProtocolView.vue` (зависит от T030)
- [ ] T032 [US3] Подсветка совпадений в блок-компонентах (утилита подсветки в `src/composables/useProtocolSearch.ts` или отдельный `src/components/HighlightedText.vue`) и скролл к активному совпадению (зависит от T031)
- [ ] T033 [P] [US3] Тест `tests/search.spec.ts`: регистронезависимость, буквальная трактовка спецсимволов, пустой результат → состояние «ничего не найдено»

**Checkpoint**: все четыре истории работают независимо

---

## Phase 7: PWA & Release (cross-cutting: FR-013, FR-015, DoD)

**Purpose**: полный офлайн, явные обновления, деплой на GitHub Pages

- [x] T034 [P] Иконки в `public/icons/`: pwa-192.png, pwa-512.png, maskable-512.png (простая абстрактная тёмная иконка, без имитации чужих брендов), favicon.svg
- [x] T035 Настроить vite-plugin-pwa в `vite.config.ts`: `registerType: 'prompt'`, `generateSW`, `globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']`, manifest (name «Med Helper», `display: standalone`, тёмные `theme_color`/`background_color`, иконки 192/512 + maskable, `lang: 'ru'`) (зависит от T034)
- [x] T036 Компонент `src/components/UpdateBanner.vue` на `useRegisterSW`: баннер «Доступно обновление» + кнопка применения (никаких молчаливых обновлений — конституция IV); подключить в `src/App.vue` (зависит от T035)
- [x] T037 Создать `.github/workflows/deploy.yml`: официальный Pages-workflow — checkout → setup-node (Node 22, npm cache) → `npm ci` → `npm run validate:data` → `npm run test` → `BASE_PATH=/medical-refference/ npm run build` → configure-pages (`enablement: true`) → upload-pages-artifact (`dist/`) → deploy-pages; permissions `pages: write`, `id-token: write`; триггер push в `main`
- [ ] T038 Закоммитить, запушить в `main`; проверить: Actions зелёный, приложение открывается на https://plismikhail.github.io/medical-refference/, deep-link `#/protocol/demo-protocol` работает (зависит от T037)

**Checkpoint**: сценарии 8–10 quickstart.md проходят (офлайн-перезагрузка, баннер обновления, деплой)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T039 [P] Написать `README.md`: назначение, установка (Node 22), команды (dev/build/preview/test/validate:data), как добавить протокол (JSON + запись в index.json, без правок кода), деплой, ссылки на конституцию и spec-артефакты (DoD: «README актуален»)
- [ ] T040 Прогнать все 10 сценариев `specs/001-protocol-viewer/quickstart.md` на прод-сборке (`npm run build && npm run preview` + мобильный viewport), исправить найденное
- [ ] T041 Финальная сверка DoD и конституции: `grep` по `src/components src/views` на отсутствие медицинского текста; вкладка Network — ноль внешних запросов; поля прослеживаемости видимы; чек-лист без интерпретаций; отметить чекбоксы DoD в quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: без зависимостей
- **Phase 2 (Foundational)**: после Phase 1 — БЛОКИРУЕТ все истории
- **Phase 3 (US1)**: после Phase 2
- **Phase 4 (US2)**: после Phase 3 (навигация встраивается в ProtocolView из T022)
- **Phase 5 (US4)**: после Phase 2 (не зависит от US1 — только App.vue и localStorage)
- **Phase 6 (US3)**: после Phase 3 (поиск ходит по данным протокола и подсвечивает в блоках)
- **Phase 7 (PWA & Release)**: после завершения желаемого набора историй (минимум US1)
- **Phase 8 (Polish)**: последняя

### User Story Dependencies

- **US1 (P1)**: только Foundational — независима
- **US2 (P2)**: технически встраивается в ProtocolView (US1), тестируется независимо на демо-протоколе
- **US4 (P2)**: независима от US1/US2/US3 — можно делать параллельно с US1
- **US3 (P3)**: использует рендерер US1 для подсветки; логика поиска (T030) независима

### Parallel Opportunities

- Phase 2: T005, T006, T007, T009 — параллельно; затем T008, T010, T011
- Phase 3: T013–T017 (пять файлов блоков) — параллельно; T020, T023, T024 — параллельно с соседями
- US4 (T028–T029) — параллельно с любой из Phase 3/4/6
- Phase 7: T034 параллельно с завершением историй
- Phase 8: T039 параллельно с T040

## Parallel Example: User Story 1

```bash
# Все блок-компоненты одновременно (разные файлы):
Task: "TextBlock, WarningBlock, TimerNoteBlock в src/components/blocks/"
Task: "CriteriaListBlock.vue в src/components/blocks/"
Task: "DosageTableBlock.vue в src/components/blocks/"
Task: "ChecklistBlock.vue + useChecklistState.ts"
Task: "UnknownBlock.vue в src/components/blocks/"
# Затем последовательно: registry.ts → ProtocolRenderer.vue → ProtocolView.vue
```

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2 (фундамент, валидация зелёная)
2. Phase 3 (US1) → **СТОП, проверить independent test US1** — это MVP
3. Можно сразу Phase 7 (T037–T038) и показать жене задеплоенный MVP с демо-протоколом

### Incremental Delivery

- Каждая следующая история (US2 → US4 → US3) — самостоятельный инкремент: реализовать → independent test → push (автодеплой)
- PWA-слой (Phase 7) не блокирует истории; молчаливых обновлений нет — баннер появится с первой же новой версией после T036

## Notes

- Коммит после каждой задачи или логической группы; push в `main` = деплой (после T037–T038)
- Медицинского текста в компонентах нет нигде — только плейсхолдеры в `demo-protocol.json` (конституция II/III)
- Неизвестный тип блока всегда виден как фоллбэк — это контракт расширяемости каркаса
- Новый протокол после этой фичи = JSON + запись в index.json (+ `validate:data` зелёный) — ноль правок кода
