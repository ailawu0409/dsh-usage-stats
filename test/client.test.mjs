import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * Load the browser module the way the Web module loader does, then drive its
 * apply() against a fake Client context: this checks the registration wiring and
 * validates the Remote descriptor without a browser.
 */
let loaded
globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      loaded = entry
    },
  },
}
await import('../client.js')
assert.equal(loaded.id, 'dsh-usage-stats', 'client module id matches the package name')

const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: children.flat() } }),
  useState: (value) => [value, () => {}],
  useRef: (value) => ({ current: value }),
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useEffect: () => {},
  useLayoutEffect: () => {},
  Component: class Component {
    constructor(props) {
      this.props = props
      this.state = {}
    }
    setState(next) {
      this.state = { ...this.state, ...(typeof next === 'function' ? next(this.state) : next) }
    }
  },
}

const plugin = loaded.factory((specifier) => {
  if (specifier === 'react') return ReactStub
  throw new Error(`unexpected require(${JSON.stringify(specifier)})`)
})

const helpers = plugin.__test

assert.deepEqual(plugin.inject, ['slots', 'locale', 'remote', 'typert'])
assert.equal(helpers.SECTION_ORDER, 101, 'the section sits right after 归档管理 (order 100)')
assert.deepEqual(helpers.RANGE_CHOICES, [7, 30])

// --- number and time formatting --------------------------------------------

assert.deepEqual(helpers.formatTokenParts(250_000_000, true), { value: '2.5', unit: '亿' })
assert.deepEqual(helpers.formatTokenParts(302_335_080, true), { value: '3', unit: '亿' })
assert.deepEqual(helpers.formatTokenParts(96_564_000, true), { value: '9656.4', unit: '万' })
assert.deepEqual(helpers.formatTokenParts(9_999, true), { value: '9999', unit: '' })
assert.deepEqual(helpers.formatTokenParts(0, true), { value: '0', unit: '' })
assert.deepEqual(helpers.formatTokenParts(302_335_080, false), { value: '302.3', unit: 'M' })
assert.deepEqual(helpers.formatTokenParts(1_500_000_000, false), { value: '1.5', unit: 'B' })
assert.equal(helpers.formatTokens(96_564_000, true), '9656.4 万')
assert.equal(helpers.trimDecimal(3.0), '3')
assert.equal(helpers.trimDecimal(2.54), '2.5')

assert.equal(helpers.formatShare(0.42), '42')
assert.equal(helpers.formatShare(0.094), '9.4')
assert.equal(helpers.formatShare(0.003), '0.1')
assert.equal(helpers.formatShare(0), '0')

const DICT = {
  'unit.hourSuffix': '小时',
  'unit.minuteSuffix': '分钟',
  'unit.secondSuffix': '秒',
  'unit.zero': '—',
}
const t = (key, params) => {
  const template = DICT[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name]))
}
// Duration renders as number/unit parts so every metric shares one typographic
// pattern (big number, small unit) instead of mixing sizes in one string.
assert.deepEqual(helpers.formatDurationParts(7_500_000, t), [
  { value: '2', unit: '小时' },
  { value: '5', unit: '分钟' },
])
assert.deepEqual(helpers.formatDurationParts(7_200_000, t), [{ value: '2', unit: '小时' }], 'a whole hour has no minute part')
assert.deepEqual(helpers.formatDurationParts(90_000, t), [{ value: '1', unit: '分钟' }])
assert.deepEqual(helpers.formatDurationParts(30_000, t), [{ value: '30', unit: '秒' }])
assert.deepEqual(helpers.formatDurationParts(0, t), [{ value: '—', unit: '' }])
assert.deepEqual(helpers.formatDurationParts(Number.NaN, t), [{ value: '—', unit: '' }])
// 2h13m — the exact shape from the reported screenshot.
assert.deepEqual(helpers.formatDurationParts(7_980_000, t), [
  { value: '2', unit: '小时' },
  { value: '13', unit: '分钟' },
])

assert.equal(helpers.formatDayLabel('2026-10-27', true), '10月27日')
assert.equal(helpers.formatDayLabel('2026-10-27', false), 'Oct 27')
assert.equal(helpers.shiftDayKey('2026-11-01', -1), '2026-10-31')
assert.equal(helpers.shiftDayKey('2026-12-31', 1), '2027-01-01')
assert.equal(helpers.dayKeyOf(new Date(2026, 10, 3)), '2026-11-03')

// --- heatmap ---------------------------------------------------------------

