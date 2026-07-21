# Specification Quality Checklist: Памятка по ВВ ТЛТ

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — см. примечание 1
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Constitution Check (проектная конституция v1.0.0)

- [x] **I. Справочник, а не советчик** — памятка только отображает текст протокола;
      FR-005 требует статическую таблицу дозировок, US2 сценарий 2 явно проверяет
      отсутствие расчёта дозы по весу. Калькуляторов в фиче нет.
- [x] **II. Запрет на генерацию контента** — FR-009, FR-010, FR-013, FR-014
      и SC-004 прямо запрещают контент, отсутствующий в источнике; US3 делает
      врачебную сверку условием приёмки, FR-016/017 не дают выдать несверенное
      за проверенное.
- [x] **III. Данные отдельно от кода** — FR-018 и SC-008 требуют нулевых изменений
      кода; это и есть проверка того, что каркас фичи 001 действительно
      расширяется данными.
- [x] **IV. Полный офлайн** — FR-019, SC-007.
- [x] **V. Прослеживаемость** — FR-011, FR-015; карта сверки как отдельная
      сущность.
- [x] **VI. Приватность** — фича не вводит никакого взаимодействия с сетью.
- [x] **VII. Работоспособность web-сборки** — фича не трогает сборку; FR-019
      требует прохождения существующей валидации.

Нарушений нет. Обоснования в Complexity Tracking не требуются.

## Notes

1. **Принятое отступление по «no implementation details».** Спека называет
   реестр протоколов, типы секций и типы блоков. Это не детали реализации,
   а контракт данных, зафиксированный фичей 001: именно в этих терминах врач
   ревьюит контент (конституция, принцип III). Без них требования «не изобретать
   тип блока» и «не вводить деление на абсолютные/относительные» невыразимы.

2. **Открытые вопросы отсутствуют.** Три развилки, которые могли бы стать
   [NEEDS CLARIFICATION], владелец закрыл до написания спеки:
   деление противопоказаний (не делить), состав дополнительных секций
   (АД + нейровизуализация + после ТЛТ), судьба сокращений (оставить как
   в документе).

3. **Единственный внешний блокер** — врачебная сверка (US3, FR-017). До неё
   фича считается завершённой в состоянии «черновик»: контент на месте,
   помечен как несверенный.
