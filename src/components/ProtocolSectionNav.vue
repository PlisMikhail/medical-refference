<script setup lang="ts">
/**
 * Лента секций протокола (T025) — закреплённая горизонтально прокручиваемая
 * полоса чипов. Прилипает под шапкой и панелью поиска: точка прилипания
 * считается из ИЗМЕРЕННЫХ высот обоих (`sticky-under-search`), а не из
 * подобранной константы — см. composables/useStickyChrome.ts.
 *
 * ПОЧЕМУ ТАБЫ, А НЕ ОГЛАВЛЕНИЕ (research R10): секция достижима в ОДИН тап из
 * любой точки прокрутки, без промежуточного открытия шторки. Сценарий —
 * приёмное отделение, цейтнот: лишний тап здесь стоит секунд.
 *
 * ЦВЕТ ЧИПА = токен типа секции. Различение только цветом — осознанное решение
 * владельца для единственного известного пользователя (spec, Assumptions):
 * иконок и текстовых бейджей «для доступности» здесь намеренно нет.
 *
 * ЯКОРЬ — ТОЛЬКО ПРОГРАММНЫЙ. Роутер работает в hash-режиме
 * (`#/protocol/tlt-ischemic-stroke`), хеш уже занят маршрутом: `href="#section-id"`
 * снёс бы адрес маршрута и увёл приложение на редирект. Поэтому чип — <button>,
 * а переход делает `scrollIntoView`; адрес не меняется вовсе.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useWideScreen } from '@/composables/useMediaQuery'
import { chromeHeight, useChromeHeight } from '@/composables/useStickyChrome'
import type { Section, SectionKind } from '@/types/protocol'

const props = defineProps<{ sections: Section[] }>()

/**
 * Раскладка (фича 004). На широком экране лента чипов заменяется вертикальным
 * оглавлением: тринадцать секций помещаются целиком, и нужная выбирается без
 * предварительного поиска чипа.
 *
 * В DOM живёт РОВНО ОДНО представление, а не два спрятанных стилями — иначе
 * каждая секция оказалась бы в документе дважды (research.md § R2).
 *
 * Вся логика ниже — подсветка активной секции, переход по клику — общая для
 * обоих представлений. Различается только разметка: раздваивать поведение
 * значило бы завести второй набор багов.
 */
const isWide = useWideScreen()

/**
 * kind → классы чипа. Только строковые литералы: Tailwind v4 собирает лишь те
 * классы, которые видит в исходнике (тот же приём, что в CriteriaListBlock).
 * `default` остаётся нейтральным — цветом маркируются только значимые типы.
 */
const KIND_CHIP_STYLES = {
  default: 'border-border bg-surface-raised text-fg-muted',
  inclusion: 'border-inclusion/60 bg-inclusion/15 text-inclusion',
  'exclusion-absolute':
    'border-exclusion-absolute/60 bg-exclusion-absolute/15 text-exclusion-absolute',
  'exclusion-relative':
    'border-exclusion-relative/60 bg-exclusion-relative/15 text-exclusion-relative',
} as const satisfies Record<SectionKind, string>

/**
 * Активность — ДОПОЛНИТЕЛЬНЫЙ слой поверх цвета типа, а не замена: `ring-current`
 * берёт цвет из `text-*` самого чипа, поэтому подсветка активной секции нигде
 * не перебивает цветовую маркировку типа.
 */
const ACTIVE_CHIP_STYLE = 'font-semibold ring-2 ring-current'

/** Тип секции из данных может оказаться незнакомым — красим нейтрально. */
function chipStyle(section: Section): string {
  const kind = section.kind ?? 'default'
  return Object.hasOwn(KIND_CHIP_STYLES, kind) ? KIND_CHIP_STYLES[kind] : KIND_CHIP_STYLES.default
}

const navEl = ref<HTMLElement | null>(null)
const stripEl = ref<HTMLElement | null>(null)
const activeId = ref('')