{
  const daily = [
    { day: '2026-11-01', tokens: 100, models: { m1: 100 } },
    { day: '2026-11-02', tokens: 50, models: { m1: 50 } },
  ]
  const map = helpers.buildHeatmap(daily, '2026-11-03', 'daily')
  assert.equal(map.columns.length, 53, '53 week columns')
  assert.equal(
    map.columns.every((column) => column.length === 7),
    true,
    'seven cells per column',
  )
  const cells = map.columns.flatMap((column) => column)
  const active = cells.find((cell) => cell.day === '2026-11-01')
  assert.equal(active.tokens, 100)
  assert.equal(active.level, 4, 'the busiest day is the darkest level')
  assert.equal(cells.find((cell) => cell.day === '2026-11-02').level, 2)
  assert.equal(
    cells.filter((cell) => cell.future).every((cell) => cell.level === 0),
    true,
    'future days stay blank',
  )
  assert.ok(map.months.length > 0, 'month labels are produced')
  assert.ok(map.months.every((entry) => entry.column >= 0 && entry.column < 53))

  const weekly = helpers.buildHeatmap(daily, '2026-11-03', 'weekly')
  const weekColumn = weekly.columns.find((column) => column.some((cell) => cell.day === '2026-11-01'))
  assert.equal(
    new Set(weekColumn.filter((cell) => !cell.future).map((cell) => cell.value)).size,
    1,
    'every cell of a week carries the week total',
  )

  const cumulative = helpers.buildHeatmap(daily, '2026-11-03', 'cumulative')
  const ordered = cumulative.columns.flatMap((column) => column).filter((cell) => !cell.future)
  assert.equal(ordered[ordered.length - 1].value, 150, 'cumulative ends at the window total')
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(ordered[index].value >= ordered[index - 1].value, 'cumulative never decreases')
  }

  const empty = helpers.buildHeatmap([], '2026-11-03', 'daily')
  assert.equal(empty.max, 0)
  assert.equal(
    empty.columns.flatMap((column) => column).every((cell) => cell.level === 0),
    true,
  )
}

// --- trend -----------------------------------------------------------------

{
  const stats = {
    today: '2026-11-03',
    daily: [
      { day: '2026-11-02', tokens: 10, models: { m1: 10 } },
      { day: '2026-11-03', tokens: 20, models: { m2: 20 } },
    ],
    models: [
      { model: 'm2', tokens: 20 },
      { model: 'm1', tokens: 10 },
    ],
  }
  const trend = helpers.buildTrend(stats, 8)
  assert.equal(trend.days.length, 8, 'the window includes today')
  assert.equal(trend.days[0], '2026-10-27')
  assert.equal(trend.days[7], '2026-11-03')
  assert.equal(trend.series.length, 2)
  assert.equal(trend.series[0].model, 'm2', 'series are ranked by range tokens')
  assert.equal(trend.series[0].colorIndex, 0, 'colours follow the all-time model order')
  assert.equal(trend.series[0].points[7].tokens, 20)
  assert.equal(trend.series[1].points[7].tokens, 0, 'missing days are zero, not absent')
  assert.equal(trend.max, 20)

  const flat = helpers.buildTrend({ today: '2026-11-03', daily: [], models: [] }, 30)
  assert.equal(flat.days.length, 30)
  assert.equal(flat.series.length, 0)
  assert.equal(flat.max, 0)
}

// --- donut -----------------------------------------------------------------

{
  const models = Array.from({ length: 7 }, (_, index) => ({ model: `m${index}`, tokens: 100 - index }))
  const donut = helpers.donutSegments(models, 5)
  assert.equal(donut.segments.length, 6, 'five named models plus one remainder')
  assert.equal(donut.segments[5].other, true)
  assert.equal(donut.segments[5].model, null)
  const sum = donut.segments.reduce((total, segment) => total + segment.share, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9, 'shares add up to one')
  assert.equal(donut.total, models.reduce((total, entry) => total + entry.tokens, 0))

  assert.deepEqual(helpers.donutSegments([], 5), { segments: [], total: 0 })
  assert.deepEqual(helpers.donutSegments([{ model: 'm', tokens: 0 }], 5), { segments: [], total: 0 })
}

// --- path building ---------------------------------------------------------

{
  const points = [
    { x: 0, y: 100 },
    { x: 10, y: 20 },
    { x: 20, y: 60 },
    { x: 30, y: 0 },
  ]
  const path = helpers.smoothPath(points, 0, 100)
  assert.ok(path.startsWith('M0 100'))
  assert.equal(path.includes('NaN'), false)
  assert.equal((path.match(/C/g) ?? []).length, 3, 'one cubic segment per gap')
  assert.equal(helpers.smoothPath([], 0, 100), '')
  assert.equal(helpers.smoothPath([{ x: 5, y: 5 }], 0, 100), 'M5 5')
  assert.equal(helpers.smoothPath([{ x: Number.NaN, y: Number.NaN }], 0, 100), 'M0 0')
  assert.equal(helpers.paletteColor(0, 'light'), '#4D6BFE')
  assert.equal(helpers.paletteColor(0, 'dark'), '#6D8BFF')
  assert.equal(helpers.paletteColor(99, 'light'), '#9AA0AA', 'unknown indexes fall back to neutral')
}

// --- hover helpers ---------------------------------------------------------

assert.equal(helpers.formatLongDayLabel('2026-10-27', true), '2026年10月27日')
assert.equal(helpers.formatLongDayLabel('2026-10-27', false), 'Oct 27, 2026')

assert.equal(helpers.nearestIndex(0, 100, 8), 0)
assert.equal(helpers.nearestIndex(100, 100, 8), 7, 'the right edge selects the last point')
assert.equal(helpers.nearestIndex(50, 100, 8), 4)
assert.equal(helpers.nearestIndex(-20, 100, 8), 0, 'a left overshoot clamps')
assert.equal(helpers.nearestIndex(400, 100, 8), 7, 'a right overshoot clamps')
assert.equal(helpers.nearestIndex(50, 100, 1), 0)
assert.equal(helpers.nearestIndex(50, 0, 8), 0, 'a zero width degrades to the first point')
assert.equal(helpers.nearestIndex(50, 100, 0), -1, 'no points yields -1')

