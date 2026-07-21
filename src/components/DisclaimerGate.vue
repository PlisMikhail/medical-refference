<script setup lang="ts">
/**
 * Дисклеймер первого запуска (T029, FR-009, SC-006).
 *
 * ПОЛНОЭКРАННЫЙ ОВЕРЛЕЙ ДО ЛЮБОГО КОНТЕНТА: `fixed inset-0` с непрозрачным
 * фоном перекрывает и шапку, и ленту секций — под ним ничего не прочитать.
 * Вдобавок App.vue вовсе НЕ рендерит шапку, `<router-view>` и футер, пока
 * подтверждения нет: содержимое протокола не попадает в DOM, а значит его
 * нельзя ни увидеть, ни сфокусировать, ни достать поиском по странице.
 * Поэтому здесь не нужна ловушка фокуса — фокусировать за пределами гейта
 * попросту нечего.
 *
 * КОМПОНЕНТ НАМЕРЕННО «ГЛУПЫЙ»: он ничего не знает про localStorage и не
 * решает, показывать ли себя. Он показывает текст и сообщает наверх событием
 * `accept`. Хранение — дело `composables/useDisclaimer.ts`, показ — дело
 * App.vue; так гейт тестируется отдельно, а логика подтверждения — отдельно.
 *
 * ТЕКСТ — из `constants/disclaimer.ts`, единственного источника формулировки
 * (та же строка стоит в футере App.vue). Собственного текста дисклеймера в
 * этом файле нет и быть не должно.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { DISCLAIMER_TEXT } from '@/constants/disclaimer'

defineEmits<{ accept: [] }>()

const confirmEl = ref<HTMLButtonElement | null>(null)

/**
 * Пока гейт открыт, страница под ним не прокручивается: без этого на мобильном
 * фон уезжает под фиксированным оверлеем, и появляется ощущение, что контент
 * «где-то там» доступен. Прежнее значение восстанавливается при размонтировании,
 * чтобы гейт не оставил после себя заблокированную прокрутку.
 */
let previousOverflow = ''

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  // Фокус сразу на кнопке подтверждения: единственное действие на экране.
  confirmEl.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex flex-col bg-background px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-fg"
    role="dialog"
    aria-modal="true"
    aria-labelledby="disclaimer-text"
    data-testid="disclaimer-gate"
  >
    <div class="mx-auto flex w-full max-w-screen-sm grow flex-col justify-center gap-8">
      <p
        id="disclaimer-text"
        class="text-center text-base leading-relaxed text-fg"
        data-testid="disclaimer-text"
      >
        {{ DISCLAIMER_TEXT }}
      </p>

      <button
        ref="confirmEl"
        type="button"
        class="touch-target flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 text-base font-semibold text-fg-inverse"
        data-testid="disclaimer-accept"
        @click="$emit('accept')"
      >
        Подтверждаю
      </button>
    </div>
  </div>
</template>
