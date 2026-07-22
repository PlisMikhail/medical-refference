# Specification Quality Checklist: Памятка по ВСТЭ при остром ишемическом инсульте

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
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

## Notes

Маркеров [NEEDS CLARIFICATION] нет: состав памятки, разбивка критериев отбора
на четыре секции и порядок работы с черновым статусом получены от владельца
до написания спеки (владелец — сам врач).

Три места, где спека сознательно отступает от «чистого WHAT» и называет вещи
своими именами, потому что иначе требование становится непроверяемым:

1. **FR-013 требует машинного доказательства дословности.** Это ограничение
   на способ проверки, а не на реализацию: «переписано дословно» без машинной
   проверки — утверждение, а не факт. Инструмент существует с фичи 002.
2. **FR-014 говорит о списке исключений.** Это не деталь реализации, а рабочий
   артефакт врача: конечный список того, что человек обязан прочитать глазами.
3. **FR-027 запрещает править код в этой фиче.** Граница фичи, а не решение
   об архитектуре.

Отдельно зафиксировано в edge cases и подлежит выносу владельцу: внутреннее
противоречие исходного документа — п. 37 отсылает за антиагрегантными ЛП
к п. 41, тогда как схема изложена в п. 40, а п. 41 про индикаторы
эффективности. Транскрипция сохранит текст как есть.