/**
 * Публикуем собственную высоту: из неё складывается scroll-margin-top секций.
 *
 * ВАЖНО: `navEl` привязан ТОЛЬКО к горизонтальной ленте. В режиме оглавления
 * навигация уезжает вбок и над содержимым её больше нет — значит и в отступ
 * якоря она входить не должна. Ссылка там остаётся пустой, композабл публикует
 * ноль, отступ уменьшается сам. Привяжи её к сайдбару — и отступ вырос бы
 * на всю высоту оглавления, а переход по клику уводил бы секцию в середину
 * экрана (research.md § R4).
 */
useChromeHeight(navEl, 'section-nav')

/* ------------------------------------------------------------------ */
/* Активная секция                                                     */
/* ------------------------------------------------------------------ */

/** Секции, пересекающие «читаемую» зону вьюпорта. Порядок здесь не важен. */
const intersecting = new Set<string>()
let observer: IntersectionObserver | null = null

/**
 * Идёт ли сейчас переход по тапу. На это время выбор активной секции
 * заморожен: цель известна, а промежуточные секции, мелькающие по дороге,
 * не должны её перебивать.
 */
let programmaticScroll = false
let scrollSettleTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Страховка на случай, если `scrollend` не поддержан или скролл никуда не
 * поехал (секция уже на месте) — иначе заморозка осталась бы навсегда.
 */
const SCROLL_SETTLE_MS = 800

function endProgrammaticScroll(): void {
  clearTimeout(scrollSettleTimer)
  scrollSettleTimer = undefined
  if (!programmaticScroll) return
  programmaticScroll = false
  // Скролл закончился — сверяем подсветку с тем, что реально на экране.
  pickActive()
}

function beginProgrammaticScroll(): void {
  programmaticScroll = true
  clearTimeout(scrollSettleTimer)
  scrollSettleTimer = setTimeout(endProgrammaticScroll, SCROLL_SETTLE_MS)
}

function sectionElements(): HTMLElement[] {
  return props.sections
    .map((section) => document.getElementById(section.id))
    .filter((element): element is HTMLElement => element !== null)
}

/**
 * Низ документа. Последняя секция часто короче экрана и никогда не станет
 * «самой верхней видимой» — без этой проверки её чип не подсветится вообще.
 * Порог в 2px — запас на дробные значения devicePixelRatio.
 */
function atDocumentBottom(): boolean {
  const doc = document.documentElement
  if (doc.scrollHeight <= window.innerHeight) return false
  return window.scrollY + window.innerHeight >= doc.scrollHeight - 2
}

/**
 * Одновременно видимых секций может быть несколько — активной считаем самую
 * верхнюю по порядку документа (та, что врач читает сейчас). Если не видно ни
 * одной, прежняя остаётся активной: мигающая лента хуже слегка устаревшей.
 */
function pickActive(): void {
  // Пока страница едет к выбранной секции, вьюпорт проходит через все
  // промежуточные — и наблюдатель честно подсвечивал бы каждую. Врач видел бы
  // мечущуюся ленту вместо перехода. Цель тапа уже известна, менять её по
  // дороге незачем.
  if (programmaticScroll) return

  if (atDocumentBottom()) {
    const last = props.sections.at(-1)
    if (last) activeId.value = last.id
    return
  }

  const topmost = props.sections.find((section) => intersecting.has(section.id))
  if (topmost) activeId.value = topmost.id
}

function disconnectObserver(): void {
  observer?.disconnect()
  observer = null
  intersecting.clear()
}

function connectObserver(): void {
  disconnectObserver()
  // happy-dom и старые webview не знают IntersectionObserver: подсветка просто
  // не работает, лента остаётся кликабельной. Падать здесь нельзя.
  if (typeof IntersectionObserver === 'undefined') return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) intersecting.add(entry.target.id)
        else intersecting.delete(entry.target.id)
      }
      pickActive()
    },
    {
      // Сверху отрезаем ровно измеренную обвязку — секция, спрятанная под
      // шапкой и лентой, не считается видимой. Снизу отрезаем 40%: активна та
      // секция, что в верхней части экрана, а не та, что едва показалась.
      rootMargin: `-${chromeHeight.value}px 0px -40% 0px`,
      threshold: 0,
    },
  )

  for (const element of sectionElements()) observer.observe(element)
}

