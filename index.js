/**
 * Host half of the usage-statistics bundle.
 *
 * Reads the profile's stored Session logs (read-only), folds every
 * `assistant/message` token usage into per-day/per-model buckets, and publishes
 * one small owner-only Remote that the Settings page calls.
 *
 * Node builtins are the only imports: a profile-installed bundle is linked from
 * this checkout and cannot resolve dsh's own packages. Session data therefore
 * arrives through the live `sessionPersistence` / `sessionQuery` services.
 *
 * Responsibilities:
 * - incremental scans keyed by the persistence `revision` (the documented
 *   change token for derived read-model caches);
 * - a durable per-session fold cache under `<profile>/plugin-state` that keeps
 *   the history of Sessions which are no longer stored;
 * - aggregation into the wire snapshot the Client renders.
 */
import { readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE = 'dsh-usage-stats'
const SERVICE = 'usageStats'
const INVOCATION_ID = `${PACKAGE}#${SERVICE}/command`
const CACHE_FILE = 'usage-stats-cache.json'
const CACHE_VERSION = 3
/** Versions that can be read and migrated forward without a full re-read. */
const CACHE_COMPATIBLE_VERSIONS = new Set([2, 3])
const DAY_MS = 86_400_000
const READ_CONCURRENCY = 4
const SCAN_DEADLINE_MS = 120_000
/** A Session whose read failed is not retried for this long. */
const FAILED_RETRY_MS = 300_000
const WARMUP_DELAY_MS = 5_000
/** Days of per-day detail sent to the Client; the heatmap needs 53 weeks. */
const DAILY_WINDOW_DAYS = 400
/** Hard stop for absurd corpora; the fold stays bounded. */
const MAX_SESSIONS = 20_000
const UNKNOWN_MODEL = 'unknown'

/** Whether a value is a plain JSON object. */
function isPlainObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Human-readable message for an unknown thrown value. */
function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Finite number or undefined. */
function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

/** Local calendar day key (`YYYY-MM-DD`) for one epoch-ms timestamp. */
function localDayKey(time) {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Epoch-day ordinal for a `YYYY-MM-DD` key, used for window arithmetic. */
function dayOrdinal(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (match === null) return Number.NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS
}

/** Token count of one `TokenUsage`, preferring the reported total. */
function usageTokens(usage) {
  if (!isPlainObject(usage)) return 0
  const total = usage.totalTokens
  if (Number.isFinite(total) && total > 0) return Math.round(total)
  const input = Number.isFinite(usage.inputTokens) ? Math.max(0, usage.inputTokens) : 0
  const output = Number.isFinite(usage.outputTokens) ? Math.max(0, usage.outputTokens) : 0
  return Math.round(input + output)
}

/** Display identity of the model behind one assistant message. */
function modelKeyOf(data) {
  const source = data?.message?.source
  const model = typeof source?.model === 'string' ? source.model.trim() : ''
  if (model.length > 0) return model
  const provider = typeof source?.provider === 'string' ? source.provider.trim() : ''
  return provider.length > 0 ? provider : UNKNOWN_MODEL
}

/**
 * Fold one Session log into a cache entry.
 *
 * `inheritedEventCount` marks a forked Session's shared prefix: those events
 * were already counted for the parent, so they are skipped.
 *
 * @param {{id?: string, createdAt?: number}} header
 * @param {readonly unknown[]} events
 * @param {number} inheritedEventCount
 * @returns {{createdAt: number|null, start: number|null, end: number|null, activeMs: number, tokens: number, day: Record<string, Record<string, number>>, dayTurns: Record<string, number>}}
 */
function foldSession(header, events, inheritedEventCount) {
  const day = {}
  const dayTurns = {}
  let tokens = 0
  let start = finiteOr(header?.createdAt, null)
  let end = start
  let activeMs = 0
  const openTurns = new Map()

  for (const event of Array.isArray(events) ? events : []) {
    if (!isPlainObject(event)) continue
    const seq = finiteOr(event.seq, 0)
    if (inheritedEventCount > 0 && seq < inheritedEventCount) continue
    const time = finiteOr(event.time, null)
    if (time !== null) {
      if (start === null || time < start) start = time
      if (end === null || time > end) end = time
    }
    if (event.type === 'turn/start') {
      const turn = event?.data?.turn
      if (Number.isFinite(turn) && time !== null) {
        openTurns.set(turn, time)
        // A turn counts on the calendar day it started, even if it ends after midnight.
        const turnDay = localDayKey(time)
        dayTurns[turnDay] = (dayTurns[turnDay] ?? 0) + 1
      }
      continue
    }
    if (event.type === 'turn/end') {
      const turn = event?.data?.turn
      if (!Number.isFinite(turn) || time === null) continue
      const began = openTurns.get(turn)
      if (began === undefined) continue
      openTurns.delete(turn)
      if (time > began) activeMs += time - began
      continue
    }
    if (event.type !== 'assistant/message') continue
    const count = usageTokens(event?.data?.usage)
    if (count <= 0 || time === null) continue
    const model = modelKeyOf(event.data)
    const key = localDayKey(time)
    const bucket = day[key] ?? (day[key] = {})
    bucket[model] = (bucket[model] ?? 0) + count
    tokens += count
  }

  return { createdAt: finiteOr(header?.createdAt, null), start, end, activeMs, tokens, day, dayTurns }
}

/** Validate one stored cache entry, dropping anything malformed. */
function normalizeCacheEntry(raw) {
  if (!isPlainObject(raw)) return undefined
  const day = {}
  if (isPlainObject(raw.day)) {
    for (const [key, models] of Object.entries(raw.day)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !isPlainObject(models)) continue
      const bucket = {}
      for (const [model, count] of Object.entries(models)) {
        if (typeof model !== 'string' || model.length === 0) continue
        if (!Number.isFinite(count) || count <= 0) continue
        bucket[model] = count
      }
      if (Object.keys(bucket).length > 0) day[key] = bucket
    }
  }
  const dayTurns = {}
  if (isPlainObject(raw.dayTurns)) {
    for (const [key, count] of Object.entries(raw.dayTurns)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
      if (!Number.isInteger(count) || count <= 0) continue
      dayTurns[key] = count
    }
  }
  return {
    revision: typeof raw.revision === 'string' ? raw.revision : '',
    sizeBytes: finiteOr(raw.sizeBytes, null),
    createdAt: finiteOr(raw.createdAt, null),
    start: finiteOr(raw.start, null),
    end: finiteOr(raw.end, null),
    activeMs: finiteOr(raw.activeMs, 0),
    tokens: finiteOr(raw.tokens, 0),
    day,
    dayTurns,
    // Set once the Session leaves persistence; the fold still counts as history.
    retiredAt: Number.isFinite(raw.retiredAt) && raw.retiredAt > 0 ? raw.retiredAt : null,
  }
}

/** Validate a stored cache document, falling back to an empty cache. */
function normalizeCache(raw) {
  const empty = { version: CACHE_VERSION, generatedAt: 0, sessions: {} }
  if (!isPlainObject(raw) || !CACHE_COMPATIBLE_VERSIONS.has(raw.version)) return empty
  const sessions = {}
  if (isPlainObject(raw.sessions)) {
    for (const [id, entry] of Object.entries(raw.sessions)) {
      if (id.length === 0) continue
      const normalized = normalizeCacheEntry(entry)
      if (normalized !== undefined) sessions[id] = normalized
    }
  }
  return { version: CACHE_VERSION, generatedAt: finiteOr(raw.generatedAt, 0), sessions }
}

/**
 * Aggregate folded entries into the wire snapshot.
 * @param {Record<string, object>} sessions cached entries keyed by Session id
 * @param {{today: string, skipped: number, total: number, truncated?: boolean}} meta
 */
function aggregateStats(sessions, meta) {
  const daily = new Map()
  const models = new Map()
  const turns = new Map()
  let tokens = 0
  let longestChatMs = 0
  let counted = 0
  let retired = 0

  for (const entry of Object.values(sessions)) {
    counted += 1
    if (entry.retiredAt !== null && entry.retiredAt !== undefined) retired += 1
    if (entry.activeMs > longestChatMs) longestChatMs = entry.activeMs
    for (const [key, count] of Object.entries(entry.dayTurns ?? {})) {
      if (!Number.isFinite(count) || count <= 0) continue
      turns.set(key, (turns.get(key) ?? 0) + count)
    }
    for (const [key, bucket] of Object.entries(entry.day)) {
      let dayBucket = daily.get(key)
      if (dayBucket === undefined) {
        dayBucket = new Map()
        daily.set(key, dayBucket)
      }
      for (const [model, count] of Object.entries(bucket)) {
        dayBucket.set(model, (dayBucket.get(model) ?? 0) + count)
        models.set(model, (models.get(model) ?? 0) + count)
        tokens += count
      }
    }
  }

  const dayKeys = [...daily.keys()].sort()
  const today = meta.today
  const todayOrdinal = dayOrdinal(today)
  const windowStart = Number.isFinite(todayOrdinal) ? todayOrdinal - DAILY_WINDOW_DAYS : Number.NEGATIVE_INFINITY

  let peakDay = null
  let peakTokens = 0
  const dailyWindow = []
  for (const key of dayKeys) {
    const bucket = daily.get(key)
    let dayTokens = 0
    for (const count of bucket.values()) dayTokens += count
    if (dayTokens > peakTokens) {
      peakTokens = dayTokens
      peakDay = key
    }
    if (dayOrdinal(key) >= windowStart) {
      dailyWindow.push({
        day: key,
        tokens: dayTokens,
        turns: turns.get(key) ?? 0,
        models: Object.fromEntries(bucket),
      })
    }
  }

  const modelTotals = [...models.entries()]
    .map(([model, count]) => ({ model, tokens: count }))
    .sort((left, right) => right.tokens - left.tokens)

  return {
    generatedAt: Date.now(),
    today,
    sessions: {
      total: meta.total,
      counted,
      skipped: meta.skipped,
      // Sessions counted from a retained fold; they are no longer listed.
      retired,
      truncated: meta.truncated === true,
    },
    totals: {
      tokens,
      peakDay,
      peakTokens,
      longestChatMs,
      activeDays: dayKeys.length,
      firstDay: dayKeys.length > 0 ? dayKeys[0] : null,
      lastDay: dayKeys.length > 0 ? dayKeys[dayKeys.length - 1] : null,
    },
    daily: dailyWindow,
    models: modelTotals,
  }
}

/** Run `run` over `items` with at most `limit` concurrent calls. */
async function mapLimit(items, limit, run) {
  const results = new Array(items.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await run(items[index], index)
    }
  }
  const workers = []
  for (let index = 0; index < Math.min(limit, items.length); index += 1) workers.push(worker())
  await Promise.all(workers)
  return results
}

