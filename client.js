window.__ModuleLoader__.load({
  id: 'dsh-usage-stats',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'usage-stats'
    const PACKAGE = 'dsh-usage-stats'
    const REMOTE_NAMESPACE = 'usageStats'
    const SECTION_ID = 'usage-stats'
    /** Settings nav order: right after the shipped 归档管理 section (order 100). */
    const SECTION_ORDER = 101
    /** Range choices in days; the chart window includes today, so points = days + 1. */
    const RANGE_CHOICES = [7, 30]
    const ACTIVITY_MODES = ['daily', 'weekly', 'cumulative']
    const HEATMAP_WEEKS = 53
    /** Reference cell edge/gap; the grid keeps these and shows fewer weeks. */
    const HEATMAP_CELL = 11
    const HEATMAP_GAP = 3
    /** Never show less than a quarter of history. */
    const HEATMAP_MIN_WEEKS = 13
    const TREND_SERIES_LIMIT = 6
    const DONUT_SEGMENTS = 5

    /** Model palette, light and dark. Artwork colours, not theme tokens. */
    const PALETTE = [
      { light: '#4D6BFE', dark: '#6D8BFF' },
      { light: '#1F9254', dark: '#35B36F' },
      { light: '#8B5CF6', dark: '#A78BFA' },
      { light: '#E5484D', dark: '#F06A6E' },
      { light: '#F59E0B', dark: '#FBBF24' },
      { light: '#0FA3A3', dark: '#2BC7C7' },
    ]
    const NEUTRAL = { light: '#9AA0AA', dark: '#7A8290' }
    const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const DAY_MS = 86_400_000
    /** Assumed tooltip width for edge clamping; mirrors `.us-tip` max-width. */
    const TIP_WIDTH = 260

    const zh = {
      nav: '使用统计',
      'page.title': '使用统计',
      'page.scope': '应用用量',
      'page.scopeHint': '本机所有会话的累计用量',
      'page.source': '数据来自本机会话日志，仅在本机统计。',
      'stats.total': '累计 Token 数',
      'stats.peak': '峰值 Token 数',
      'stats.peakHint': '单日最高用量',
      'stats.longestChat': '最长聊天时长',
      'stats.longestChatHint': '单次对话的累计对话时长',
      'unit.tokens': 'tokens',
      'unit.hourSuffix': '小时',
      'unit.minuteSuffix': '分钟',
      'unit.secondSuffix': '秒',
      'unit.zero': '—',
      'activity.title': 'Token 活动',
      'activity.daily': '每日',
      'activity.weekly': '每周',
      'activity.cumulative': '累计',
      'activity.more': '多',
      'activity.less': '少',
      'activity.summary': '{period}活跃 {days} 天，合计 {tokens} tokens',
      'activity.summary.weekly': '{period}活跃 {weeks} 个周，合计 {tokens} tokens',
      'activity.summary.cumulative': '{period}累计 {tokens} tokens',
      'period.year': '近一年',
      'period.months': '近 {count} 个月',
      'activity.weekOf': '当周合计',
      'activity.until': '截至当日累计',
      'tip.turns': '{count} 轮消息',
      'range.label': '时间范围',
      'range.7': '近 7 日',
      'range.30': '近 30 日',
      'trend.title': '每日 Token 趋势图',
      'models.title': '模型用量',
      'models.other': '其他模型',
      'models.share': '{percent}%',
      refresh: '刷新',
      refreshing: '统计中…',
      loading: '正在统计用量…',
      'error.title': '无法读取用量统计',
      'error.body': '请稍后重试，或重启应用。',
      'error.refreshFailed': '刷新失败：{message}',
      'boundary.title': '使用统计加载失败',
      'boundary.retry': '重试',
      'empty.title': '暂无用量数据',
      'empty.body': '完成一次对话后，这里会显示 Token 用量、活跃天数与模型分布。',
      'skipped': '已跳过 {count} 个会话（无法读取或正在迁移）',
      'truncated': '会话过多，仅统计了前 {count} 个',
      'sessions': '共统计 {count} 个会话',
    }

    const en = {
      nav: 'Usage',
      'page.title': 'Usage Statistics',
      'page.scope': 'App usage',
      'page.scopeHint': 'Everything this app has recorded locally',
      'page.source': 'Computed from local session logs only; nothing leaves this machine.',
      'stats.total': 'Total tokens',
      'stats.peak': 'Peak tokens',
      'stats.peakHint': 'Highest single-day usage',
      'stats.longestChat': 'Longest chat',
      'stats.longestChatHint': 'Most time spent inside one conversation',
      'unit.tokens': 'tokens',
      'unit.hourSuffix': 'h',
      'unit.minuteSuffix': 'min',
      'unit.secondSuffix': 's',
      'unit.zero': '—',
      'activity.title': 'Token activity',
      'activity.daily': 'Daily',
      'activity.weekly': 'Weekly',
      'activity.cumulative': 'Cumulative',
      'activity.more': 'More',
      'activity.less': 'Less',
      'activity.summary': 'Active {days} days {period}, {tokens} tokens in total',
      'activity.summary.weekly': 'Active {weeks} weeks {period}, {tokens} tokens in total',
      'activity.summary.cumulative': '{tokens} tokens accumulated {period}',
      'period.year': 'over the last year',
      'period.months': 'over the last {count} months',
      'activity.weekOf': 'Week total',
      'activity.until': 'Cumulative to this day',
      'tip.turns': '{count} turns',
      'range.label': 'Time range',
      'range.7': 'Last 7 days',
      'range.30': 'Last 30 days',
      'trend.title': 'Daily token trend',
      'models.title': 'Model usage',
      'models.other': 'Other models',
      'models.share': '{percent}%',
      refresh: 'Refresh',
      refreshing: 'Measuring…',
      loading: 'Measuring usage…',
      'error.title': 'Usage statistics are unavailable',
      'error.body': 'Try again in a moment, or restart the app.',
      'error.refreshFailed': 'Refresh failed: {message}',
      'boundary.title': 'Usage statistics failed to load',
      'boundary.retry': 'Retry',
      'empty.title': 'No usage yet',
      'empty.body': 'Finish a conversation and token usage, active days and model share appear here.',
      'skipped': 'Skipped {count} session(s) that could not be read',
      'truncated': 'Too many sessions; only the first {count} were counted',
      'sessions': 'Across {count} sessions',
    }

    const CSS = `
.us-root{display:flex;flex-direction:column;gap:16px;max-width:820px;min-width:0;color:var(--dsw-alias-label-primary);font-family:var(--dsh-font-family-text,inherit);font-size:14px;line-height:22px;--us-heat-0:#EBEDF0;--us-heat-1:rgba(77,107,254,.20);--us-heat-2:rgba(77,107,254,.42);--us-heat-3:rgba(77,107,254,.68);--us-heat-4:#4D6BFE}
.us-root[data-scheme=dark]{--us-heat-0:#23252B;--us-heat-1:rgba(109,139,255,.24);--us-heat-2:rgba(109,139,255,.48);--us-heat-3:rgba(109,139,255,.74);--us-heat-4:#6D8BFF}
.us-header{display:flex;align-items:center;gap:10px;min-width:0}
.us-title{margin:0;font-size:20px;line-height:28px;font-weight:500;color:var(--dsw-alias-label-primary)}
.us-scope{box-sizing:border-box;display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;white-space:nowrap}
.us-card{box-sizing:border-box;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l1));border-radius:var(--dsw-radius-xl,var(--dsw-radius-lg));background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-1))}
.us-stats{display:flex;align-items:stretch;padding:18px 4px}
.us-stat{display:flex;flex:1 1 0;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:0 16px;text-align:center}
.us-stat+.us-stat{border-left:.5px solid var(--dsw-alias-border-l1)}
/* One inline line box for the whole value: number and unit share the text
   baseline. A nested flex box would let the smaller unit align to the box edge
   instead of the baseline, which reads as "the units hang lower". */
.us-statValue{display:block;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);white-space:nowrap;text-align:center}
.us-statPart{display:inline}
.us-statNumber{font-size:22px;line-height:30px;font-weight:500}
.us-statUnit{margin-left:3px;font-size:13px;line-height:20px;font-weight:400;color:var(--dsw-alias-label-secondary);position:relative;top:-1px}
.us-statPart+.us-statPart{margin-left:8px}
.us-statLabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.us-cardHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 0}
.us-cardTitle{margin:0;font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-primary)}
.us-cardBody{padding:12px 16px 16px;min-width:0}
.us-seg{box-sizing:border-box;display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}
.us-segItem{box-sizing:border-box;height:22px;padding:0 10px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer}
.us-segItem:hover:not(.us-segItemActive){color:var(--dsw-alias-label-primary)}
.us-segItemActive{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-soft,0 1px 2px rgba(0,0,0,.08))}
.us-heatWrap{display:flex;align-items:flex-start;gap:12px;min-width:0;--us-cell:11px;--us-gap:3px}
/* flex:1 lets the measured width drive the cell size; no overflow clip, so a
   sizing mistake shows up instead of silently dropping the newest weeks. */
.us-heat{display:flex;flex:1 1 auto;flex-direction:column;gap:8px;min-width:0}
.us-heatGrid{display:flex;gap:var(--us-gap)}
.us-heatCol{display:flex;flex-direction:column;gap:var(--us-gap)}
.us-heatCell{display:block;width:var(--us-cell);height:var(--us-cell);border-radius:2px;background:var(--us-heat-0);cursor:default}
.us-heatCell[data-level="1"]{background:var(--us-heat-1)}
.us-heatCell[data-level="2"]{background:var(--us-heat-2)}
.us-heatCell[data-level="3"]{background:var(--us-heat-3)}
.us-heatCell[data-level="4"]{background:var(--us-heat-4)}
.us-heatCell[data-future=true]{visibility:hidden}
.us-heatMonths{position:relative;height:16px;margin-top:-2px}
.us-heatMonth{position:absolute;top:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.us-heatLegend{display:flex;flex-direction:column;align-items:center;gap:4px;flex:none;padding-top:2px}
.us-heatLegendLabel{font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary)}
.us-heatLegendCells{display:flex;flex-direction:column;gap:var(--us-gap)}
.us-heatSummary{margin:10px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.us-range{display:flex;align-items:center;justify-content:space-between;gap:12px}
.us-rangeLabel{font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-primary)}
.us-legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:0 16px}
.us-legendItem{display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.us-dot{display:inline-block;flex:none;width:8px;height:8px;border-radius:50%}
.us-chart{position:relative;width:100%;min-width:0}
.us-chartX{display:flex;justify-content:space-between;gap:4px;padding:6px 16px 14px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.us-chartXLabel{white-space:nowrap}
.us-models{display:flex;align-items:center;gap:24px;min-width:0}
.us-donut{flex:none;position:relative;width:200px;height:200px}
.us-donutCenter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none}
.us-donutValue{font-size:20px;line-height:26px;font-weight:500;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.us-donutLabel{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.us-modelList{display:flex;flex:1 1 auto;flex-direction:column;min-width:0}
/* The row keeps its text column aligned (negative margin cancels the added
   padding) so the hover highlight reads as an inset rounded card, not a
   full-bleed rectangle. */
.us-modelRow{display:flex;align-items:flex-start;gap:8px;padding:9px 10px;margin:0 -10px;border-radius:var(--dsw-radius-md,8px);position:relative;min-width:0;transition:background-color .12s ease}
.us-modelRow+.us-modelRow::before{content:'';position:absolute;left:10px;right:10px;top:0;height:.5px;background:var(--dsw-alias-border-l1)}
.us-modelRow .us-dot{margin-top:7px}
.us-modelMain{display:flex;flex:1 1 auto;flex-direction:column;gap:1px;min-width:0}
.us-modelTop{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0}
.us-modelName{overflow:hidden;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap}
.us-modelShare{flex:none;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.us-modelTokens{font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}
.us-actions{display:flex;justify-content:flex-end;position:sticky;bottom:8px;padding:0 2px}
.us-refresh{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,var(--dsw-radius-lg));background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;box-shadow:var(--dsw-elevation-soft,0 1px 2px rgba(0,0,0,.08))}
.us-refresh:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}
.us-refresh:disabled{cursor:default;color:var(--dsw-alias-label-tertiary)}
.us-refresh:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.us-refreshIcon{display:inline-flex;flex:none}
.us-refreshIcon[data-busy=true]{animation:us-spin .9s linear infinite}
@keyframes us-spin{to{transform:rotate(360deg)}}
.us-state{display:flex;flex-direction:column;align-items:center;gap:6px;padding:56px 16px;text-align:center}
.us-stateTitle{margin:0;font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-primary)}
.us-stateBody{margin:0;max-width:420px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.us-note{margin:0;padding:0 16px 14px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.us-skeleton{height:120px;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-2);animation:us-pulse 1.4s ease-in-out infinite}
@keyframes us-pulse{0%,100%{opacity:1}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.us-refreshIcon[data-busy=true],.us-skeleton{animation:none}.us-modelRow{transition:none}}
.us-cardBody,.us-models{position:relative}
.us-chartPlot{position:relative;width:100%;height:100%;outline:none}
.us-chartPlot:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px;border-radius:var(--dsw-radius-sm,6px)}
.us-modelRowActive{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}
.us-modelRowActive::before,.us-modelRowActive+.us-modelRow::before{opacity:0}
.us-alert{display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;padding:8px 12px;border:.5px solid var(--dsw-alias-state-warn-primary);border-radius:var(--dsw-radius-md,var(--dsw-radius-lg));background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px}
.us-alertText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.us-alertAction{flex:none;border:none;background:transparent;padding:0;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12px;cursor:pointer}
.us-alertAction:hover{text-decoration:underline}
.us-tip{position:absolute;z-index:5;box-sizing:border-box;min-width:120px;max-width:260px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;box-shadow:var(--dsw-elevation-prominent,0 6px 20px rgba(0,0,0,.14));transform:translate(-50%,calc(-100% - 10px));pointer-events:none;white-space:nowrap}
.us-tipTitle{font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary)}
.us-tipValue{font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.us-tipEmpty{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.us-tipRows{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.us-tipRow{display:flex;align-items:center;gap:8px;min-width:0}
.us-tipDot{display:inline-block;flex:none;width:8px;height:8px;border-radius:50%}
.us-tipName{overflow:hidden;flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-primary);text-overflow:ellipsis}
.us-tipShare{flex:none;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}
.us-tipRow .us-tipValue{margin-left:auto;flex:none}
`

    /** Small observable snapshot store shared with the slot's standard hook. */
    function createSnapshotStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        set(next) {
          value = next
          for (const listener of [...listeners]) {
            try {
              listener()
            } catch (error) {
              console.error('[usage-stats] snapshot listener failed', error)
            }
          }
        },
      }
    }

    /** Fallbacks used only if the slot stops supplying the injected hooks. */
    const MISSING_STATS = Object.freeze({ status: 'error', stats: null, error: null, busy: false })
    const MISSING_THEME = Object.freeze({ scheme: 'light' })
    const MISSING_LOCALE = Object.freeze({ id: 'zh' })

    /** Measure an element's content width; returns [ref, width]. */
    function useElementWidth() {
      const ref = React.useRef(null)
      const [width, setWidth] = React.useState(0)
      React.useLayoutEffect(() => {
        const node = ref.current
        if (node === null || node === undefined) return undefined
        const measure = () => setWidth(node.clientWidth)
        measure()
        if (typeof ResizeObserver !== 'function') {
          window.addEventListener('resize', measure)
          return () => window.removeEventListener('resize', measure)
        }
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
      }, [])
      return [ref, width]
    }

    /**
     * Hover tooltip state for one card.
     *
     * `show` records the pointer position relative to the card's container, so
     * the card can render a tooltip above the cursor without escaping the panel.
     */
    function useHoverCard() {
      const containerRef = React.useRef(null)
      const [tip, setTip] = React.useState(null)
      const show = React.useCallback((event, content) => {
        const node = containerRef.current
        if (node === null || node === undefined) return
        const rect = node.getBoundingClientRect()
        setTip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          width: rect.width,
          content,
        })
      }, [])
      const hide = React.useCallback(() => setTip(null), [])
      return { tip, containerRef, show, hide }
    }

    /** Absolutely positioned hover tooltip, clamped inside its container. */
    function HoverCard(props) {
      const tip = props.tip
      if (tip === null || tip === undefined) return null
      const left = clampTipX(tip.x, tip.width, TIP_WIDTH)
      return h(
        'div',
        { className: 'us-tip', style: { left: `${left}px`, top: `${tip.y}px` }, role: 'presentation' },
        props.children,
      )
    }

    /**
     * Whether the active locale is Chinese. Takes the locale snapshot the slot
     * hands to the component (the `hooks.locale` store projected by the shell).
     */
    function isChinese(localeSnapshot) {
      const id = typeof localeSnapshot?.id === 'string' ? localeSnapshot.id : 'zh'
      return id.toLowerCase().startsWith('zh')
    }

    /** Trim one rounded decimal (`2.50` → `2.5`, `3.0` → `3`). */
    function trimDecimal(value) {
      const rounded = Math.round(value * 10) / 10
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
    }

    /**
     * Compact token amount, split into number and unit.
     * Chinese uses 亿/万 (matching the reference design), other locales K/M/B.
     */
    function formatTokenParts(tokens, chinese) {
      const value = Number.isFinite(tokens) ? Math.max(0, tokens) : 0
      if (chinese) {
        if (value >= 1e8) return { value: trimDecimal(value / 1e8), unit: '亿' }
        if (value >= 1e4) return { value: trimDecimal(value / 1e4), unit: '万' }
        return { value: String(Math.round(value)), unit: '' }
      }
      if (value >= 1e9) return { value: trimDecimal(value / 1e9), unit: 'B' }
      if (value >= 1e6) return { value: trimDecimal(value / 1e6), unit: 'M' }
      if (value >= 1e3) return { value: trimDecimal(value / 1e3), unit: 'K' }
      return { value: String(Math.round(value)), unit: '' }
    }

    /** One-line compact token amount. */
    function formatTokens(tokens, chinese) {
      const parts = formatTokenParts(tokens, chinese)
      return parts.unit.length > 0 ? `${parts.value} ${parts.unit}` : parts.value
    }

    /** Share percentage: integer at or above 10%, one decimal below. */
    function formatShare(share) {
      const percent = Math.max(0, share) * 100
      if (percent >= 10) return String(Math.round(percent))
      if (percent >= 1) return (Math.round(percent * 10) / 10).toFixed(1)
      if (percent > 0) return '0.1'
      return '0'
    }

    /** Local `YYYY-MM-DD` key for one Date. */
    function dayKeyOf(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    /** Parse a `YYYY-MM-DD` key into a local Date. */
    function parseDayKey(key) {
      const parts = String(key).split('-')
      const year = Number(parts[0])
      const month = Number(parts[1])
      const day = Number(parts[2])
      return new Date(Number.isFinite(year) ? year : 1970, Number.isFinite(month) ? month - 1 : 0, Number.isFinite(day) ? day : 1)
    }

    /** Shift a day key by whole days. */
    function shiftDayKey(key, delta) {
      const date = parseDayKey(key)
      date.setDate(date.getDate() + delta)
      return dayKeyOf(date)
    }

    /** `10月27日` / `Oct 27`. */
    function formatDayLabel(key, chinese) {
      const date = parseDayKey(key)
      const month = date.getMonth()
      const day = date.getDate()
      return chinese ? `${month + 1}月${day}日` : `${MONTHS_EN[month]} ${day}`
    }

    /** `12月` / `Dec`. */
    function formatMonthLabel(monthIndex, chinese) {
      return chinese ? `${monthIndex + 1}月` : MONTHS_EN[monthIndex]
    }

    /** `2026年10月27日` / `Oct 27, 2026` — the heatmap tooltip's title line. */
    function formatLongDayLabel(key, chinese) {
      const date = parseDayKey(key)
      const year = date.getFullYear()
      const month = date.getMonth()
      const day = date.getDate()
      return chinese ? `${year}年${month + 1}月${day}日` : `${MONTHS_EN[month]} ${day}, ${year}`
    }

    /**
     * Index of the plotted point nearest to a horizontal pixel offset.
     * Returns -1 for an empty series so callers can skip rendering.
     */
    function nearestIndex(px, width, count) {
      if (!Number.isFinite(count) || count <= 0) return -1
      if (count === 1) return 0
      // Before the first measurement there is no geometry to map onto.
      if (!Number.isFinite(width) || width <= 0) return 0
      const ratio = Math.min(1, Math.max(0, (Number.isFinite(px) ? px : 0) / width))
      return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))))
    }

    /** Keep a centered tooltip inside its container, leaving an 8px margin. */
    function clampTipX(x, containerWidth, tipWidth) {
      const half = (Number.isFinite(tipWidth) ? tipWidth : TIP_WIDTH) / 2
      const margin = 8
      if (!Number.isFinite(containerWidth) || containerWidth <= half * 2 + margin * 2) {
        return Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth / 2 : x
      }
      return Math.min(containerWidth - half - margin, Math.max(half + margin, x))
    }

    /**
     * How many whole weeks fit at the reference cell size.
     *
     * Returns the full year when the panel is wide enough, otherwise as many weeks
     * as fit, never fewer than `HEATMAP_MIN_WEEKS` (and never more than a year).
     * An unmeasured panel reports the minimum so the first paint cannot overflow;
     * the resize observer corrects it on the next frame.
     */
    function heatmapWeeks(available, cell, gap) {
      const edge = Number.isFinite(cell) && cell > 0 ? cell : HEATMAP_CELL
      const spacing = Number.isFinite(gap) && gap > 0 ? gap : HEATMAP_GAP
      const usable = Number.isFinite(available) ? available : 0
      if (usable <= 0) return HEATMAP_MIN_WEEKS
      const fit = Math.floor((usable + spacing) / (edge + spacing))
      if (!Number.isFinite(fit)) return HEATMAP_MIN_WEEKS
      return Math.min(HEATMAP_WEEKS, Math.max(HEATMAP_MIN_WEEKS, fit))
    }

    /** Index `stats.daily` by day key for hover lookups. */
    function dailyByDay(stats) {
      const byDay = new Map()
      for (const entry of Array.isArray(stats?.daily) ? stats.daily : []) {
        if (entry === null || typeof entry !== 'object' || typeof entry.day !== 'string') continue
        byDay.set(entry.day, entry)
      }
      return byDay
    }

    /**
     * Duration split into number/unit parts so the stat row can render one
     * typographic pattern for every metric (big number, small unit).
     * @returns {Array<{value: string, unit: string}>}
     */
    function formatDurationParts(ms, t) {
      if (!Number.isFinite(ms) || ms <= 0) return [{ value: t('unit.zero'), unit: '' }]
      const totalMinutes = Math.floor(ms / 60_000)
      if (totalMinutes < 1) {
        return [{ value: String(Math.max(1, Math.round(ms / 1000))), unit: t('unit.secondSuffix') }]
      }
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      const parts = []
      if (hours > 0) parts.push({ value: String(hours), unit: t('unit.hourSuffix') })
      if (minutes > 0 || hours === 0) parts.push({ value: String(minutes), unit: t('unit.minuteSuffix') })
      return parts
    }

    /**
     * Build the activity grid.
     *
     * `mode` picks the value driving intensity: that day's tokens, its week's
     * total, or the running total up to that day (within the visible window).
     * `stride` is the horizontal distance between columns in px; it decides how
     * many columns a month label needs so labels never overlap.
     * `weeks` is how many columns to draw (fewer than a year on narrow panels).
     * Cells after today are hidden.
     */
    function buildHeatmap(daily, today, mode, stride, weeks) {
      const step = Number.isFinite(stride) && stride > 0 ? stride : HEATMAP_CELL + HEATMAP_GAP
      const labelColumns = Math.max(2, Math.ceil(26 / step))
      const weekCount = Number.isFinite(weeks) && weeks > 0 ? Math.min(HEATMAP_WEEKS, Math.floor(weeks)) : HEATMAP_WEEKS
      const byDay = new Map()
      for (const entry of Array.isArray(daily) ? daily : []) {
        if (entry === null || typeof entry !== 'object') continue
        const key = typeof entry.day === 'string' ? entry.day : ''
        if (key.length === 0) continue
        byDay.set(key, Number.isFinite(entry.tokens) ? entry.tokens : 0)
      }
      const todayDate = parseDayKey(today)
      const weekday = (todayDate.getDay() + 6) % 7
      const firstMonday = shiftDayKey(today, -weekday - (weekCount - 1) * 7)
      const columns = []
      const chronological = []
      for (let column = 0; column < weekCount; column += 1) {
        const cells = []
        for (let row = 0; row < 7; row += 1) {
          const day = shiftDayKey(firstMonday, column * 7 + row)
          const cell = {
            day,
            tokens: byDay.get(day) ?? 0,
            future: day > today,
            value: 0,
            level: 0,
          }
          cells.push(cell)
          chronological.push(cell)
        }
        columns.push(cells)
      }
      if (mode === 'weekly') {
        for (const cells of columns) {
          const sum = cells.reduce((total, cell) => total + (cell.future ? 0 : cell.tokens), 0)
          for (const cell of cells) cell.value = cell.future ? 0 : sum
        }
      } else if (mode === 'cumulative') {
        let running = 0
        for (const cell of chronological) {
          if (!cell.future) running += cell.tokens
          cell.value = cell.future ? 0 : running
        }
      } else {
        for (const cell of chronological) cell.value = cell.future ? 0 : cell.tokens
      }
      let max = 0
      for (const cell of chronological) if (!cell.future && cell.value > max) max = cell.value
      for (const cell of chronological) {
        if (cell.future || cell.value <= 0 || max <= 0) {
          cell.level = 0
          continue
        }
        cell.level = Math.min(4, Math.max(1, Math.ceil((cell.value / max) * 4)))
      }
      // Month labels: one per month change, spaced by the rendered column stride
      // so they never overlap, and the current month is always labelled — dropping
      // the tail label made the grid look like it ended months ago.
      const months = []
      let lastLabelColumn = -10
      let previousMonth = -1
      for (let column = 0; column < columns.length; column += 1) {
        const month = parseDayKey(columns[column][0].day).getMonth()
        if (month === previousMonth) continue
        previousMonth = month
        if (column - lastLabelColumn < labelColumns) continue
        months.push({ column, month })
        lastLabelColumn = column
      }
      const todayMonth = parseDayKey(today).getMonth()
      const lastColumn = columns.length - 1
      if (lastColumn >= 0 && (months.length === 0 || months[months.length - 1].month !== todayMonth)) {
        const previous = months[months.length - 1]
        if (previous === undefined || lastColumn - previous.column >= labelColumns) {
          months.push({ column: lastColumn, month: todayMonth })
        } else {
          // Too close to the previous label: move that one to the final column
          // instead of losing the current month entirely.
          months[months.length - 1] = { column: lastColumn, month: todayMonth }
        }
      }
      return { columns, months, max, windowStart: firstMonday, windowEnd: today }
    }

    /** Build per-model series for the trend chart over `windowDays` inclusive days. */
    function buildTrend(stats, windowDays) {
      const days = []
      for (let offset = windowDays - 1; offset >= 0; offset -= 1) days.push(shiftDayKey(stats.today, -offset))
      const daily = new Map()
      for (const entry of Array.isArray(stats.daily) ? stats.daily : []) {
        if (entry !== null && typeof entry === 'object' && typeof entry.day === 'string') daily.set(entry.day, entry)
      }
      const totals = new Map()
      for (const day of days) {
        const entry = daily.get(day)
        if (entry === undefined || entry.models === null || typeof entry.models !== 'object') continue
        for (const [model, tokens] of Object.entries(entry.models)) {
          if (!Number.isFinite(tokens)) continue
          totals.set(model, (totals.get(model) ?? 0) + tokens)
        }
      }
      const ranked = [...totals.entries()].sort((left, right) => right[1] - left[1]).slice(0, TREND_SERIES_LIMIT)
      const order = new Map()
      const allModels = Array.isArray(stats.models) ? stats.models : []
      allModels.forEach((entry, index) => order.set(entry.model, index))
      const series = ranked.map(([model]) => ({
        model,
        colorIndex: order.has(model) ? order.get(model) : allModels.length,
        points: days.map((day) => {
          const entry = daily.get(day)
          const models = entry?.models
          const value = models !== null && typeof models === 'object' ? models[model] : undefined
          return { day, tokens: Number.isFinite(value) ? value : 0 }
        }),
      }))
      let max = 0
      for (const entry of series) {
        for (const point of entry.points) if (point.tokens > max) max = point.tokens
      }
      return { days, series, max }
    }

    /** Donut segments: the largest models plus one aggregated remainder. */
    function donutSegments(models, maxSegments) {
      const list = Array.isArray(models) ? models.filter((entry) => entry !== null && typeof entry === 'object') : []
      const total = list.reduce((sum, entry) => sum + (Number.isFinite(entry.tokens) ? entry.tokens : 0), 0)
      if (total <= 0) return { segments: [], total: 0 }
      const head = list.slice(0, maxSegments)
      const rest = list.slice(maxSegments)
      const items = head.map((entry) => ({ model: entry.model, tokens: entry.tokens, other: false }))
      if (rest.length > 0) {
        const restTokens = rest.reduce((sum, entry) => sum + (Number.isFinite(entry.tokens) ? entry.tokens : 0), 0)
        if (restTokens > 0) items.push({ model: null, tokens: restTokens, other: true })
      }
      let offset = 0
      const segments = items.map((item) => {
        const share = item.tokens / total
        const segment = { ...item, share, offset }
        offset += share
        return segment
      })
      return { segments, total }
    }

    /** Palette colour for one model index. */
    function paletteColor(index, scheme) {
      const entry = PALETTE[index]
      if (entry === undefined) return scheme === 'dark' ? NEUTRAL.dark : NEUTRAL.light
      return scheme === 'dark' ? entry.dark : entry.light
    }

    /** Round to 2 decimals, guarding NaN. */
    function round2(value) {
      return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
    }

    /** Smooth (Catmull-Rom) path through points, clamped to the plot box. */
    function smoothPath(points, minY, maxY) {
      if (!Array.isArray(points) || points.length === 0) return ''
      const clamp = (value) => Math.min(maxY, Math.max(minY, value))
      let path = `M${round2(points[0].x)} ${round2(clamp(points[0].y))}`
      for (let index = 0; index < points.length - 1; index += 1) {
        const previous = points[index - 1] ?? points[index]
        const current = points[index]
        const next = points[index + 1]
        const after = points[index + 2] ?? next
        const control1x = current.x + (next.x - previous.x) / 6
        const control1y = clamp(current.y + (next.y - previous.y) / 6)
        const control2x = next.x - (after.x - current.x) / 6
        const control2y = clamp(next.y - (after.y - current.y) / 6)
        path += `C${round2(control1x)} ${round2(control1y)} ${round2(control2x)} ${round2(control2y)} ${round2(next.x)} ${round2(clamp(next.y))}`
      }
      return path
    }

    /** Bar-chart glyph used in the page header. */
    function StatsIcon(props) {
      const size = props?.size ?? 20
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M3.5 20.5h17' }),
        h('path', { d: 'M7 20.5V12.5' }),
        h('path', { d: 'M12 20.5V5.5' }),
        h('path', { d: 'M17 20.5V9' }),
      )
    }

    /** Refresh glyph. */
    function RefreshIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M20 11a8 8 0 1 0-2.3 6.3' }),
        h('path', { d: 'M20 5v6h-6' }),
      )
    }

    /** One pill segmented control. */
    function Segmented(props) {
      return h(
        'div',
        { className: 'us-seg', role: 'group', 'aria-label': props.label },
        props.options.map((option) =>
          h(
            'button',
            {
              key: option.value,
              type: 'button',
              className: option.value === props.value ? 'us-segItem us-segItemActive' : 'us-segItem',
              'aria-pressed': option.value === props.value,
              onClick: () => props.onChange(option.value),
            },
            option.label,
          ),
        ),
      )
    }

    /** Header: page title plus the usage-scope pill. */
    function PageHeader(props) {
      return h(
        'div',
        { className: 'us-header' },
        h(StatsIcon, { size: 20 }),
        h('h2', { className: 'us-title' }, props.title),
        h('span', { className: 'us-scope', title: props.scopeHint }, props.scope),
      )
    }

    /** The headline metrics, all sharing one number/unit pattern. */
    function StatRow(props) {
      return h(
        'section',
        { className: 'us-card us-stats' },
        props.items.map((item) =>
          h(
            'div',
            { className: 'us-stat', key: item.key },
            h(
              'div',
              { className: 'us-statValue', title: item.title },
              item.parts.map((part, index) =>
                h(
                  'span',
                  { className: 'us-statPart', key: `part-${index}` },
                  h('span', { className: 'us-statNumber' }, part.value),
                  part.unit.length > 0 ? h('span', { className: 'us-statUnit' }, part.unit) : null,
                ),
              ),
            ),
            h('div', { className: 'us-statLabel' }, item.label),
          ),
        ),
      )
    }

    /** Activity heatmap card. */
    function TokenActivityCard(props) {
      const { stats, chinese, t } = props
      const [mode, setMode] = React.useState('daily')
      // Keep the reference cell size and show fewer weeks on a narrow panel: tiny
      // cells were unreadable.
      const [gridRef, gridWidth] = useElementWidth()
      const cell = HEATMAP_CELL
      const gap = HEATMAP_GAP
      const weeks = heatmapWeeks(gridWidth, cell, gap)
      const heatmap = React.useMemo(
        () => buildHeatmap(stats.daily, stats.today, mode, cell + gap, weeks),
        [stats, mode, cell, gap, weeks],
      )
      const byDay = React.useMemo(() => dailyByDay(stats), [stats])
      const hover = useHoverCard()
      // Aggregate only what the grid actually draws, so the summary cannot claim
      // "last N months" while counting the full history window.
      const windowStats = React.useMemo(() => {
        const days = new Set()
        const weekKeys = new Set()
        let total = 0
        const from = heatmap.windowStart
        const to = heatmap.windowEnd
        for (const entry of Array.isArray(stats.daily) ? stats.daily : []) {
          if (!Number.isFinite(entry?.tokens) || entry.tokens <= 0) continue
          if (typeof entry.day !== 'string' || entry.day < from || entry.day > to) continue
          days.add(entry.day)
          total += entry.tokens
          // A "week" is one grid column: the Monday-aligned week of the day.
          const date = parseDayKey(entry.day)
          weekKeys.add(shiftDayKey(entry.day, -((date.getDay() + 6) % 7)))
        }
        return { days: days.size, weeks: weekKeys.size, total }
      }, [stats, heatmap])
      // The summary states the window actually drawn, not a fixed "last year".
      const period =
        weeks >= HEATMAP_WEEKS
          ? t('period.year')
          : t('period.months', { count: Math.max(1, Math.round(weeks / 4.345)) })
      const summary =
        mode === 'weekly'
          ? t('activity.summary.weekly', { period, weeks: windowStats.weeks, tokens: formatTokens(windowStats.total, chinese) })
          : mode === 'cumulative'
            ? t('activity.summary.cumulative', { period, tokens: formatTokens(windowStats.total, chinese) })
            : t('activity.summary', { period, days: windowStats.days, tokens: formatTokens(windowStats.total, chinese) })
      /** Tooltip payload for one day cell, following the active mode. */
      const contentFor = (cell) => {
        const entry = byDay.get(cell.day)
        const tokens = Number.isFinite(entry?.tokens) ? entry.tokens : 0
        return {
          day: cell.day,
          tokens: mode === 'daily' ? tokens : cell.value,
          dayTokens: tokens,
          turns: Number.isFinite(entry?.turns) ? entry.turns : 0,
          mode,
        }
      }
      return h(
        'section',
        { className: 'us-card' },
        h(
          'div',
          { className: 'us-cardHead' },
          h('h3', { className: 'us-cardTitle' }, t('activity.title')),
          h(Segmented, {
            label: t('activity.title'),
            value: mode,
            onChange: setMode,
            options: ACTIVITY_MODES.map((value) => ({ value, label: t(`activity.${value}`) })),
          }),
        ),
        h(
          'div',
          { className: 'us-cardBody', ref: hover.containerRef, onMouseLeave: hover.hide },
          h(
            'div',
            {
              className: 'us-heatWrap',
              style: { '--us-cell': `${cell}px`, '--us-gap': `${gap}px` },
            },
            h(
              'div',
              { className: 'us-heat', ref: gridRef },
              h(
                'div',
                { className: 'us-heatGrid', role: 'img', 'aria-label': summary },
                heatmap.columns.map((cells, index) =>
                  h(
                    'div',
                    { className: 'us-heatCol', key: `column-${index}` },
                    cells.map((cell) =>
                      h('span', {
                        key: cell.day,
                        className: 'us-heatCell',
                        'data-level': cell.level,
                        'data-future': cell.future ? 'true' : 'false',
                        'aria-hidden': 'true',
                        onMouseEnter: cell.future ? undefined : (event) => hover.show(event, contentFor(cell)),
                        onMouseMove: cell.future ? undefined : (event) => hover.show(event, contentFor(cell)),
                      }),
                    ),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'us-heatMonths' },
                heatmap.months.map((entry) =>
                  h(
                    'span',
                    {
                      key: `month-${entry.column}`,
                      className: 'us-heatMonth',
                      // The final label is right-anchored so it cannot run into the
                      // legend column; every other label starts at its column.
                      style:
                        entry.column === heatmap.columns.length - 1
                          ? { right: '0px' }
                          : { left: `${entry.column * (cell + gap)}px` },
                    },
                    formatMonthLabel(entry.month, chinese),
                  ),
                ),
              ),
            ),
            h(
              'div',
              { className: 'us-heatLegend', 'aria-hidden': 'true' },
              h('span', { className: 'us-heatLegendLabel' }, t('activity.more')),
              h(
                'div',
                { className: 'us-heatLegendCells' },
                [4, 3, 2, 1, 0].map((level) => h('span', { key: `legend-${level}`, className: 'us-heatCell', 'data-level': level })),
              ),
              h('span', { className: 'us-heatLegendLabel' }, t('activity.less')),
            ),
          ),
          h(
            HoverCard,
            { tip: hover.tip },
            hover.tip === null
              ? null
              : [
                  h('div', { className: 'us-tipTitle', key: 'title' }, formatLongDayLabel(hover.tip.content.day, chinese)),
                  h(
                    'div',
                    { className: 'us-tipValue', key: 'value' },
                    // The headline number follows the active mode, so switching
                    // 每日/每周/累计 is visible in the tooltip as well as the grid.
                    hover.tip.content.mode === 'weekly'
                      ? `${t('activity.weekOf')} ${formatTokens(hover.tip.content.tokens, chinese)} ${t('unit.tokens')}`
                      : hover.tip.content.mode === 'cumulative'
                        ? `${t('activity.until')} ${formatTokens(hover.tip.content.tokens, chinese)} ${t('unit.tokens')}`
                        : hover.tip.content.turns > 0
                          ? `${formatTokens(hover.tip.content.tokens, chinese)} ${t('unit.tokens')} · ${t('tip.turns', { count: hover.tip.content.turns })}`
                          : `${formatTokens(hover.tip.content.tokens, chinese)} ${t('unit.tokens')}`,
                  ),
                  hover.tip.content.mode === 'daily' || hover.tip.content.turns <= 0
                    ? null
                    : h('div', { className: 'us-tipValue', key: 'turns' }, t('tip.turns', { count: hover.tip.content.turns })),
                ],
          ),
          h('p', { className: 'us-heatSummary' }, summary),
        ),
      )
    }

    /** Daily trend card with hand-drawn SVG lines and a hover crosshair. */
    function TrendCard(props) {
      const { stats, windowDays, chinese, t, scheme } = props
      const [ref, width] = useElementWidth()
      const hover = useHoverCard()
      const trend = React.useMemo(() => buildTrend(stats, windowDays), [stats, windowDays])
      const byDay = React.useMemo(() => dailyByDay(stats), [stats])
      const [active, setActive] = React.useState(null)
      const height = 200
      const padTop = 10
      const padBottom = 6
      const padLeft = 4
      const padRight = 4
      const plotWidth = Math.max(1, width - padLeft - padRight)
      const plotHeight = Math.max(1, height - padTop - padBottom)
      const max = trend.max > 0 ? trend.max : 1
      const count = trend.days.length
      const xOf = (index) => padLeft + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth)
      const yOf = (tokens) => padTop + plotHeight * (1 - Math.min(1, Math.max(0, tokens / max)))
      const gridColor = scheme === 'dark' ? 'rgba(255,255,255,.09)' : 'rgba(17,24,39,.08)'
      const labelStep = Math.max(1, Math.ceil(count / 8))

      /** Tooltip payload for one hovered day: total plus per-model rows. */
      const contentFor = (index) => {
        const day = trend.days[index]
        if (day === undefined) return null
        const entry = byDay.get(day)
        const rows = trend.series
          .map((series) => ({
            model: series.model,
            colorIndex: series.colorIndex,
            tokens: Number.isFinite(series.points[index]?.tokens) ? series.points[index].tokens : 0,
          }))
          .filter((row) => row.tokens > 0)
          .sort((left, right) => right.tokens - left.tokens)
        return {
          day,
          total: Number.isFinite(entry?.tokens) ? entry.tokens : rows.reduce((sum, row) => sum + row.tokens, 0),
          rows,
        }
      }

      const setActiveAt = (index) => {
        const content = contentFor(index)
        if (content === null) return
        setActive(index)
        // Anchor the tooltip at the topmost plotted point of that day.
        const node = hover.containerRef.current
        if (node === null || node === undefined) return
        const rect = node.getBoundingClientRect()
        const top = trend.series.reduce((lowest, series) => {
          const value = series.points[index]?.tokens ?? 0
          return Math.min(lowest, yOf(value))
        }, padTop + plotHeight)
        hover.show(
          {
            clientX: rect.left + xOf(index),
            clientY: rect.top + Math.max(padTop + 28, top),
          },
          content,
        )
      }

      const clearActive = () => {
        setActive(null)
        hover.hide()
      }

      const activeContent = active === null ? null : contentFor(active)
      const activeX = active === null ? 0 : xOf(active)

      return h(
        'section',
        { className: 'us-card' },
        h('div', { className: 'us-cardHead' }, h('h3', { className: 'us-cardTitle' }, t('trend.title'))),
        h(
          'div',
          { className: 'us-legend', style: { paddingTop: '10px' } },
          trend.series.map((entry) =>
            h(
              'span',
              { className: 'us-legendItem', key: entry.model, title: entry.model },
              h('span', { className: 'us-dot', style: { background: paletteColor(entry.colorIndex, scheme) } }),
              entry.model,
            ),
          ),
        ),
        h(
          'div',
          {
            className: 'us-chart',
            ref: hover.containerRef,
            style: { height: `${height}px` },
            onMouseLeave: clearActive,
          },
          h(
            'div',
            {
              className: 'us-chartPlot',
              ref,
              tabIndex: 0,
              role: 'img',
              'aria-label': t('trend.title'),
              onMouseMove: (event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                const index = nearestIndex(event.clientX - rect.left - padLeft, plotWidth, count)
                if (index >= 0) setActiveAt(index)
              },
              onKeyDown: (event) => {
                if (event.key === 'Escape') {
                  clearActive()
                  return
                }
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                const base = active === null ? count - 1 : active
                const next = Math.min(count - 1, Math.max(0, base + (event.key === 'ArrowRight' ? 1 : -1)))
                setActiveAt(next)
              },
              onBlur: clearActive,
            },
            width > 0
              ? h(
                  'svg',
                  { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' },
                  [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
                    h('line', {
                      key: `grid-${ratio}`,
                      x1: padLeft,
                      x2: width - padRight,
                      y1: round2(padTop + plotHeight * ratio),
                      y2: round2(padTop + plotHeight * ratio),
                      stroke: gridColor,
                      strokeWidth: 1,
                      strokeDasharray: '3 4',
                      vectorEffect: 'non-scaling-stroke',
                    }),
                  ),
                  active === null
                    ? null
                    : h('line', {
                        className: 'us-cursorLine',
                        x1: round2(activeX),
                        x2: round2(activeX),
                        y1: padTop,
                        y2: padTop + plotHeight,
                        stroke: scheme === 'dark' ? 'rgba(255,255,255,.28)' : 'rgba(17,24,39,.22)',
                        strokeWidth: 1,
                        strokeDasharray: '3 4',
                        vectorEffect: 'non-scaling-stroke',
                      }),
                  trend.series.map((entry) => {
                    const points = entry.points.map((point, index) => ({ x: xOf(index), y: yOf(point.tokens) }))
                    return h('path', {
                      key: entry.model,
                      d: smoothPath(points, padTop, padTop + plotHeight),
                      fill: 'none',
                      stroke: paletteColor(entry.colorIndex, scheme),
                      strokeWidth: 2,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                      vectorEffect: 'non-scaling-stroke',
                    })
                  }),
                  active === null
                    ? null
                    : trend.series.map((entry) => {
                        const value = entry.points[active]?.tokens ?? 0
                        if (value <= 0) return null
                        return h('circle', {
                          key: `dot-${entry.model}`,
                          cx: round2(activeX),
                          cy: round2(yOf(value)),
                          r: 3.5,
                          fill: paletteColor(entry.colorIndex, scheme),
                          stroke: scheme === 'dark' ? '#111318' : '#FFFFFF',
                          strokeWidth: 1.5,
                        })
                      }),
                )
              : null,
          ),
          h(
            HoverCard,
            { tip: hover.tip },
          activeContent === null
            ? null
            : [
                h(
                  'div',
                  { className: 'us-tipTitle', key: 'title' },
                  `${formatDayLabel(activeContent.day, chinese)} - ${formatTokens(activeContent.total, chinese)} ${t('unit.tokens')}`,
                ),
                activeContent.rows.length === 0
                  ? h('div', { className: 'us-tipEmpty', key: 'empty' }, t('unit.zero'))
                  : h(
                      'div',
                      { className: 'us-tipRows', key: 'rows' },
                      activeContent.rows.map((row) =>
                        h(
                          'div',
                          { className: 'us-tipRow', key: row.model },
                          h('span', { className: 'us-tipDot', style: { background: paletteColor(row.colorIndex, scheme) } }),
                          h('span', { className: 'us-tipName' }, row.model),
                          h('span', { className: 'us-tipValue' }, `${formatTokens(row.tokens, chinese)} ${t('unit.tokens')}`),
                        ),
                      ),
                    ),
              ],
          ),
        ),
        h(
          'div',
          { className: 'us-chartX' },
          trend.days.map((day, index) =>
            index % labelStep === 0 || index === trend.days.length - 1
              ? h('span', { key: day, className: 'us-chartXLabel' }, formatDayLabel(day, chinese))
              : h('span', { key: day, className: 'us-chartXLabel' }, ''),
          ),
        ),
      )
    }

    /** Model share card: donut plus the ranked list. */
    function ModelUsageCard(props) {
      const { stats, chinese, t, scheme } = props
      const donut = React.useMemo(() => donutSegments(stats.models, DONUT_SEGMENTS), [stats.models])
      const hover = useHoverCard()
      const [active, setActive] = React.useState(null)
      const radius = 70
      const circumference = 2 * Math.PI * radius
      const totalParts = formatTokenParts(donut.total, chinese)
      const colorOf = (segment, index) =>
        segment.other ? (scheme === 'dark' ? NEUTRAL.dark : NEUTRAL.light) : paletteColor(index, scheme)
      const labelOf = (segment) => segment.model ?? t('models.other')
      return h(
        'section',
        { className: 'us-card' },
        h('div', { className: 'us-cardHead' }, h('h3', { className: 'us-cardTitle' }, t('models.title'))),
        h(
          'div',
          { className: 'us-cardBody us-models', ref: hover.containerRef, onMouseLeave: () => {
            setActive(null)
            hover.hide()
          } },
          h(
            'div',
            { className: 'us-donut' },
            h(
              'svg',
              { width: 200, height: 200, viewBox: '0 0 200 200', role: 'img', 'aria-label': t('models.title') },
              h('circle', { cx: 100, cy: 100, r: radius, fill: 'none', stroke: scheme === 'dark' ? '#2A2D34' : '#EEF0F4', strokeWidth: 26 }),
              donut.segments.map((segment, index) =>
                h('circle', {
                  key: `segment-${index}`,
                  cx: 100,
                  cy: 100,
                  r: radius,
                  fill: 'none',
                  stroke: colorOf(segment, index),
                  strokeWidth: 26,
                  strokeDasharray: `${round2(Math.max(0, segment.share * circumference - 2))} ${round2(circumference)}`,
                  strokeDashoffset: round2(-segment.offset * circumference),
                  transform: 'rotate(-90 100 100)',
                  'aria-label': `${labelOf(segment)} ${t('models.share', { percent: formatShare(segment.share) })}`,
                  style: { opacity: active === null || active === index ? 1 : 0.35, transition: 'opacity .12s ease' },
                  onMouseEnter: (event) => {
                    setActive(index)
                    hover.show(event, { index, segment })
                  },
                  onMouseMove: (event) => hover.show(event, { index, segment }),
                }),
              ),
            ),
            h(
              'div',
              { className: 'us-donutCenter' },
              h('span', { className: 'us-donutValue' }, totalParts.unit.length > 0 ? `${totalParts.value}${totalParts.unit}` : totalParts.value),
              h('span', { className: 'us-donutLabel' }, t('unit.tokens')),
            ),
          ),
          h(
            'div',
            { className: 'us-modelList' },
            donut.segments.map((segment, index) =>
              h(
                'div',
                {
                  className: active === index ? 'us-modelRow us-modelRowActive' : 'us-modelRow',
                  key: `model-${index}`,
                  onMouseEnter: () => setActive(index),
                  onMouseLeave: () => setActive(null),
                },
                h('span', { className: 'us-dot', style: { background: colorOf(segment, index) } }),
                h(
                  'div',
                  { className: 'us-modelMain' },
                  h(
                    'div',
                    { className: 'us-modelTop' },
                    h('span', { className: 'us-modelName', title: labelOf(segment) }, labelOf(segment)),
                    h('span', { className: 'us-modelShare' }, t('models.share', { percent: formatShare(segment.share) })),
                  ),
                  h('span', { className: 'us-modelTokens' }, `${formatTokens(segment.tokens, chinese)} ${t('unit.tokens')}`),
                ),
              ),
            ),
          ),
          h(
            HoverCard,
            { tip: hover.tip },
            hover.tip === null
              ? null
              : [
                  h(
                    'div',
                    { className: 'us-tipRow', key: 'row' },
                    h('span', { className: 'us-tipDot', style: { background: colorOf(hover.tip.content.segment, hover.tip.content.index) } }),
                    h('span', { className: 'us-tipName' }, labelOf(hover.tip.content.segment)),
                    h(
                      'span',
                      { className: 'us-tipValue' },
                      `${formatTokens(hover.tip.content.segment.tokens, chinese)} ${t('unit.tokens')}`,
                    ),
                    h('span', { className: 'us-tipShare' }, t('models.share', { percent: formatShare(hover.tip.content.segment.share) })),
                  ),
                ],
          ),
        ),
        donut.total <= 0
          ? h('p', { className: 'us-note' }, t('empty.body'))
          : null,
      )
    }

    /** Full page. */
    function UsageStatsView(props) {
      // The slot turns `inject()`'s `hooks` map into `use<Name>` selector hooks.
      const useStats = typeof props.useStats === 'function' ? props.useStats : () => MISSING_STATS
      const useColorScheme = typeof props.useColorScheme === 'function' ? props.useColorScheme : () => MISSING_THEME
      const useLocale = typeof props.useLocale === 'function' ? props.useLocale : () => MISSING_LOCALE
      const actions = props.actions
      const t = typeof props.t === 'function' ? props.t : (key) => key
      const snapshot = useStats((value) => value)
      const themeSnapshot = useColorScheme((value) => value)
      const localeSnapshot = useLocale((value) => value)
      const scheme = themeSnapshot?.scheme === 'dark' ? 'dark' : 'light'
      const chinese = isChinese(localeSnapshot)
      const [rangeDays, setRangeDays] = React.useState(7)
      const stats = snapshot.stats
      const busy = snapshot.busy === true

      if (snapshot.status === 'loading') {
        return h(
          'div',
          { className: 'us-root', 'data-scheme': scheme },
          h('style', { 'data-plugin-css': `${PACKAGE}/UsageStats.module.css` }, CSS),
          h(PageHeader, { title: t('page.title'), scope: t('page.scope'), scopeHint: t('page.scopeHint') }),
          h('div', { className: 'us-skeleton', 'aria-busy': 'true' }),
          h('p', { className: 'us-note' }, t('loading')),
        )
      }

      // Only a first load without data gets the full-page error state; a failed
      // refresh keeps the numbers already on screen and shows a banner instead.
      if (stats === null) {
        return h(
          'div',
          { className: 'us-root', 'data-scheme': scheme },
          h('style', { 'data-plugin-css': `${PACKAGE}/UsageStats.module.css` }, CSS),
          h(PageHeader, { title: t('page.title'), scope: t('page.scope'), scopeHint: t('page.scopeHint') }),
          h(
            'section',
            { className: 'us-card us-state' },
            h('h3', { className: 'us-stateTitle' }, t('error.title')),
            h('p', { className: 'us-stateBody' }, snapshot.error ?? t('error.body')),
            h(
              'button',
              { type: 'button', className: 'us-refresh', onClick: () => actions.refresh() },
              h('span', { className: 'us-refreshIcon' }, h(RefreshIcon)),
              h('span', null, t('refresh')),
            ),
          ),
        )
      }

      const totals = stats.totals
      /** One token metric in the shared number/unit shape. */
      const tokenItem = (key, label, tokens, title) => {
        const parts = formatTokenParts(tokens, chinese)
        return { key, label, title, parts: [parts] }
      }
      // Three metrics: the two token totals plus the longest chat.
      const statItems = [
        tokenItem('total', t('stats.total'), totals.tokens, t('stats.total')),
        tokenItem('peak', t('stats.peak'), totals.peakTokens, t('stats.peakHint')),
        {
          key: 'longestChat',
          label: t('stats.longestChat'),
          title: t('stats.longestChatHint'),
          parts: formatDurationParts(totals.longestChatMs, t),
        },
      ]

      const empty = totals.tokens <= 0

      return h(
        'div',
        { className: 'us-root', 'data-scheme': scheme },
        h('style', { 'data-plugin-css': `${PACKAGE}/UsageStats.module.css` }, CSS),
        h(PageHeader, { title: t('page.title'), scope: t('page.scope'), scopeHint: t('page.scopeHint') }),
        snapshot.status === 'error'
          ? h(
              'div',
              { className: 'us-alert', role: 'status' },
              h('span', { className: 'us-alertText' }, t('error.refreshFailed', { message: snapshot.error ?? t('error.body') })),
              h(
                'button',
                { type: 'button', className: 'us-alertAction', onClick: () => actions.refresh() },
                t('refresh'),
              ),
            )
          : null,
        h(StatRow, { items: statItems }),
        empty
          ? h(
              'section',
              { className: 'us-card us-state' },
              h('h3', { className: 'us-stateTitle' }, t('empty.title')),
              h('p', { className: 'us-stateBody' }, t('empty.body')),
            )
          : h(TokenActivityCard, { stats, chinese, t }),
        h(
          'div',
          { className: 'us-range' },
          h('span', { className: 'us-rangeLabel' }, t('range.label')),
          h(Segmented, {
            label: t('range.label'),
            value: rangeDays,
            onChange: setRangeDays,
            options: RANGE_CHOICES.map((value) => ({ value, label: t(`range.${value}`) })),
          }),
        ),
        empty ? null : h(TrendCard, { stats, windowDays: rangeDays + 1, chinese, t, scheme }),
        h(ModelUsageCard, { stats, chinese, t, scheme }),
        h(
          'div',
          { className: 'us-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'us-refresh',
              disabled: busy,
              'aria-busy': busy ? 'true' : 'false',
              onClick: () => actions.refresh(),
            },
            h('span', { className: 'us-refreshIcon', 'data-busy': busy ? 'true' : 'false' }, h(RefreshIcon)),
            h('span', null, busy ? t('refreshing') : t('refresh')),
          ),
        ),
        h(
          'p',
          { className: 'us-note' },
          [
            t('sessions', { count: stats.sessions.counted }),
            stats.sessions.skipped > 0 ? t('skipped', { count: stats.sessions.skipped }) : null,
            stats.sessions.truncated === true ? t('truncated', { count: stats.sessions.counted }) : null,
            t('page.source'),
          ]
            .filter((part) => part !== null)
            .join(' · '),
        ),
      )
    }

    /** Keeps one rendering failure inside this section instead of blanking the panel. */
    class SectionBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
        this.retry = this.retry.bind(this)
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        console.error('[usage-stats] section crashed', error)
      }

      retry() {
        this.setState({ failed: false })
      }

      render() {
        if (!this.state.failed) return this.props.children
        const t = typeof this.props.t === 'function' ? this.props.t : (key) => key
        return h(
          'div',
          { className: 'us-root' },
          h('style', { 'data-plugin-css': `${PACKAGE}/UsageStats.module.css` }, CSS),
          h(
            'section',
            { className: 'us-card us-state' },
            h('h3', { className: 'us-stateTitle' }, t('boundary.title')),
            h(
              'button',
              { type: 'button', className: 'us-refresh', onClick: this.retry },
              h('span', { className: 'us-refreshIcon' }, h(RefreshIcon)),
              h('span', null, t('boundary.retry')),
            ),
          ),
        )
      }
    }

    function UsageStatsSection(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key
      return h(SectionBoundary, { t }, h(UsageStatsView, { ...props, t }))
    }

    const inject = ['slots', 'locale', 'remote', 'typert']

    function apply(ctx) {
      const store = createSnapshotStore({ status: 'loading', stats: null, error: null, busy: false })
      const themeStore = createSnapshotStore({ scheme: readScheme(ctx) })

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'usage-stats: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.effect(
        () =>
          ctx.on('theme/change', () => {
            themeStore.set({ scheme: readScheme(ctx) })
          }),
        'usage-stats: theme',
      )

      async function callRemote(request) {
        const remote = ctx.get('remote.usageStats')
        if (remote === undefined || typeof remote.command !== 'function') {
          return { ok: false, error: { message: t('error.body') } }
        }
        // A Host request that never settles must not leave the page busy forever.
        let timer
        const watchdog = new Promise((resolve) => {
          timer = setTimeout(() => resolve({ ok: false, error: { message: t('error.body') } }), 60_000)
        })
        try {
          return await Promise.race([remote.command(request), watchdog])
        } catch (error) {
          return { ok: false, error: { message: error instanceof Error ? error.message : String(error) } }
        } finally {
          clearTimeout(timer)
        }
      }

      async function load(force) {
        const current = store.getSnapshot()
        store.set({
          status: current.stats === null ? 'loading' : current.status,
          stats: current.stats,
          error: null,
          busy: true,
        })
        const result = await callRemote(force ? { action: 'refresh' } : { action: 'getStats' })
        if (!result.ok) {
          store.set({ status: 'error', stats: current.stats, error: result.error?.message ?? t('error.body'), busy: false })
          return
        }
        const payload = result.value
        if (payload?.error !== undefined) {
          store.set({ status: 'error', stats: current.stats, error: payload.error?.message ?? t('error.body'), busy: false })
          return
        }
        store.set({ status: 'ready', stats: payload?.stats ?? null, error: null, busy: false })
      }

      const actions = {
        refresh: () => load(true),
      }

      const descriptor = {
        id: `${PACKAGE}#${REMOTE_NAMESPACE}/command`,
        namespace: REMOTE_NAMESPACE,
        method: 'command',
        service: REMOTE_NAMESPACE,
        description: 'Usage statistics over stored Session logs.',
        invocation: { kind: 'direct' },
        parameters: [
          {
            name: 'request',
            wire: 'request',
            source: 'json',
            description: 'The action and its payload.',
            codec: {
              mode: 'strict',
              typeSymbol: 'dsh-usage-stats#UsageStatsCommandRequest',
              create: () => ({}),
            },
          },
        ],
        result: {
          mode: 'strict',
          typeSymbol: 'dsh-usage-stats#UsageStatsCommandResult',
          create: () => ({}),
        },
      }

      ctx.effect(() => {
        let cancelled = false
        ctx.remote
          .$mount({ package: PACKAGE, descriptors: [descriptor] })
          .then(() => {
            if (cancelled) return
            return load(false)
          })
          .catch((error) => {
            if (cancelled) return
            store.set({
              status: 'error',
              stats: null,
              error: error instanceof Error ? error.message : String(error),
              busy: false,
            })
          })
        return () => {
          cancelled = true
        }
      }, 'usage-stats: remote mount')

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: SECTION_ID,
            order: SECTION_ORDER,
            label: () => t('nav'),
            locale: NS,
            inject: () => ({
              actions,
              hooks: { stats: store, colorScheme: themeStore, locale: ctx.locale },
            }),
          },
          UsageStatsSection,
        ),
      )
    }

    /** Current color scheme, tolerating a missing theme service. */
    function readScheme(ctx) {
      try {
        const theme = ctx.get('theme')
        const snapshot = theme?.getTheme?.()
        const scheme = snapshot?.active?.colorScheme
        return scheme === 'dark' ? 'dark' : 'light'
      } catch {
        return 'light'
      }
    }

    return {
      inject,
      apply,
      __test: {
        CSS,
        UsageStatsView,
        TokenActivityCard,
        TrendCard,
        ModelUsageCard,
        buildHeatmap,
        buildTrend,
        donutSegments,
        formatDayLabel,
        formatDurationParts,
        formatLongDayLabel,
        formatShare,
        formatTokenParts,
        formatTokens,
        nearestIndex,
        clampTipX,
        heatmapWeeks,
        HEATMAP_CELL,
        HEATMAP_GAP,
        HEATMAP_WEEKS,
        HEATMAP_MIN_WEEKS,
        dailyByDay,
        smoothPath,
        paletteColor,
        dayKeyOf,
        shiftDayKey,
        trimDecimal,
        PALETTE,
        RANGE_CHOICES,
        SECTION_ORDER,
        DAY_MS,
      },
    }
  },
})