/** Секции живут в соседнем компоненте — ждём, пока их DOM появится. */
async function refreshObserver(): Promise<void> {
  await nextTick()
  connectObserver()
  pickActive()
}

/* ------------------------------------------------------------------ */
/* Переход по тапу                                                     */
/* ------------------------------------------------------------------ */

/** Запас у края ленты: чип не должен упираться в границу впритык. */
const REVEAL_GUTTER = 16

/**
 * Подтягивает чип в видимую часть ленты — и только если он оттуда ушёл.
 *
 * Раньше чип центрировался всегда, поэтому лента ехала даже от тапа по
 * полностью видимому чипу. Теперь она стоит на месте, пока активный чип виден,
 * и сдвигается ровно настолько, чтобы показать уехавший.
 *
 * В режиме оглавления `stripEl` пуст, и функция выходит сразу — подтягивать
 * там нечего: все секции видны одновременно. Если протокол когда-нибудь
 * разрастётся настолько, что оглавление начнёт прокручиваться (страховочный
 * `max-h` в шаблоне), активный пункт за нижним краем сам не покажется —
 * тогда и появится повод завести вертикальный вариант этой функции.
 */
function revealChip(id: string): void {
  const strip = stripEl.value
  const chip = strip?.querySelector<HTMLElement>(`[data-section-chip="${id}"]`)
  if (!strip || !chip) return

  const viewLeft = strip.scrollLeft
  const viewRight = viewLeft + strip.clientWidth
  const chipLeft = chip.offsetLeft
  const chipRight = chipLeft + chip.offsetWidth

  let target: number
  if (chipLeft - REVEAL_GUTTER < viewLeft) target = chipLeft - REVEAL_GUTTER
  else if (chipRight + REVEAL_GUTTER > viewRight)
    target = chipRight + REVEAL_GUTTER - strip.clientWidth
  else return // чип виден целиком — ленту не трогаем вовсе

  const left = Math.max(0, Math.min(target, strip.scrollWidth - strip.clientWidth))
  if (Math.abs(left - viewLeft) < 1) return

  if (typeof strip.scrollTo === 'function') strip.scrollTo({ left, behavior: 'smooth' })
  else strip.scrollLeft = left
}

/**
 * Прокрутка ленты колесом мыши.
 *
 * ЗАЧЕМ: полоса прокрутки у ленты спрятана — на телефоне она только мозолит
 * глаза, а пальцем лента и так свайпается. С мышью же взяться было не за что
 * вовсе: колесо крутит страницу по вертикали, а лента горизонтальная. Чипы за
 * правым краем оказывались недостижимы — на тринадцати секциях это половина
 * ленты. Полоса прокрутки возвращена для точных указателей (см. шаблон), плюс
 * колесо здесь переводится в горизонтальную прокрутку.
 *
 * `preventDefault` — ТОЛЬКО если лента реально поехала. На краях и на
 * неперполненной ленте событие остаётся странице: иначе колесо над лентой
 * молча переставало листать документ, что хуже исходной проблемы.
 */
function onWheel(event: WheelEvent): void {
  const strip = stripEl.value
  if (!strip || strip.scrollWidth <= strip.clientWidth) return

  // Трекпады и горизонтальные колёса шлют deltaX сами — им мешать не нужно.
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

  const before = strip.scrollLeft
  strip.scrollLeft += event.deltaY
  if (strip.scrollLeft !== before) event.preventDefault()
}

/**
 * Тап по чипу: плавный скролл к секции. Отступ под обвязку берёт на себя
 * `scroll-under-chrome` (scroll-margin-top секции), поэтому здесь достаточно
 * `block: 'start'` — никакой ручной арифметики со смещениями.
 *
 * `revealChip` здесь не вызывается: его дёрнет `watch(activeId)`, а два
 * скролла ленты подряд как раз и выглядели дёрганьем.
 */