assert.equal(helpers.clampTipX(10, 800, 260), 138, 'the tooltip stays off the left edge')
assert.equal(helpers.clampTipX(790, 800, 260), 662, 'the tooltip stays off the right edge')
assert.equal(helpers.clampTipX(400, 800, 260), 400, 'an interior tooltip is untouched')
assert.equal(helpers.clampTipX(40, 200, 260), 100, 'a narrow container centers the tooltip')

{
  const byDay = helpers.dailyByDay({ daily: [{ day: '2026-11-02', tokens: 5, turns: 2, models: {} }] })
  assert.equal(byDay.get('2026-11-02').turns, 2)
  assert.equal(byDay.get('2026-11-03'), undefined)
  assert.equal(helpers.dailyByDay({}).size, 0)
  assert.equal(helpers.dailyByDay({ daily: [null, 'junk', { day: '2026-11-02' }] }).size, 1)
}

// Heatmap hover: cells expose a hover handler and no native `title` tooltip.
{
  const stats = {
    today: '2026-11-03',
    daily: [
      { day: '2026-11-02', tokens: 100, turns: 3, models: { 'group/m1': 100 } },
      { day: '2026-11-03', tokens: 50, turns: 1, models: { 'group/m1': 50 } },
    ],
    models: [{ model: 'group/m1', tokens: 150 }],
  }
  const t = (key, parameters) => {
    if (parameters === undefined) return key
    return `${key}(${Object.values(parameters).join(',')})`
  }
  const card = helpers.TokenActivityCard({ stats, chinese: true, t })
  const body = card.props.children[1]
  const heatWrap = body.props.children[0]
  const heat = heatWrap.props.children[0]
  const grid = heat.props.children[0]
  const columns = grid.props.children
  // The stub never measures, so the grid starts at the minimum week count.
  assert.equal(columns.length, helpers.HEATMAP_MIN_WEEKS)
  const cells = columns.flatMap((column) => column.props.children)
  assert.equal(cells.length, helpers.HEATMAP_MIN_WEEKS * 7)
  const past = cells.find((cell) => cell.props.key === '2026-11-02')
  assert.ok(past !== undefined, 'the active day has a cell')
  assert.equal(past.props.title, undefined, 'no native title tooltip remains')
  assert.equal(typeof past.props.onMouseEnter, 'function', 'hover is wired')
  assert.equal(past.props['aria-hidden'], 'true')
  const future = cells.filter((cell) => cell.props['data-future'] === 'true')
  assert.ok(future.length > 0)
  assert.equal(future.every((cell) => cell.props.onMouseEnter === undefined), true, 'future days are inert')

  // Responsive sizing: the grid must size itself to the panel, never clip.
  assert.ok(heatWrap.props.style['--us-cell'] !== undefined, 'the cell size is driven by a CSS variable')
  assert.ok(heatWrap.props.style['--us-gap'] !== undefined)
  const monthsRow = heat.props.children[1]
  const monthLabels = monthsRow.props.children
  assert.ok(monthLabels.length > 0, 'month labels are rendered')
  const lastLabel = monthLabels[monthLabels.length - 1]
  assert.equal(lastLabel.props.key, `month-${helpers.HEATMAP_MIN_WEEKS - 1}`, 'the current month is labelled on the final column')
  assert.equal(lastLabel.props.children[0], '11月', 'the rightmost label is the current month, not a stale one')
  // The final label is right-anchored so it cannot collide with the legend.
  assert.deepEqual(lastLabel.props.style, { right: '0px' })
  assert.ok(monthLabels[0].props.style.left !== undefined, 'other labels are column-anchored')
}

// Heatmap sizing: the reference cell size is fixed and the week count adapts, so
// cells never shrink into an unreadable grid.
{
  assert.equal(helpers.HEATMAP_CELL, 11, 'cells keep the reference size')
  assert.equal(helpers.HEATMAP_GAP, 3)

  // A panel wide enough for the whole year shows the whole year.
  assert.equal(helpers.heatmapWeeks(53 * 11 + 52 * 3, 11, 3), 53)
  assert.equal(helpers.heatmapWeeks(2000, 11, 3), 53, 'never more than a year')
  // A narrower panel drops weeks instead of shrinking cells.
  const narrow = helpers.heatmapWeeks(500, 11, 3)
  assert.ok(narrow < 53 && narrow >= helpers.HEATMAP_MIN_WEEKS, `500px shows ${narrow} weeks`)
  // An unmeasured panel starts at the minimum so the first paint cannot overflow.
  assert.equal(helpers.heatmapWeeks(0, 11, 3), helpers.HEATMAP_MIN_WEEKS)
  assert.equal(helpers.heatmapWeeks(Number.NaN, 11, 3), helpers.HEATMAP_MIN_WEEKS)
  assert.equal(helpers.heatmapWeeks(120, 11, 3), helpers.HEATMAP_MIN_WEEKS, 'the floor keeps some history')
  // Whatever the panel width, the drawn grid fits and the cells stay 11px.
  for (const available of [320, 420, 500, 560, 640, 760, 820]) {
    const weeks = helpers.heatmapWeeks(available, 11, 3)
    const drawn = weeks * 11 + (weeks - 1) * 3
    if (available >= helpers.HEATMAP_MIN_WEEKS * 11 + (helpers.HEATMAP_MIN_WEEKS - 1) * 3) {
      assert.ok(drawn <= available, `the grid fits in ${available}px (${weeks} weeks, ${drawn}px)`)
    }
  }
}