/** Whether a folded entry still contributes to any aggregate. */
function contributes(entry) {
  if (entry.tokens > 0 || entry.activeMs > 0) return true
  return Object.keys(entry.day ?? {}).length > 0 || Object.keys(entry.dayTurns ?? {}).length > 0
}

/** Resolve the directory that owns plugin-owned durable state. */
function stateDirectory(ctx) {
  const configured = process.env.DSH_PROFILE_DIR
  if (typeof configured === 'string' && configured.length > 0) return configured
  const baseUrl = ctx.baseUrl
  if (typeof baseUrl === 'string' && baseUrl.length > 0) {
    try {
      const candidate = dirname(baseUrl.startsWith('file:') ? fileURLToPath(baseUrl) : baseUrl)
      // A linked bundle reports its own package path; never write state there.
      if (!isPluginOwnDirectory(candidate)) return candidate
    } catch {
      /* fall through to the working directory */
    }
  }
  return process.cwd()
}

/** Whether a directory is this plugin's own package root, not a profile root. */
function isPluginOwnDirectory(path) {
  try {
    const manifest = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'))
    return manifest?.name === PACKAGE
  } catch {
    return false
  }
}

/**
 * Register the Host half. The plugin is inactive without the Typert registry,
 * which publishes the Remote the Settings page calls.
 */