function goToSection(section: Section): void {
  beginProgrammaticScroll()
  activeId.value = section.id
  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ------------------------------------------------------------------ */
/* Жизненный цикл                                                      */
/* ------------------------------------------------------------------ */

onMounted(() => {
  void refreshObserver()
  window.addEventListener('scroll', pickActive, { passive: true })
  // Точный сигнал «скролл докатился». Поддержан не везде, поэтому дублируется
  // таймером в beginProgrammaticScroll.
  window.addEventListener('scrollend', endProgrammaticScroll)
})

// Другой протокол или изменившаяся высота обвязки — пересобираем наблюдатель:
// rootMargin у IntersectionObserver задаётся один раз при создании.
watch(
  () => [props.sections, chromeHeight.value] as const,
  () => void refreshObserver(),
)

// Скролл увёл активную секцию — её чип не должен остаться за краем ленты.
watch(activeId, (id) => revealChip(id))

onBeforeUnmount(() => {
  disconnectObserver()
  clearTimeout(scrollSettleTimer)
  window.removeEventListener('scroll', pickActive)
  window.removeEventListener('scrollend', endProgrammaticScroll)
})
</script>

<template>
  <!--
    ШИРОКИЙ ЭКРАН: вертикальное оглавление сбоку (FR-001).

    Липнет под шапкой — панель поиска стоит в соседней колонке и над ним
    не находится, поэтому `sticky-under-header`, а не `-under-search`.
    `max-h` + `overflow-y-auto` — страховка на случай протокола с очень
    большим числом секций: тринадцать помещаются свободно, сорок бы уехали
    за нижний край экрана.
  -->
  <nav
    v-if="isWide"
    aria-label="Секции протокола"
    class="sticky-under-header max-h-[calc(100dvh-var(--app-header-height,0px)-2rem)] overflow-y-auto py-1"
    data-testid="section-nav"
    data-nav-layout="sidebar"
  >
    <ul class="flex flex-col gap-1 p-0.5">
      <li v-for="section in sections" :key="section.id">
        <button
          type="button"
          class="w-full rounded-lg border px-3 py-2 text-left text-sm leading-snug"
          :class="[chipStyle(section), activeId === section.id ? ACTIVE_CHIP_STYLE : '']"
          :data-section-chip="section.id"
          :data-chip-kind="section.kind ?? 'default'"
          :aria-current="activeId === section.id ? 'true' : undefined"
          @click="goToSection(section)"
        >
          {{ section.title }}
        </button>
      </li>
    </ul>
  </nav>

  <!-- УЗКИЙ ЭКРАН: прежняя лента чипов, без изменений в поведении (FR-002). -->
  <nav
    v-else
    ref="navEl"
    aria-label="Секции протокола"
    class="sticky-under-search z-5 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    data-testid="section-nav"
    data-nav-layout="strip"
  >
    <!--
      `p-0.5` — место для обводки активного чипа. `overflow-x-auto` по спеке
      лишает контейнер вертикального `visible`, поэтому внешняя обводка
      (`ring-2`) обрезалась бы снизу и сверху, а у крайних чипов — по бокам.
      Отступ равен толщине обводки: чипы сдвигаются на 2px, срез уходит.

      Полоса прокрутки: спрятана для грубых указателей (палец — лента и так
      свайпается, полоса только съедала бы высоту) и ВОЗВРАЩЕНА для точных.
      Мышью иначе не за что взяться: чипы за правым краем были недостижимы.
      Колесо переводится в горизонтальную прокрутку обработчиком выше.
    -->
    <div
      ref="stripEl"
      class="relative flex gap-2 overflow-x-auto overscroll-x-contain p-0.5 [@media(pointer:coarse)]:[scrollbar-width:none] [@media(pointer:fine)]:[scrollbar-width:thin]"
      @wheel="onWheel"
    >
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        class="touch-target flex shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap"
        :class="[chipStyle(section), activeId === section.id ? ACTIVE_CHIP_STYLE : '']"
        :data-section-chip="section.id"
        :data-chip-kind="section.kind ?? 'default'"
        :aria-current="activeId === section.id ? 'true' : undefined"
        @click="goToSection(section)"
      >
        {{ section.title }}
      </button>
    </div>
  </nav>
</template>
