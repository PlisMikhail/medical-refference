<script setup lang="ts">
/**
 * Баннер обновления service worker (T036, FR-015, конституция IV).
 *
 * ПОЧЕМУ ВООБЩЕ БАННЕР: конституция IV запрещает и молчаливую подмену версии
 * (`registerType: 'autoUpdate'`), и молчаливое залипание на старом кэше. Врач
 * обязан узнать, что версия протоколов изменилась, и применить обновление сам —
 * поэтому единственный путь наката новой версии проходит через эту кнопку.
 *
 * ПОЧЕМУ В ПОТОКЕ, А НЕ ПОВЕРХ ШАПКИ: закреплённая обвязка меряется в
 * `composables/useStickyChrome.ts` и держится на допущении «шапка липнет к
 * top: 0». Стоило бы баннеру встать в тот же sticky-стек — пришлось бы делать
 * `top` шапки динамическим и подмешивать высоту баннера во ВСЕ нижние
 * смещения (панель поиска, лента секций, якоря секций), а появление и скрытие
 * баннера сдвигало бы весь экран протокола. Поэтому баннер — обычный блок над
 * шапкой: он один раз раздвигает контент вниз, уезжает вверх при прокрутке и в
 * измерениях обвязки не участвует вовсе. `--app-header-height` остаётся
 * высотой шапки, арифметика обвязки не меняется ни на пиксель.
 *
 * ПОЧЕМУ НЕ ПРОКРУЧИВАЕМ К БАННЕРУ: если врач в этот момент читает дозировку,
 * дёрнуть страницу под ним — хуже, чем показать уведомление с задержкой до
 * ближайшей прокрутки наверх. Баннер объявляется ассистивным технологиям через
 * `role="status"` (вежливо, не перебивая), но экран не двигает.
 *
 * ЧЕСТНО, НО НЕ НАЗОЙЛИВО про офлайн-готовность: `offlineReady` — это факт,
 * прямо обещанный FR-015 («после первого открытия с сетью приложение работает
 * офлайн»), и врачу полезно знать, что справочник уже переживёт авиарежим.
 * Но это разовое событие установки, требовать по нему действия незачем:
 * показываем строку статуса, которая гаснет сама через OFFLINE_NOTICE_MS.
 * Уведомление об обновлении, наоборот, не гаснет никогда и ждёт нажатия.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()

/** Сколько держать сообщение «работает офлайн», прежде чем убрать его самому. */
const OFFLINE_NOTICE_MS = 6000

const offlineNoticeVisible = ref(false)
let offlineNoticeTimer: ReturnType<typeof setTimeout> | undefined

watch(
  offlineReady,
  (ready) => {
    clearTimeout(offlineNoticeTimer)
    offlineNoticeVisible.value = ready
    if (!ready) return
    offlineNoticeTimer = setTimeout(() => {
      offlineNoticeVisible.value = false
      // Гасим и сам флаг: повторно показывать установку смысла нет.
      offlineReady.value = false
    }, OFFLINE_NOTICE_MS)
  },
  { immediate: true },
)

onBeforeUnmount(() => clearTimeout(offlineNoticeTimer))

/**
 * Обновление важнее сообщения об офлайн-готовности: если пришло и то и другое,
 * место занимает кнопка применения, а не статус.
 */
const showOfflineNotice = computed(() => offlineNoticeVisible.value && !needRefresh.value)

const applying = ref(false)

async function applyUpdate(): Promise<void> {
  if (applying.value) return
  applying.value = true
  // true — перезагрузить страницу после активации нового SW: иначе врач
  // остался бы на старом коде рядом с новым кэшем.
  await updateServiceWorker(true)
}
</script>

<template>
  <!--
    Обёртки нет: когда обновления нет и статус погас, компонент не рендерит
    ничего — над шапкой не остаётся ни пустого блока, ни отступа.
  -->
  <div
    v-if="needRefresh"
    class="border-b border-accent/40 bg-surface-raised"
    role="status"
    aria-live="polite"
    data-testid="update-banner"
  >
    <div
      class="mx-auto flex w-full max-w-screen-sm flex-wrap items-center justify-between gap-3 px-4 py-3"
    >
      <p class="text-sm font-medium text-fg">Доступно обновление</p>

      <button
        type="button"
        class="touch-target inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-fg-inverse disabled:opacity-70"
        :disabled="applying"
        data-testid="update-banner-apply"
        @click="applyUpdate"
      >
        {{ applying ? 'Обновляем…' : 'Обновить' }}
      </button>
    </div>
  </div>

  <div
    v-else-if="showOfflineNotice"
    class="border-b border-border bg-surface"
    role="status"
    aria-live="polite"
    data-testid="offline-ready-notice"
  >
    <p class="mx-auto w-full max-w-screen-sm px-4 py-2 text-xs text-fg-muted">
      Справочник сохранён на устройстве и открывается без сети
    </p>
  </div>
</template>