// Month labels must not overlap at any stride, and the current month must always
// be the last label (the clipped grid used to end at 7月).
{
  for (const stride of [14, 10, 8, 7]) {
    const map = helpers.buildHeatmap([{ day: '2026-11-03', tokens: 10 }], '2026-11-03', 'daily', stride)
    const columns = map.months.map((entry) => entry.column)
    for (let index = 1; index < columns.length; index += 1) {
      assert.ok(
        columns[index] - columns[index - 1] >= Math.max(2, Math.ceil(26 / stride)),
        `labels are spaced at stride ${stride}`,
      )
    }
    const last = map.months[map.months.length - 1]
    assert.equal(last.month, 10, `the final label is November at stride ${stride}`)
    assert.equal(last.column, 52, 'the final label sits on the current week')
  }
}

// A shortened grid still ends on the current week and labels the current month.
{
  const map = helpers.buildHeatmap([{ day: '2026-11-03', tokens: 10 }], '2026-11-03', 'daily', 14, 26)
  assert.equal(map.columns.length, 26, 'the week count is honoured')
  assert.equal(map.columns[25][0].day, '2026-11-02', 'the last column is the current week')
  const last = map.months[map.months.length - 1]
  assert.equal(last.month, 10)
  assert.equal(last.column, 25)
  // A single week is the degenerate case and must not throw.
  const one = helpers.buildHeatmap([], '2026-11-03', 'daily', 14, 1)
  assert.equal(one.columns.length, 1)
  assert.equal(one.months.length, 1)
}

// The whole page must build every card without throwing. A wrong prop shape here
// is what blanked the section with the boundary fallback before.
{
  const stats = {
    today: '2026-11-03',
    totals: {
      tokens: 150,
      peakDay: '2026-11-02',
      peakTokens: 100,
      longestChatMs: 7_320_000,
      currentStreakDays: 2,
      longestStreakDays: 2,
      activeDays: 2,
      firstDay: '2026-11-02',
      lastDay: '2026-11-03',
    },
    daily: [
      { day: '2026-11-02', tokens: 100, turns: 3, models: { 'group/m1': 100 } },
      { day: '2026-11-03', tokens: 50, turns: 1, models: { 'group/m1': 30, 'group/m2': 20 } },
    ],
    models: [
      { model: 'group/m1', tokens: 130 },
      { model: 'group/m2', tokens: 20 },
    ],
    sessions: { total: 2, counted: 2, skipped: 0 },
  }
  const t = (key, parameters) => (parameters === undefined ? key : `${key}(${Object.values(parameters).join(',')})`)
  const page = helpers.UsageStatsView({
    useStats: (selector) => selector({ status: 'ready', stats, error: null, busy: false }),
    useColorScheme: (selector) => selector({ scheme: 'dark' }),
    useLocale: (selector) => selector({ id: 'zh' }),
    actions: { refresh: async () => {} },
    t,
  })
  const serialized = JSON.stringify(page, (key, value) => (typeof value === 'function' ? '[fn]' : value))
  assert.ok(serialized.includes('us-root'))
  // The page composes the activity, trend and model cards as child elements.
  const childTypes = page.props.children
    .filter((child) => child !== null && typeof child === 'object' && child.type !== undefined)
    .map((child) => child.type)
  assert.ok(
    childTypes.filter((type) => typeof type === 'function').length >= 3,
    'activity, trend and model cards are all wired into the page',
  )

  // Exactly three headline metrics, and no streak columns.
  const statRow = page.props.children.find((child) => child !== null && typeof child === 'object' && child.props?.items !== undefined)
  assert.ok(statRow !== undefined, 'the stat row is rendered')
  assert.deepEqual(
    statRow.props.items.map((item) => item.key),
    ['total', 'peak', 'longestChat'],
    'only the three headline metrics remain',
  )
  assert.equal(statRow.props.items.every((item) => Array.isArray(item.parts) && item.parts.length > 0), true)
  assert.equal(serialized.includes('stats.currentStreak'), false, 'the streak metrics are gone')
  assert.equal(serialized.includes('stats.longestStreak'), false)
  // The duration is split into number/unit parts (this block's `t` is a pass-through
  // stub, so units come back as their locale keys — the text itself is covered by
  // the formatDurationParts cases above).
  const durationItem = statRow.props.items[2]
  assert.deepEqual(
    durationItem.parts.map((part) => [part.value, part.unit]),
    [
      ['2', 'unit.hourSuffix'],
      ['2', 'unit.minuteSuffix'],
    ],
  )

  // The header is just the title: no glyph, no usage-scope pill. The stub never
  // renders components, so invoke PageHeader directly to inspect its output.
  const headerElement = page.props.children.find(
    (child) => child !== null && typeof child === 'object' && typeof child.type === 'function' && child.type.name === 'PageHeader',
  )
  assert.ok(headerElement !== undefined, 'the header is wired into the page')
  assert.equal(headerElement.props.scope, undefined, 'no scope pill copy is passed')
  assert.equal(headerElement.props.scopeHint, undefined, 'no scope hint is passed')
  const header = headerElement.type(headerElement.props)
  assert.equal(header.type, 'h2')
  assert.equal(header.props.className, 'us-title')
  assert.deepEqual(header.props.children, ['page.title'])
  assert.equal(serialized.includes('us-scope'), false, 'the scope pill is gone')

  // Execute the two chart cards directly: their render paths are the newest code.
  const trendCard = helpers.TrendCard({ stats, windowDays: 8, chinese: true, t, scheme: 'dark' })
  const trendTree = JSON.stringify(trendCard, (key, value) => (typeof value === 'function' ? '[fn]' : value))
  assert.ok(trendTree.includes('us-chart'))
  assert.ok(trendTree.includes('us-legend'))
  assert.equal(trendTree.includes('us-cursorLine'), false, 'no crosshair before hover')
  // The tooltip must live inside its positioning container, or it renders at the
  // wrong offset (the container is the absolute-positioning reference).
  const chart = trendCard.props.children[2]
  assert.equal(chart.props.className, 'us-chart')
  const tooltipChild = chart.props.children.find((child) => child !== null && typeof child.type === 'function')
  assert.ok(tooltipChild !== undefined, 'the hover card is nested in the chart container')

  const modelCard = helpers.ModelUsageCard({ stats, chinese: false, t, scheme: 'light' })
  const modelTree = JSON.stringify(modelCard, (key, value) => (typeof value === 'function' ? '[fn]' : value))
  assert.ok(modelTree.includes('us-donut'))
  assert.ok(modelTree.includes('us-modelList'))
  assert.equal(modelTree.includes('us-tip'), false, 'no tooltip before hover')

  // Same page with a day that has no data must not throw either.
  const sparse = helpers.UsageStatsView({
    useStats: (selector) =>
      selector({
        status: 'ready',
        stats: { today: '2026-11-03', daily: [], models: [], totals: { tokens: 0, peakTokens: 0, longestChatMs: 0, currentStreakDays: 0, longestStreakDays: 0 }, sessions: { total: 0, counted: 0, skipped: 0 } },
        error: null,
        busy: false,
      }),
    useColorScheme: (selector) => selector({ scheme: 'light' }),
    useLocale: (selector) => selector({ id: 'en' }),
    actions: { refresh: async () => {} },
    t,
  })
  assert.ok(JSON.stringify(sparse, (key, value) => (typeof value === 'function' ? '[fn]' : value)).includes('us-root'))
}

