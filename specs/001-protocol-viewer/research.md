# Phase 0 Research: Просмотрщик клинических протоколов

**Date**: 2026-07-21. Все NEEDS CLARIFICATION из Technical Context закрыты.
Актуальность версий проверена по официальным источникам на июль 2026.

## R1. Сборщик: Vite 8 (Rolldown)

- **Decision**: Vite ^8 (актуальный мажор с марта 2026, Rust-бандлер Rolldown).
- **Rationale**: текущий стабильный мажор; быстрые сборки; экосистема плагинов
  совместима. Тянуть старый мажор в новый проект — технический долг с первого дня.
- **Alternatives considered**: Vite 7 (предыдущий мажор — незачем начинать со
  старого); Nuxt (SSR/мета-фреймворк не нужен статической PWA на двух экранах).

## R2. Фреймворк: Vue 3.5 stable (не 3.6-beta)

- **Decision**: Vue ^3.5 (последняя стабильная ветка), Composition API,
  `<script setup lang="ts">`.
- **Rationale**: Vue 3.6 (Vapor Mode) на июль 2026 — в RC/beta; в медицинский
  инструмент пре-релизы не тянем. Обновление на 3.6 после стабилизации —
  рутинный minor-апгрейд.
- **Alternatives considered**: Vue 3.6-rc — отклонено (пре-релиз); другие
  фреймворки не рассматривались (выбор владельца зафиксирован).

## R3. SPA-fallback на GitHub Pages: hash-режим роутера — РЕШЕНО

- **Decision**: `createWebHashHistory` (`vue-router` ^4.5); 404.html-хак не
  используется.
- **Rationale**:
  - GH Pages не умеет server-side rewrites; hash-режим не требует их вовсе —
    одна точка входа `index.html`, deep-link на `#/protocol/<id>` работает.
  - Офлайн-надёжность: SW-навигация всегда попадает в предкэшированный
    `index.html`; не нужен отдельный precache/fallback для 404.html.
  - Capacitor WebView: hash-роутинг работает идентично без настройки сервера —
    прямо поддерживает требование «путь к APK открыт».
  - Требование «никакой логики, завязанной на URL хостинга» — 404.html-копия
    это ровно такая логика (хак вокруг поведения конкретного хостинга).
  - Косметика URL (`/#/`) неважна для приложения на одного пользователя.
- **Alternatives considered**: `createWebHistory` + 404.html-копия index.html —
  отклонено: редирект с миганием при deep-link, лишний артефакт сборки,
  привязка к особенностям GH Pages, дополнительная точка отказа в офлайне.

## R4. База путей: переменная окружения

