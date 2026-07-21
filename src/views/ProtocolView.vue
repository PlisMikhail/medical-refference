<script setup lang="ts">
/**
 * Экран протокола (T022).
 *
 * Собирает вместе: загрузку по id (useProtocols), dev-валидацию
 * (useDevValidation), метаданные прослеживаемости (ProtocolMeta, FR-002) и
 * рендерер (ProtocolRenderer). Медицинского текста здесь нет — только
 * интерфейсная лексика и сообщения об ошибках (конституция III).
 *
 * Ни одна ветка не даёт белого экрана (FR-014): загрузка, любая из трёх
 * ошибок и «протокол не отдал данных» имеют явное состояние с путём назад.
 *
 * Phase 4 (T026): между метаданными и рендерером стоит ProtocolSectionNav —
 * закреплённая лента секций. Она прилипает под шапкой приложения и остаётся
 * видимой из любой точки прокрутки (FR-003), в том числе в самом низу
 * документа; секции при этом получают отступ якоря под всю обвязку.
 *
 * Phase 6 (T031): над лентой секций — ProtocolSearch. Экран владеет
 * состоянием поиска и раздаёт его вниз: панели — чтобы считать и
 * переключать совпадения, блокам — чтобы подсвечивать. Запрос живёт ровно
 * столько же, сколько открытый протокол (data-model), и нигде не хранится.
 */
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import ProtocolMeta from '@/components/ProtocolMeta.vue'
import ProtocolRenderer from '@/components/ProtocolRenderer.vue'
import ProtocolSearch from '@/components/ProtocolSearch.vue'
import ProtocolSectionNav from '@/components/ProtocolSectionNav.vue'
import { provideChecklistState } from '@/composables/useChecklistState'
import { useDevValidation } from '@/composables/useDevValidation'
import type { ProtocolErrorCode } from '@/composables/useProtocols'
import { useProtocols } from '@/composables/useProtocols'
import { provideProtocolSearch } from '@/composables/useProtocolSearch'

const props = defineProps<{ id: string }>()

const { protocol, loading, error, loadProtocol } = useProtocols()
const { issues, validate } = useDevValidation()

/**
 * Поиск по ОТКРЫТОМУ протоколу (FR-008): состояние привязано к этой ссылке,
 * поэтому за пределы текущего документа поиск не выходит по построению.
 */
const search = provideProtocolSearch(protocol)

/**
 * Хранилище отметок чек-листов живёт ровно столько, сколько этот экран
 * (FR-007). Ниже оно ещё и очищается при смене протокола — открытие другого
 * протокола не должно наследовать чужие отметки.
 */
const checklist = provideChecklistState()

/** Подсказка «что делать» под сообщением загрузчика — интерфейс, не контент. */
const ERROR_HINTS: Record<ProtocolErrorCode, string> = {
  'not-in-registry': 'Возможно, ссылка устарела. Откройте протокол из списка.',
  'file-missing': 'Файл протокола не вошёл в сборку — сообщите об этом разработчику.',
  'load-failed': 'Попробуйте открыть протокол ещё раз или перезапустить приложение.',
}

const errorHint = computed(() => (error.value ? ERROR_HINTS[error.value.code] : ''))

watch(
  () => props.id,
  async (id) => {
    checklist.clear()
    // Другой протокол — другой документ: чужая строка поиска здесь не нужна.
    search.reset()
    const loaded = await loadProtocol(id)
    // DEV-only: в прод-сборке no-op, Ajv в бандл не попадает.
    await validate(loaded)
  },
  { immediate: true },
)
</script>

<template>
  <section>
    <p v-if="loading" class="text-sm text-fg-muted" data-testid="protocol-loading">
      Загрузка протокола…
    </p>

    <div
      v-else-if="error"
      class="rounded-lg border border-exclusion-absolute/60 bg-surface p-4"
      data-testid="protocol-error"
      role="alert"
    >
      <p class="text-sm text-fg">{{ error.message }}</p>
      <p class="mt-1 text-xs text-fg-muted">{{ errorHint }}</p>
      <RouterLink
        class="touch-target mt-3 inline-flex items-center rounded-lg border border-border bg-surface-raised px-4 text-sm text-accent"
        to="/"
      >
        К списку протоколов
      </RouterLink>
    </div>

    <template v-else-if="protocol">
      <h1 class="text-lg leading-snug font-semibold text-fg">{{ protocol.title }}</h1>

      <!-- FR-002 / конституция V: прослеживаемость видна всегда -->
      <ProtocolMeta class="mt-3" :protocol="protocol" />

      <!--
        DEV-рубеж: если данные не сходятся со схемой, показываем это на экране,
        а не только в консоли. В прод-сборке issues всегда пуст.
      -->
      <div
        v-if="issues.length > 0"
        class="mt-3 rounded-lg border border-warning/60 bg-surface p-3 text-xs"
        data-testid="dev-validation"
      >
        <p class="font-medium text-warning">Данные не соответствуют схеме (dev):</p>
        <ul class="mt-1 flex flex-col gap-0.5 text-fg-muted">
          <li v-for="issue in issues" :key="`${issue.file}${issue.instancePath}${issue.message}`">
            {{ issue.file }} {{ issue.instancePath }} — {{ issue.message }}
          </li>
        </ul>
      </div>

      <!--
        FR-008: поиск живёт над лентой секций и остаётся на экране при
        прокрутке — кнопки «дальше/назад» нужны именно тогда, когда документ
        уже уехал к очередному совпадению.
      -->
      <ProtocolSearch class="mt-5" />

      <!--
        FR-003: один тап до любой секции из любой точки прокрутки. Лента
        стоит здесь, а не над метаданными, чтобы прилипать сразу над
        содержимым; переход делает scrollIntoView, адрес маршрута
        (`#/protocol/:id`) при этом не трогается — хеш занят роутером.
      -->
      <ProtocolSectionNav :sections="protocol.sections" />

      <ProtocolRenderer class="mt-5" :protocol="protocol" />
    </template>

    <p v-else class="text-sm text-fg-muted" data-testid="protocol-empty">
      Протокол не загружен.
    </p>
  </section>
</template>