// The heatmap summary must count only the window the grid draws, not the whole
// 400-day payload the Host sends.
{
  const t = (key, parameters) => (parameters === undefined ? key : `${key}(${Object.values(parameters).join(',')})`)
  const stats = {
    today: '2026-11-03',
    totals: { tokens: 1000, peakDay: '2026-11-03', peakTokens: 1000, longestChatMs: 0 },
    daily: [
      // Far outside a 13-week grid (unmeasured width starts at the minimum).
      { day: '2025-12-01', tokens: 900, turns: 1, models: { m: 900 } },
      { day: '2026-11-03', tokens: 100, turns: 2, models: { m: 100 } },
    ],
    models: [{ model: 'm', tokens: 1000 }],
    sessions: { total: 2, counted: 2, skipped: 0 },
  }
  const card = helpers.TokenActivityCard({ stats, chinese: true, t })
  const summaryNode = card.props.children[1].props.children[card.props.children[1].props.children.length - 1]
  const summary = summaryNode.props.children[0]
  assert.ok(summary.includes('activity.summary'), 'the summary is rendered')
  // 1 active day and 100 tokens, not 2 days and 1000 tokens.
  assert.ok(summary.includes('"days":1') || summary.includes(',1,'), `only in-window days count: ${summary}`)
  assert.ok(summary.includes('100') && !summary.includes('1000'), `only in-window tokens count: ${summary}`)
}

// A failed refresh keeps the numbers and shows a banner; only a first load without
// data falls back to the full-page error state.
{
  const t = (key, parameters) => (parameters === undefined ? key : `${key}(${Object.values(parameters).join(',')})`)
  const stats = {
    today: '2026-11-03',
    totals: { tokens: 10, peakTokens: 10, longestChatMs: 0 },
    daily: [{ day: '2026-11-03', tokens: 10, turns: 1, models: { m: 10 } }],
    models: [{ model: 'm', tokens: 10 }],
    sessions: { total: 1, counted: 1, skipped: 0 },
  }
  const withData = helpers.UsageStatsView({
    useStats: (selector) => selector({ status: 'error', stats, error: 'boom', busy: false }),
    useColorScheme: (selector) => selector({ scheme: 'light' }),
    useLocale: (selector) => selector({ id: 'zh' }),
    actions: { refresh: async () => {} },
    t,
  })
  const tree = JSON.stringify(withData, (key, value) => (typeof value === 'function' ? '[fn]' : value))
  assert.ok(tree.includes('us-alert'), 'a failed refresh shows an inline banner')
  assert.ok(tree.includes('error.refreshFailed'), 'the banner names the failure')
  assert.ok(
    withData.props.children.some((child) => child !== null && typeof child === 'object' && child.props?.items !== undefined),
    'the numbers stay on screen',
  )

  const withoutData = helpers.UsageStatsView({
    useStats: (selector) => selector({ status: 'error', stats: null, error: 'boom', busy: false }),
    useColorScheme: (selector) => selector({ scheme: 'light' }),
    useLocale: (selector) => selector({ id: 'zh' }),
    actions: { refresh: async () => {} },
    t,
  })
  const emptyTree = JSON.stringify(withoutData, (key, value) => (typeof value === 'function' ? '[fn]' : value))
  assert.ok(emptyTree.includes('us-state'), 'a first-load failure keeps the full error state')
  assert.equal(
    withoutData.props.children.some((child) => child !== null && typeof child === 'object' && child.props?.className === 'us-alert'),
    false,
    'no banner element when there is nothing to keep',
  )
}