export const inject = ['typert']

/** @param {any} ctx Cordis plugin context. */
export function apply(ctx) {
  const logger = ctx.get('logger')
  const stateDir = join(stateDirectory(ctx), 'plugin-state')
  const cacheFile = join(stateDir, CACHE_FILE)

  let cache = { version: CACHE_VERSION, generatedAt: 0, sessions: {} }
  let disposed = false
  let inFlight = null
  let warmupTimer = null
  /** Session id → timestamp of the last failed read, so it is not retried every scan. */
  const failedSessions = new Map()
  /** Controller of the scan in progress, aborted when the plugin unloads. */
  let scanAbort = null
  let resolveReady = () => {}
  const ready = new Promise((resolvePromise) => {
    resolveReady = resolvePromise
  })

  /** Read the durable fold cache, falling back to an empty one. */
  async function loadCache() {
    try {
      const text = await readFile(cacheFile, 'utf8')
      cache = normalizeCache(JSON.parse(text))
    } catch (error) {
      if (error?.code !== 'ENOENT') logger?.warn?.('usage-stats: cache read failed', error)
      cache = normalizeCache(undefined)
    } finally {
      resolveReady()
    }
  }

  /** Persist the fold cache atomically. */
  async function persistCache() {
    await mkdir(stateDir, { recursive: true })
    const temporary = `${cacheFile}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temporary, `${JSON.stringify(cache)}\n`, 'utf8')
    await rename(temporary, cacheFile)
  }

  /** The live persistence listing, or undefined when the service is missing. */
  async function listSnapshots(signal) {
    const persistence = ctx.get('sessionPersistence')
    if (persistence === undefined || typeof persistence.list !== 'function') return undefined
    const snapshots = await persistence.list({ signal })
    return Array.isArray(snapshots) ? snapshots : []
  }

  /** Read one Session's events, preferring the query service. */
  async function readSessionEvents(id) {
    const query = ctx.get('sessionQuery')
    if (query !== undefined && typeof query.readSession === 'function') {
      const snapshot = await query.readSession(id)
      return {
        header: snapshot?.session ?? null,
        events: Array.isArray(snapshot?.events) ? snapshot.events : [],
        inheritedEventCount: finiteOr(snapshot?.inheritedEventCount, 0),
      }
    }
    const persistence = ctx.get('sessionPersistence')
    if (persistence === undefined || typeof persistence.open !== 'function') {
      throw new Error('session storage is unavailable')
    }
    const handle = await persistence.open(id, 'read')
    try {
      const result = await handle.read()
      return {
        header: handle?.header ?? null,
        events: Array.isArray(result?.events) ? result.events : [],
        inheritedEventCount: finiteOr(handle?.inheritedEventCount, 0),
      }
    } finally {
      try {
        await handle?.close?.()
      } catch {
        /* the handle is already settling */
      }
    }
  }

  /** Whether a cached entry still describes the stored Session. */
  function cacheHit(cached, revision, sizeBytes) {
    if (cached === undefined) return false
    if (cached.revision !== revision) return false
    return sizeBytes === null || cached.sizeBytes === null || cached.sizeBytes === sizeBytes
  }

  /**
   * Scan every stored Session, re-reading only what changed, then aggregate.
   *
   * A Session that leaves the persistence listing (deleted, moved, or briefly
   * unavailable) keeps its folded entry: the usage ledger must not shrink when
   * the conversation it came from disappears.
   * @param {boolean} force re-read unchanged Sessions too
   */
  async function scan(force) {
    const controller = new AbortController()
    scanAbort = controller
    const deadline = setTimeout(() => controller.abort(), SCAN_DEADLINE_MS)
    if (typeof deadline.unref === 'function') deadline.unref()
    try {
      const snapshots = await listSnapshots(controller.signal)
      if (snapshots === undefined) {
        return { error: { code: 'stats-unavailable', message: 'Session storage is unavailable' } }
      }

      // The complete listing, even past MAX_SESSIONS: an entry that is still
      // stored must never be mistaken for a removed one.
      const listed = new Map()
      for (const snapshot of snapshots) {
        const id = typeof snapshot?.header?.id === 'string' ? snapshot.header.id : ''
        if (id.length === 0) continue
        listed.set(id, snapshot)
      }
      const total = listed.size
      const truncated = total > MAX_SESSIONS
      if (truncated) {
        logger?.warn?.(`usage-stats: ${total} sessions exceed the ${MAX_SESSIONS} cap; only the first are counted`)
      }

      const now = Date.now()
      const next = {}
      const pending = []
      let skipped = 0
      let dirty = false

      /** Reuse a cached fold for a Session that is listed again. */
      const revive = (entry) => {
        if (entry.retiredAt === null || entry.retiredAt === undefined) return entry
        dirty = true
        return { ...entry, retiredAt: null }
      }

      // Keep the history of Sessions that are no longer stored. Dropping them
      // here is what made the totals shrink after a delete.
      for (const [id, entry] of Object.entries(cache.sessions)) {
        if (listed.has(id)) continue
        if (!contributes(entry)) {
          dirty = true
          continue
        }
        if (entry.retiredAt === null || entry.retiredAt === undefined) {
          next[id] = { ...entry, retiredAt: now }
          dirty = true
        } else {
          next[id] = entry
        }
      }

      let processed = 0
      for (const [id, snapshot] of listed) {
        const cached = cache.sessions[id]
        if (processed >= MAX_SESSIONS) {
          // Over the cap: keep whatever history exists, but read no more.
          if (cached !== undefined) next[id] = revive(cached)
          continue
        }
        processed += 1
        if (snapshot.formatStatus === 'migration-required') {
          // The last readable fold is still the best available number.
          if (cached !== undefined) next[id] = revive(cached)
          else skipped += 1
          continue
        }
        const revision = typeof snapshot.revision === 'string' ? snapshot.revision : ''
        const sizeBytes = Number.isFinite(snapshot.sizeBytes) ? snapshot.sizeBytes : null
        if (!force && cacheHit(cached, revision, sizeBytes)) {
          next[id] = revive(cached)
          continue
        }
        // A session that just failed is not retried on every scan; that kept
        // re-reading the same broken log and re-logging the same warning.
        const failedAt = failedSessions.get(id)
        if (!force && failedAt !== undefined && now - failedAt < FAILED_RETRY_MS) {
          if (cached !== undefined) next[id] = revive(cached)
          else skipped += 1
          continue
        }
        pending.push({ id, revision, sizeBytes, cached })
      }

      const folded = await mapLimit(pending, READ_CONCURRENCY, async (item) => {
        if (controller.signal.aborted) return { id: item.id, aborted: true, cached: item.cached }
        try {
          const read = await readSessionEvents(item.id)
          const header = read.header ?? { id: item.id }
          const entry = foldSession(header, read.events, read.inheritedEventCount)
          return {
            id: item.id,
            entry: { ...entry, revision: item.revision, sizeBytes: item.sizeBytes, retiredAt: null },
          }
        } catch (error) {
          logger?.warn?.('usage-stats: session read failed', { sessionId: item.id, error: messageOf(error) })
          return { id: item.id, failed: true, cached: item.cached }
        }
      })

      for (const result of folded) {
        if (result?.entry !== undefined) {
          next[result.id] = result.entry
          failedSessions.delete(result.id)
          dirty = true
          continue
        }
        // Aborted reads are retried next time; real failures back off. Either
        // way the previous fold is kept, so one failed read cannot shrink the
        // totals.
        if (result?.aborted !== true) failedSessions.set(result.id, Date.now())
        if (result?.cached !== undefined) next[result.id] = revive(result.cached)
        else skipped += 1
      }

      // Drop bookkeeping for Sessions that no longer exist.
      for (const id of [...failedSessions.keys()]) {
        if (!listed.has(id)) failedSessions.delete(id)
      }

      cache = { version: CACHE_VERSION, generatedAt: Date.now(), sessions: next }
      if (dirty) {
        try {
          await persistCache()
        } catch (error) {
          logger?.warn?.('usage-stats: cache write failed', error)
        }
      }

      const today = localDayKey(Date.now())
      return { stats: aggregateStats(next, { today, skipped, total, truncated }) }
    } catch (error) {
      logger?.warn?.('usage-stats: scan failed', error)
      return { error: { code: 'scan-failed', message: messageOf(error) } }
    } finally {
      clearTimeout(deadline)
      if (scanAbort === controller) scanAbort = null
    }
  }

  /** Coalesce concurrent callers onto one scan. */
  function getStats(force) {
    if (inFlight !== null) return inFlight
    const run = scan(force === true).finally(() => {
      inFlight = null
    })
    inFlight = run
    return run
  }

  /** Dispatch one validated Remote request. */
  async function command(request) {
    await ready
    if (!isPlainObject(request)) return { error: { code: 'bad-request', message: 'request must be an object' } }
    switch (request.action) {
      case 'getStats':
        return getStats(request.force === true)
      case 'refresh':
        return getStats(true)
      default:
        return { error: { code: 'bad-request', message: `unknown action ${JSON.stringify(request.action)}` } }
    }
  }

  // Publish the service together with its Gateway binding before anything can call it.
  const service = { command: (request) => command(request) }
  Object.defineProperty(service, 'typertRemote', {
    enumerable: false,
    configurable: false,
    value: Object.freeze({ service, serviceKey: SERVICE, namespace: SERVICE }),
  })
  try {
    ctx.provide(SERVICE, service)
  } catch (error) {
    logger?.error?.('usage-stats: could not publish the usageStats service', error)
    return
  }

  const typert = ctx.get('typert')
  if (typert === undefined || typeof typert.register !== 'function') {
    logger?.error?.('usage-stats: the Typert registry is unavailable; the Settings page cannot load')
  } else {
    try {
      typert.register({
        package: PACKAGE,
        face: 'host',
        schemas: [],
        invocations: [
          {
            id: INVOCATION_ID,
            service: SERVICE,
            namespace: SERVICE,
            method: 'command',
            description:
              'Usage statistics over stored Session logs: token totals, activity per day, chat duration, and model share.',
            invocation: { kind: 'direct' },
            parameters: [
              {
                name: 'request',
                wire: 'request',
                source: 'json',
                description: 'The action and its payload.',
                codec: { mode: 'src-json' },
              },
            ],
            result: { mode: 'src-json' },
          },
        ],
        model: { services: [], events: [], objects: [] },
      })
    } catch (error) {
      logger?.error?.('usage-stats: Typert invocation registration failed', error)
    }
  }

  ctx.effect(
    () => () => {
      disposed = true
      if (warmupTimer !== null) {
        clearTimeout(warmupTimer)
        warmupTimer = null
      }
      // Stop a scan that is still walking session logs.
      scanAbort?.abort()
      scanAbort = null
    },
    'usage-stats: lifecycle',
  )

  void loadCache().then(() => {
    if (disposed) return
    // Warm the fold so the first Settings visit is already a cache hit.
    warmupTimer = setTimeout(() => {
      warmupTimer = null
      if (disposed) return
      void getStats(false)
    }, WARMUP_DELAY_MS)
    if (typeof warmupTimer.unref === 'function') warmupTimer.unref()
  })
}

export { CACHE_VERSION, DAY_MS, foldSession, localDayKey, normalizeCache, usageTokens, aggregateStats }