- **Decision**: `vite.config.ts` → `base: process.env.BASE_PATH ?? '/'`;
  GitHub Actions задаёт `BASE_PATH=/medical-refference/` на шаге сборки
  (репозиторий: <https://github.com/PlisMikhail/medical-refference>).
- **Rationale**: локальная разработка и будущая Capacitor-сборка используют
  `/` без правок конфига; знание об URL хостинга живёт только в CI-workflow.
- **Alternatives considered**: захардкодить `/<repo>/` (ломает Capacitor и
  локальный preview); `base: './'` (работает с hash-роутером, но относительные
  пути дают краевые эффекты в Workbox/manifest — env-вариант прямолинейнее).

## R5. CSS: Tailwind CSS 4.3, CSS-first, без UI-фреймворков

- **Decision**: Tailwind ^4.3 через официальный плагин `@tailwindcss/vite`;
  конфигурация CSS-first (`@theme` в `theme.css`), `tailwind.config.js` не
  создаётся. Цвета типов секций — design-токены:
  `--color-inclusion`, `--color-exclusion-absolute`,
  `--color-exclusion-relative`, плюс токены поверхностей тёмной темы.
- **Rationale**: v4 — актуальный мажор (v3-подход с JS-конфигом устарел);
  токены дают «одну цветовую тему» из требования владельца, а будущая
  альтернативная тема (например, для дальтоника) — это замена значений
  токенов, не переделка компонентов. Тяжёлые UI-киты запрещены вводными.
- **Alternatives considered**: Tailwind v3 (устаревший мажор); UnoCSS
  (эквивалентен по возможностям, Tailwind выбран владельцем); ручной CSS
  (медленнее итерации, требование mobile-first утилит).

## R6. Язык: TypeScript strict

- **Decision**: TypeScript 5.x, `strict: true`; `src/types/protocol.ts` —
  discriminated union по `Block['type']`.
- **Rationale**: главный инструмент дешёвой расширяемости data-driven
  рендерера: при добавлении нового типа блока компилятор перечисляет все
  места, требующие правки (union, registry, схема). Для JSON-данных типы
  синхронизированы со схемой контракта.
- **Alternatives considered**: plain JS — отклонено: ошибки формы данных
  всплывали бы в рантайме у пользователя, а не на сборке.

## R7. Загрузка контента: `import.meta.glob`, без сетевых запросов

- **Decision**: `index.json` — eager-импорт (нужен главному экрану сразу);
  файлы протоколов — lazy `import.meta.glob('/src/data/protocols/*.json')`
  (отдельные чанки, попадают в precache SW автоматически).
- **Rationale**: добавление протокола = положить JSON + запись в `index.json`,
  glob подхватывает файл на сборке без правок кода (конституция III);
  данных-запросов в рантайме нет вообще — FR-013 выполняется по построению,
  нет гонки «первый заход vs установка SW».
- **Alternatives considered**: `fetch` из `public/` — отклонено (рантайм-сеть,
  зависимость от готовности SW при первом заходе); ручные статические импорты —
  отклонено (правка кода на каждый протокол).

## R8. Валидация данных: JSON Schema 2020-12 + Ajv (dev и CI)

- **Decision**: канонические схемы `protocol.schema.json` / `index.schema.json`
  (draft 2020-12). Три рубежа:
  1. dev-рантайм: `useDevValidation.ts`, Ajv динамически импортируется только
     при `import.meta.env.DEV`; ошибка — файл + путь (`instancePath`) +
     сообщение, рендерится читаемым оверлеем;
  2. CI/локально: `npm run validate:data` → `scripts/validate-protocols.mjs` —
     схемы + кросс-проверки: каждый файл протокола есть в реестре, каждая
     запись реестра имеет файл, `title/version/sourceDate` в реестре совпадают
     с файлом протокола (защита от рассинхрона медицинских метаданных);
  3. редактор: `"$schema"` в каждом JSON — VS Code подсвечивает ошибки прямо
     при ручном редактировании контента.
  Схема знает типы блоков v1 строго; блоки с незнакомым `type` допустимы
  (валиден любой объект с полем `type: string`) — это контрактная опора для
  видимого фоллбэка FR-006; dev-валидатор выводит предупреждение о незнакомом
  типе, но не ошибку.
- **Rationale**: схема — тоже данные (конституция III), переносима, читается
  инструментами; Ajv в prod-бандл не попадает.
- **Alternatives considered**: Zod — отклонено (схема заперта в TS-коде,
  редактор не подсказывает при правке JSON); ручной валидатор — отклонено
  (качество сообщений об ошибках, расползание логики).

## R9. PWA: vite-plugin-pwa 1.3, обновления только через prompt

- **Decision**: vite-plugin-pwa ^1.3 (поддерживает Vite 8), стратегия
  `generateSW`, `registerType: 'prompt'`; `UpdateBanner.vue` на `useRegisterSW`
  показывает «Доступно обновление» с кнопкой применения. Precache: `globPatterns`
  на `**/*.{js,css,html,svg,png,ico,webmanifest}` (JSON протоколов уже внутри
  JS-чанков). Manifest: `display: standalone`, тёмные `theme_color` /
  `background_color`, иконки 192/512 + maskable 512.
- **Rationale**: конституция IV прямо запрещает и молчаливое обновление, и
  молчаливое залипание на старом кэше — `prompt` единственная соответствующая
  стратегия; `generateSW` покрывает потребности без кастомного SW.
- **Alternatives considered**: `registerType: 'autoUpdate'` — запрещено
  конституцией; `injectManifest` (свой SW) — YAGNI, нет кастомной логики кэша.

## R10. Навигация по секциям: sticky-табы — РЕШЕНО

- **Decision**: горизонтальная лента цветных табов-чипов секций, закреплённая
  под шапкой экрана протокола; тап — плавный скролл к якорю секции; активная
  секция подсвечивается при скролле (IntersectionObserver). Цвет чипа = токен
  типа секции.
- **Rationale**: секция достижима в один тап из любой точки прокрутки (FR-003)
  без промежуточного открытия оглавления — критично для цейтнота; протоколы
  ожидаются с 5–10 секциями, лента с горизонтальной прокруткой вмещает их.
- **Alternatives considered**: кнопка-оглавление (bottom sheet) — два тапа,
  отклонено; обе опции сразу — YAGNI.

## R11. Состояние: composables, без Pinia

- **Decision**: `useProtocols`, `useDisclaimer` (localStorage),
  `useChecklistState` (эфемерно, сброс при unmount), `useProtocolSearch`,
  плюс `useRegisterSW` из vite-plugin-pwa в `UpdateBanner`.
- **Rationale**: два экрана и четыре независимых куска состояния — стор-слой
  избыточен; composables соответствуют модульной философии (фича = свой
  composable + компоненты).
- **Alternatives considered**: Pinia — отклонено для MVP решением владельца;
  добавляется позже точечно, если появится cross-view состояние.

## R12. Тесты: Vitest 4.1, smoke по FR

- **Decision**: Vitest ^4.1 + @vue/test-utils + happy-dom. Минимальный набор,
  привязанный к FR: все типы блоков v1 рендерятся из фикстуры (FR-005);
  неизвестный тип — видимый фоллбэк с указанием типа (FR-006); отметки
  чек-листа не переживают remount (FR-007); поиск без учёта регистра и
  состояние «ничего не найдено» (FR-008). Плюс `validate:data` как отдельный
  обязательный шаг CI.
- **Rationale**: тесты охраняют контракт каркаса (рендерер/фоллбэк), а не
  процент покрытия; Vitest 4.1 совместим с Vite 8.
- **Alternatives considered**: E2E (Playwright) — YAGNI для MVP, ручной
  quickstart-прогон покрывает сценарии; без тестов вовсе — отклонено, фоллбэк
  и непersистентность чек-листа легко сломать незаметно.

## R13. Деплой: официальный GitHub Pages workflow

- **Decision**: `.github/workflows/deploy.yml` — actions/checkout,
  actions/setup-node (Node 22, кэш npm), `npm ci`, `npm run validate:data`,
  `npm run test`, `BASE_PATH=/medical-refference/ npm run build`,
  actions/configure-pages (`enablement: true` — включает Pages при первом
  прогоне без ручного похода в Settings) + upload-pages-artifact +
  deploy-pages. Триггер: push в `main`.
- **Rationale**: официальный Pages-путь (artifact-based) — без ветки gh-pages
  и сторонних экшенов; валидация данных и тесты — обязательные шаги перед
  деплоем (DoD).
- **Status**: публичный репозиторий создан —
  <https://github.com/PlisMikhail/medical-refference>; локальный git
  инициализирован (`main`), remote `origin` настроен. Первый push — в ходе
  реализации. Итоговый URL приложения:
  `https://plismikhail.github.io/medical-refference/`.
- **Alternatives considered**: ветка gh-pages + peaceiris/actions-gh-pages —
  отклонено (лишняя ветка, сторонний экшен при наличии официального пути).

## R14. Открытый путь к Capacitor

- **Decision**: правила, соблюдаемые в этой фиче: hash-роутинг (работает в
  WebView без сервера), `base` из env (в Capacitor — `/`), хранилище — только
  `localStorage`, никаких web-only API (Web Share, File System Access,
  Badging и т.п.), никаких абсолютных URL и логики, зависящей от хостинга.
  Зависимости Capacitor не добавляются (конституция: «не блокировать, но не
  тащить заранее»).
- **Rationale**: перечисленное — полный набор типовых блокеров упаковки
  статической SPA в APK; исключив их сейчас, упаковка позже сведётся к
  `npx cap add android` поверх готового `dist/`.

## Sources

- [Vite 8.0 is out!](https://vite.dev/blog/announcing-vite8) / [Vite releases](https://vite.dev/releases)
- [vite-plugin-pwa releases](https://github.com/vite-pwa/vite-plugin-pwa/releases) / [Vite PWA docs](https://vite-pwa-org.netlify.app/)
- [Tailwind CSS blog / releases](https://tailwindcss.com/blog)
- [Vitest 4.1](https://vitest.dev/blog/vitest-4-1.html) / [Vitest releases](https://github.com/vitest-dev/vitest/releases)
- [Vue.js releases](https://vuejs.org/about/releases) / [vuejs/core releases](https://github.com/vuejs/core/releases)