// The window period is a full phrase, so Chinese reads "近 8 个月" with a space.
{
  const dict = { 'period.year': '近一年', 'period.months': '近 {count} 个月' }
  const t = (key, parameters) => {
    const template = dict[key] ?? key
    return parameters === undefined ? template : template.replace(/\{(\w+)\}/g, (_, name) => String(parameters[name]))
  }
  assert.equal(t('period.months', { count: 8 }), '近 8 个月')
  assert.equal(t('period.year'), '近一年')
}

// A truncated corpus is reported in the footer note.
{
  const t = (key, parameters) => (parameters === undefined ? key : `${key}(${Object.values(parameters).join(',')})`)
  const stats = {
    today: '2026-11-03',
    totals: { tokens: 10, peakTokens: 10, longestChatMs: 0 },
    daily: [{ day: '2026-11-03', tokens: 10, turns: 1, models: { m: 10 } }],
    models: [{ model: 'm', tokens: 10 }],
    sessions: { total: 20001, counted: 20000, skipped: 0, truncated: true },
  }
  const page = helpers.UsageStatsView({
    useStats: (selector) => selector({ status: 'ready', stats, error: null, busy: false }),
    useColorScheme: (selector) => selector({ scheme: 'light' }),
    useLocale: (selector) => selector({ id: 'zh' }),
    actions: { refresh: async () => {} },
    t,
  })
  assert.ok(JSON.stringify(page, (k, v) => (typeof v === 'function' ? '[fn]' : v)).includes('truncated'), 'the cap is disclosed')
}



// The stat value must be one inline line box: a nested flex container lets the
// smaller unit align to the box edge instead of the text baseline, which made the
// units look like they sat on a different line.
{
  const css = helpers.CSS
  assert.ok(css.includes('.us-statValue{display:block'), 'the value row is inline text, not a flex box')
  assert.equal(css.includes('.us-statValue{display:flex'), false)
  assert.ok(css.includes('.us-statPart{display:inline}'))
  assert.equal(css.includes('.us-statPart{display:inline-flex'), false)
  // Only the official brand weights are available (Montserrat 300/400/500).
  assert.equal(/font-weight:\s*600/.test(css), false, 'no synthetic-bold weight anywhere')
  // The page inherits the harness text font instead of hard-coding a family.
  assert.ok(css.includes('font-family:var(--dsh-font-family-text,inherit)'))
  // The header is a single title at the host settings title scale; the header
  // glyph and the "应用用量" pill are gone.
  assert.ok(css.includes('.us-title{margin:0;font-size:16px;line-height:24px;font-weight:500'), 'the title uses the host settings title scale')
  assert.equal(css.includes('.us-scope'), false, 'the scope pill is gone')
  assert.equal(css.includes('.us-header'), false, 'the title itself is the header')
  assert.ok(css.includes('.us-navIcon{'), 'the injected nav glyph has its own rule')
}

// The settings shell hard-codes nav glyphs by section id, so the client decorates
// its own entry: the host gear is hidden (never removed) and the chart takes its
// slot; unmatched host markup is left untouched.
{
  const iconAsset = readFileSync(new URL('../icon.svg', import.meta.url), 'utf8')
  const assetPaths = [...iconAsset.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(assetPaths, [...helpers.CHART_PATHS], 'the nav glyph mirrors icon.svg')

  const created = []
  const owner = {
    createElementNS(namespace, tag) {
      const node = {
        tag,
        attrs: {},
        children: [],
        style: {},
        setAttribute(name, value) {
          this.attrs[name] = String(value)
        },
        appendChild(child) {
          this.children.push(child)
          return child
        },
      }
      created.push(node)
      return node
    },
  }
  const nativeIcon = { style: {} }
  const button = {
    dataset: {},
    ownerDocument: owner,
    textContent: ' 使用统计 ',
    inserted: [],
    querySelector(selector) {
      if (selector === '.us-navIcon') return this.inserted.length > 0 ? this.inserted[0].node : null
      if (selector === ':scope > svg:not(.us-navIcon)') return nativeIcon
      return null
    },
    insertBefore(node, reference) {
      this.inserted.push({ node, reference })
    },
  }
  const root = { querySelectorAll: (selector) => (selector === 'nav button' ? [button] : []) }
  helpers.syncSectionNavIcon(root, '使用统计')
  assert.equal(nativeIcon.style.display, 'none', 'the host gear is hidden, not removed')
  assert.equal(button.inserted.length, 1)
  assert.equal(button.inserted[0].reference, nativeIcon, 'the chart takes the gear slot')
  const icon = button.inserted[0].node
  assert.equal(icon.attrs.class, 'us-navIcon')
  assert.equal(icon.attrs.width, '16')
  assert.equal(icon.attrs.height, '16')
  assert.equal(icon.attrs.viewBox, '0 0 24 24')
  assert.equal(icon.attrs['aria-hidden'], 'true')
  assert.equal(icon.children.length, helpers.CHART_PATHS.length)
  assert.deepEqual(icon.children.map((path) => path.attrs.d), [...helpers.CHART_PATHS])
  assert.equal(button.dataset.usNavIcon, 'true')

  helpers.syncSectionNavIcon(root, '使用统计')
  assert.equal(button.inserted.length, 1, 'repeat syncs are idempotent')

  let skipped = 0
  const otherButton = {
    dataset: {},
    ownerDocument: owner,
    textContent: '通用设置',
    querySelector(selector) {
      return selector === ':scope > svg:not(.us-navIcon)' ? nativeIcon : null
    },
    insertBefore() {
      skipped += 1
    },
  }
  helpers.syncSectionNavIcon({ querySelectorAll: () => [otherButton] }, '使用统计')
  assert.equal(skipped, 0, 'other sections keep their own glyph')

  const noGlyphButton = {
    dataset: {},
    ownerDocument: owner,
    textContent: '使用统计',
    querySelector: () => null,
    insertBefore() {
      skipped += 1
    },
  }
  helpers.syncSectionNavIcon({ querySelectorAll: () => [noGlyphButton] }, '使用统计')
  assert.equal(skipped, 0, 'unfamiliar host markup leaves the nav untouched')

  const dispose = helpers.installSettingsNavIcon(() => 'usage-stats:nav')
  assert.equal(typeof dispose, 'function')
  dispose()
}

// The model row hover highlight is an inset rounded card, not a full-bleed
// rectangle, and its separator must not cut through the rounded corners.
{
  const css = helpers.CSS
  const row = css.split('\n').find((line) => line.startsWith('.us-modelRow{'))
  assert.ok(row !== undefined, 'the model row rule exists')
  assert.ok(row.includes('border-radius:'), 'the row itself carries the radius')
  assert.ok(row.includes('padding:9px 10px'), 'the row has horizontal padding for the inset')
  assert.ok(row.includes('margin:0 -10px'), 'the negative margin keeps the text column aligned')
  assert.equal(/\.us-modelRow\+\.us-modelRow\{border-top:\.5px/.test(css), false, 'the separator is no longer a row border')
  assert.ok(css.includes('.us-modelRow+.us-modelRow::before'), 'the separator is an inset pseudo-element')
  assert.ok(
    css.includes('.us-modelRowActive::before,.us-modelRowActive+.us-modelRow::before{opacity:0}'),
    'separators touching the highlight are hidden',
  )
  assert.ok(css.includes('.us-modelRowActive{background:var(--dsw-alias-interactive-bg-hover'), 'the highlight keeps the host hover token')
}

// Both dictionaries must stay in sync and free of keys nothing consumes — the
// streak removal left orphan entries behind once already.
{
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  const zhStart = source.indexOf('const zh = {')
  const enStart = source.indexOf('const en = {')
  const codeStart = source.indexOf('const CSS = `')
  const keysOf = (block) =>
    [...block.matchAll(/^\s{6}(?:'([^']+)'|([A-Za-z]+)):\s/gm)].map((match) => match[1] ?? match[2])
  const zhKeys = keysOf(source.slice(zhStart, enStart))
  const enKeys = keysOf(source.slice(enStart, codeStart))
  assert.deepEqual([...zhKeys].sort(), [...enKeys].sort(), 'zh and en declare the same keys')

  const code = source.slice(codeStart)
  const dynamicFamilies = ['activity.', 'range.']
  const dead = zhKeys.filter((key) => {
    if (code.includes(`'${key}'`)) return false
    // A family consumed through a template literal, e.g. t(`range.${value}`).
    return !dynamicFamilies.some((family) => key.startsWith(family) && code.includes(`t(\`${family}\${`))
  })
  assert.deepEqual(dead, [], 'no locale key is left unused')
  // The streak metrics were removed; their unit keys must not come back.
  assert.equal(zhKeys.includes('unit.day'), false)
  assert.equal(zhKeys.includes('unit.daySuffix'), false)
  // The usage-scope pill was removed with its copy.
  assert.equal(zhKeys.includes('page.scope'), false)
  assert.equal(zhKeys.includes('page.scopeHint'), false)
}

const events = []
const localeRegistrations = []
const mountCalls = []
const slotInjections = []
const registrations = []
const requests = []
const cleanups = []
const FAKE_STATS = {
  generatedAt: 1,
  today: '2026-11-03',
  sessions: { total: 2, counted: 2, skipped: 0 },
  totals: {
    tokens: 100,
    peakDay: '2026-11-03',
    peakTokens: 100,
    longestChatMs: 60_000,
    currentStreakDays: 1,
    longestStreakDays: 1,
    activeDays: 1,
    firstDay: '2026-11-03',
    lastDay: '2026-11-03',
  },
  daily: [{ day: '2026-11-03', tokens: 100, models: { 'group/m1': 100 } }],
  models: [{ model: 'group/m1', tokens: 100 }],
}

const locale = {
  register(namespace, dictionaries) {
    localeRegistrations.push({ namespace, dictionaries })
    return () => {}
  },
  bind(namespace) {
    return (key, parameters) => {
      if (parameters === undefined) return `${namespace}:${key}`
      return `${namespace}:${key}:${JSON.stringify(parameters)}`
    }
  },
  getSnapshot() {
    return { id: 'zh', revision: 0 }
  },
  subscribe() {
    return () => {}
  },
}

const ctx = {
  locale,
  on(name, listener) {
    events.push({ name, listener })
    return () => {}
  },
  get(name) {
    if (name === 'theme') {
      return { getTheme: () => ({ active: { colorScheme: 'dark' } }) }
    }
    if (name === 'remote.usageStats') {
      return {
        async command(request) {
          requests.push(request)
          return { ok: true, value: { stats: FAKE_STATS } }
        },
      }
    }
    return undefined
  },
  effect(callback) {
    const cleanup = callback()
    if (typeof cleanup === 'function') cleanups.push(cleanup)
    return () => {}
  },
  remote: {
    async $mount(spec) {
      mountCalls.push(spec)
    },
  },
  slots: {
    inject(key, callback) {
      slotInjections.push(key)
      const disposer = callback()
      return () => {
        if (typeof disposer === 'function') disposer()
      }
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
}

plugin.apply(ctx)
await new Promise((resolve) => setTimeout(resolve, 0))

assert.equal(localeRegistrations.length, 1)
assert.equal(localeRegistrations[0].namespace, 'usage-stats')
assert.ok(localeRegistrations[0].dictionaries.zh.nav, 'Chinese dictionary is registered')
assert.ok(localeRegistrations[0].dictionaries.en.nav, 'English dictionary is registered')
assert.equal(localeRegistrations[0].dictionaries.zh['page.title'], '使用统计')
assert.equal(localeRegistrations[0].dictionaries.zh['page.scope'], undefined, 'the scope pill copy is gone')
assert.equal(localeRegistrations[0].dictionaries.en['page.scope'], undefined)
assert.equal(localeRegistrations[0].dictionaries.zh['page.scopeHint'], undefined)

assert.equal(events.length, 1)
assert.equal(events[0].name, 'theme/change')

assert.equal(mountCalls.length, 1)
assert.equal(mountCalls[0].package, 'dsh-usage-stats')
assert.equal(mountCalls[0].descriptors.length, 1)
const descriptor = mountCalls[0].descriptors[0]
assert.equal(descriptor.id, 'dsh-usage-stats#usageStats/command')
assert.equal(descriptor.namespace, 'usageStats')
assert.equal(descriptor.method, 'command')
assert.equal(descriptor.parameters.length, 1)
assert.equal(descriptor.parameters[0].codec.mode, 'strict')

assert.deepEqual(requests, [{ action: 'getStats' }], 'the page loads once after mounting')

assert.deepEqual(slotInjections, ['settings.section'])
assert.equal(registrations.length, 1)
const section = registrations[0].options
assert.equal(section.name, 'settings.section')
assert.equal(section.id, 'usage-stats')
assert.equal(section.order, 101)
assert.equal(section.locale, 'usage-stats')
assert.equal(typeof section.label, 'function')
assert.equal(section.label(), 'usage-stats:nav')
const injected = section.inject()
assert.equal(typeof injected.actions.refresh, 'function')
// The slot turns `hooks` into `use<Name>` selector hooks, so the keys are the
// hook names the component destructures from props.
assert.deepEqual(Object.keys(injected.hooks).sort(), ['colorScheme', 'locale', 'stats'])
assert.equal(typeof injected.hooks.stats.getSnapshot, 'function')
assert.equal(injected.hooks.stats.getSnapshot().status, 'ready')
assert.equal(injected.hooks.stats.getSnapshot().stats.totals.tokens, 100)
assert.equal(injected.hooks.colorScheme.getSnapshot().scheme, 'dark')
assert.equal(typeof injected.hooks.locale.getSnapshot, 'function')
assert.equal(injected.hooks.locale.getSnapshot().id, 'zh')
assert.equal(typeof registrations[0].component, 'function')

await injected.actions.refresh()
assert.deepEqual(requests, [{ action: 'getStats' }, { action: 'refresh' }])

// Regression: the view must read the injected `use<Name>` hooks from props. It
// used to read `props.hooks.*`, which is undefined and crashed the section (the
// boundary then showed "使用统计加载失败").
{
  const snapshot = injected.hooks.stats.getSnapshot()
  const view = helpers.UsageStatsView({
    useStats: (selector) => selector(snapshot),
    useColorScheme: (selector) => selector({ scheme: 'dark' }),
    useLocale: (selector) => selector({ id: 'zh' }),
    actions: injected.actions,
    t: (key, parameters) => (parameters === undefined ? key : `${key}(${JSON.stringify(parameters)})`),
  })
  assert.ok(view !== null && view !== undefined, 'the view renders without throwing')
  assert.equal(view.type, 'div')
  assert.equal(view.props.className, 'us-root')
  assert.equal(view.props['data-scheme'], 'dark')
}

// A missing hook degrades to the error card instead of crashing.
{
  const view = helpers.UsageStatsView({
    actions: injected.actions,
    t: (key) => key,
  })
  assert.ok(view !== null && view !== undefined)
  assert.equal(view.props.className, 'us-root')
  assert.equal(view.props['data-scheme'], 'light')
}

for (const cleanup of cleanups) cleanup()

console.log('client tests passed')
