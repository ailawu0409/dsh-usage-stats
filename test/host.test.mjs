import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  aggregateStats,
  apply,
  CACHE_VERSION,
  foldSession,
  localDayKey,
  normalizeCache,
  usageTokens,
} from '../index.js'

const silentLogger = { info() {}, warn() {}, error() {} }

/** Local-time epoch for one calendar day. */
function day(year, month, date, hour = 10) {
  return new Date(year, month - 1, date, hour, 0, 0, 0).getTime()
}

function usageEvent(seq, time, model, usage) {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: { message: { role: 'assistant', source: { kind: 'model', provider: 'gateway', model } }, usage },
  }
}

function turnStart(seq, time, turn) {
  return { type: 'turn/start', seq, time, data: { turn } }
}

function turnEnd(seq, time, turn) {
  return { type: 'turn/end', seq, time, data: { turn } }
}

/** One stored Session: snapshot + the events its read returns. */
function storedSession(id, createdAt, events, extra = {}) {
  const inheritedEventCount = extra.inheritedEventCount ?? 0
  return {
    snapshot: {
      header: { id, version: 4, createdAt, isSeeded: false },
      revision: extra.revision ?? `rev-${id}`,
      sizeBytes: extra.sizeBytes ?? 1000,
      eventCount: events.length,
      formatStatus: extra.formatStatus,
    },
    read: {
      session: { id, version: 4, createdAt, isSeeded: false },
      inheritedEventCount,
      events,
    },
    fail: extra.fail === true,
  }
}

/** Boot the Host half against fake services. */
function boot(sessions, options = {}) {
  const provided = new Map()
  const registered = []
  const cleanups = []
  const reads = []
  const snapshots = sessions.map((entry) => entry.snapshot)
  const byId = new Map(sessions.map((entry) => [entry.snapshot.header.id, entry]))

  const ctx = {
    baseUrl: options.stateDir,
    get(name) {
      switch (name) {
        case 'logger':
          return silentLogger
        case 'typert':
          return {
            register(manifest) {
              registered.push(manifest)
              return () => {}
            },
          }
        case 'sessionPersistence':
          return {
            async list() {
              if (options.listFails === true) throw new Error('list failed')
              return snapshots
            },
            async open(id) {
              const entry = byId.get(id)
              if (entry === undefined) throw new Error(`missing ${id}`)
              return {
                header: entry.read.session,
                inheritedEventCount: entry.read.inheritedEventCount,
                async read() {
                  return { events: entry.read.events }
                },
                async close() {},
              }
            },
          }
        case 'sessionQuery':
          return {
            async readSession(id) {
              reads.push(id)
              const entry = byId.get(id)
              if (entry === undefined) throw new Error(`missing ${id}`)
              if (entry.fail) throw new Error(`unreadable ${id}`)
              return entry.read
            },
          }
        default:
          return undefined
      }
    },
    provide(name, value) {
      provided.set(name, value)
      return () => {}
    },
    effect(callback) {
      const cleanup = callback()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
      return () => {}
    },
  }

  const previous = process.env.DSH_PROFILE_DIR
  process.env.DSH_PROFILE_DIR = options.stateDir
  apply(ctx)
  return {
    service: provided.get('usageStats'),
    registered,
    reads,
    restore() {
      for (const cleanup of cleanups) {
        try {
          cleanup()
        } catch {
          /* already disposed */
        }
      }
      if (previous === undefined) delete process.env.DSH_PROFILE_DIR
      else process.env.DSH_PROFILE_DIR = previous
    },
  }
}

async function withStateDir(run) {
  const dir = await mkdtemp(join(tmpdir(), 'usage-stats-test-'))
  try {
    return await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Sessions shared by the integration cases. */
function corpus() {
  const first = day(2026, 11, 1)
  const second = day(2026, 11, 2)
  return [
    storedSession('session-a', first - 5000, [
      turnStart(0, first, 1),
      usageEvent(1, first + 1000, 'group/m1', { inputTokens: 80, outputTokens: 20, totalTokens: 100 }),
      // No totalTokens: the fold falls back to input + output.
      usageEvent(2, first + 2000, 'group/m2', { inputTokens: 30, outputTokens: 20 }),
      turnEnd(3, first + 61_000, 1),
    ]),
    storedSession('session-b', second, [
      usageEvent(0, second + 1000, 'group/m1', { inputTokens: 150, outputTokens: 50, totalTokens: 200 }),
    ]),
    // Forked session: the inherited prefix belongs to its parent and must not be
    // counted twice.
    storedSession(
      'session-c',
      second,
      [
        usageEvent(0, second, 'group/m1', { totalTokens: 999 }),
        usageEvent(1, second, 'group/m1', { totalTokens: 999 }),
        usageEvent(2, second, 'group/m1', { totalTokens: 999 }),
        usageEvent(3, second + 2000, 'group/m1', { totalTokens: 10 }),
      ],
      { inheritedEventCount: 3 },
    ),
    storedSession('session-d', second, [], { formatStatus: 'migration-required' }),
    storedSession('session-e', second, [], { fail: true }),
  ]
}

// --- pure helpers -----------------------------------------------------------

assert.equal(usageTokens({ totalTokens: 12, inputTokens: 99 }), 12)
assert.equal(usageTokens({ inputTokens: 30, outputTokens: 20 }), 50)
assert.equal(usageTokens({ inputTokens: -5, outputTokens: 20 }), 20)
assert.equal(usageTokens(undefined), 0)
assert.equal(usageTokens({ totalTokens: 0, inputTokens: 7, outputTokens: 3 }), 10)

const first = day(2026, 11, 1)
assert.equal(localDayKey(first), '2026-11-01')

{
  const folded = foldSession(
    { id: 'x', createdAt: first - 1000 },
    [
      turnStart(0, first, 1),
      usageEvent(1, first + 1000, 'group/m1', { totalTokens: 40 }),
      usageEvent(2, first + 2000, 'group/m2', { totalTokens: 60 }),
      turnEnd(3, first + 31_000, 1),
    ],
    0,
  )
  assert.equal(folded.tokens, 100)
  assert.equal(folded.activeMs, 31_000)
  assert.equal(folded.createdAt, first - 1000)
  assert.deepEqual(folded.day['2026-11-01'], { 'group/m1': 40, 'group/m2': 60 })
  assert.deepEqual(folded.dayTurns, { '2026-11-01': 1 }, 'one turn started that day')
}

{
  // A turn that starts before midnight counts on its start day, and a second
  // turn the next day adds to that day.
  const lateStart = new Date(2026, 10, 1, 23, 50, 0, 0).getTime()
  const afterMidnight = new Date(2026, 10, 2, 0, 20, 0, 0).getTime()
  const folded = foldSession(
    { id: 'z', createdAt: lateStart },
    [
      turnStart(0, lateStart, 1),
      usageEvent(1, lateStart + 1000, 'group/m1', { totalTokens: 10 }),
      turnEnd(2, afterMidnight, 1),
      turnStart(3, afterMidnight + 1000, 2),
      turnEnd(4, afterMidnight + 61_000, 2),
    ],
    0,
  )
  assert.deepEqual(
    folded.dayTurns,
    { '2026-11-01': 1, '2026-11-02': 1 },
    'a turn counts on its start day, not its end day',
  )
  assert.equal(folded.activeMs, 30 * 60_000 + 60_000)
}

{
  // Inherited events are skipped by seq.
  const folded = foldSession(
    { id: 'y', createdAt: first },
    [usageEvent(0, first, 'group/m1', { totalTokens: 500 }), usageEvent(5, first, 'group/m1', { totalTokens: 25 })],
    5,
  )
  assert.equal(folded.tokens, 25)
}

{
  // Streaks are no longer computed or shipped: the stat row shows three metrics.
  const aggregate = aggregateStats({ a: { activeMs: 0, day: { '2026-11-01': { m1: 1 } }, dayTurns: {} } }, { today: '2026-11-01', skipped: 0, total: 1 })
  assert.equal(Object.hasOwn(aggregate.totals, 'currentStreakDays'), false)
  assert.equal(Object.hasOwn(aggregate.totals, 'longestStreakDays'), false)
  assert.equal(aggregate.sessions.truncated, false)
}

{
  const aggregate = aggregateStats(
    {
      a: { activeMs: 5000, day: { '2026-11-01': { m1: 10 } }, dayTurns: { '2026-11-01': 2 } },
      b: { activeMs: 9000, day: { '2026-11-02': { m1: 5, m2: 30 } }, dayTurns: { '2026-11-02': 3 } },
    },
    { today: '2026-11-02', skipped: 1, total: 3 },
  )
  assert.equal(aggregate.totals.tokens, 45)
  assert.equal(aggregate.totals.peakDay, '2026-11-02')
  assert.equal(aggregate.totals.peakTokens, 35)
  assert.equal(aggregate.totals.longestChatMs, 9000)
  assert.equal(aggregate.totals.activeDays, 2)
  assert.deepEqual(aggregate.models, [
    { model: 'm2', tokens: 30 },
    { model: 'm1', tokens: 15 },
  ])
  assert.deepEqual(aggregate.sessions, { total: 3, counted: 2, skipped: 1, truncated: false })
  assert.equal(aggregate.daily.length, 2)
  assert.deepEqual(
    aggregate.daily.map((entry) => [entry.day, entry.turns]),
    [
      ['2026-11-01', 2],
      ['2026-11-02', 3],
    ],
    'daily entries carry the turn count',
  )
  // Entries written before turns existed still aggregate, with zero turns.
  const legacy = aggregateStats({ c: { activeMs: 0, day: { '2026-11-02': { m1: 1 } } } }, { today: '2026-11-02', skipped: 0, total: 1 })
  assert.equal(legacy.daily[0].turns, 0)
}

assert.equal(CACHE_VERSION, 2, 'the cache version changed when turns were added')

{
  const normalized = normalizeCache({
    version: CACHE_VERSION,
    generatedAt: 5,
    sessions: { a: { revision: 'r', day: { '2026-11-01': { m1: 3 } }, dayTurns: { '2026-11-01': 4 } } },
  })
  assert.equal(normalized.sessions.a.day['2026-11-01'].m1, 3)
  assert.deepEqual(normalized.sessions.a.dayTurns, { '2026-11-01': 4 })
  // Wrong version, junk entries, and junk days are dropped.
  assert.deepEqual(normalizeCache({ version: 99, sessions: { a: {} } }).sessions, {})
  assert.deepEqual(normalizeCache({ version: 1, sessions: { a: {} } }).sessions, {}, 'the old cache version is discarded')
  const junk = normalizeCache({
    version: CACHE_VERSION,
    sessions: {
      a: {
        revision: 'r',
        day: { nope: { m: 1 }, '2026-11-01': { m: -1 } },
        dayTurns: { nope: 2, '2026-11-01': 0, '2026-11-02': 1.5, '2026-11-03': 2 },
      },
    },
  })
  assert.deepEqual(junk.sessions.a.day, {})
  assert.deepEqual(junk.sessions.a.dayTurns, { '2026-11-03': 2 }, 'only whole positive turn counts survive')
  assert.deepEqual(normalizeCache(null).sessions, {})
}

// --- integration ------------------------------------------------------------

await withStateDir(async (stateDir) => {
  const host = boot(corpus(), { stateDir })
  try {
    assert.ok(host.service, 'the usageStats service is published')
    assert.equal(host.registered.length, 1, 'one Typert invocation is registered')
    assert.equal(host.registered[0].invocations[0].id, 'dsh-usage-stats#usageStats/command')

    const initial = await host.service.command({ action: 'getStats' })
    assert.equal(initial.error, undefined)
    const stats = initial.stats
    assert.equal(stats.totals.tokens, 360, 'inherited fork events are excluded')
    assert.equal(stats.totals.peakDay, '2026-11-02')
    assert.equal(stats.totals.peakTokens, 210)
    assert.equal(stats.totals.longestChatMs, 61_000)
    assert.equal(stats.totals.activeDays, 2)
    assert.deepEqual(stats.models, [
      { model: 'group/m1', tokens: 310 },
      { model: 'group/m2', tokens: 50 },
    ])
    assert.deepEqual(stats.sessions, { total: 5, counted: 3, skipped: 2, truncated: false })
    assert.equal(stats.daily.length, 2)
    assert.deepEqual(
      stats.daily.map((entry) => [entry.day, entry.turns]),
      [
        ['2026-11-01', 1],
        ['2026-11-02', 0],
      ],
      'the wire payload carries per-day turn counts',
    )
    // a, b, c and the failing e are attempted; d is skipped as migration-required.
    assert.equal(host.reads.length, 4, 'only current-format sessions are read')

    const cacheText = await readFile(join(stateDir, 'plugin-state', 'usage-stats-cache.json'), 'utf8')
    const cache = JSON.parse(cacheText)
    assert.equal(cache.version, CACHE_VERSION)
    assert.deepEqual(Object.keys(cache.sessions).sort(), ['session-a', 'session-b', 'session-c'])

    // Unchanged revisions are served from the cache, and the session that just
    // failed is not retried until its cooldown expires.
    const readableReads = () => host.reads.filter((id) => id !== 'session-e')
    const cached = await host.service.command({ action: 'getStats' })
    assert.equal(cached.stats.totals.tokens, 360)
    assert.deepEqual(readableReads(), ['session-a', 'session-b', 'session-c'], 'a repeat call re-reads nothing')
    assert.equal(host.reads.length, 4, 'the failed session is not retried inside the cooldown')
    assert.equal(cached.stats.sessions.skipped, 2, 'it still counts as skipped')

    // A changed revision re-reads exactly that session.
    const changed = corpus()
    changed[1].snapshot.revision = 'rev-changed'
    changed[1].read.events = [
      usageEvent(0, day(2026, 11, 2) + 1000, 'group/m1', { totalTokens: 300 }),
    ]
    const second = boot(changed, { stateDir })
    try {
      const result = await second.service.command({ action: 'getStats' })
      assert.equal(result.stats.totals.tokens, 460, 'the changed session is re-read and re-folded')
      assert.deepEqual(second.reads, ['session-b', 'session-e'], 'only the changed session is read again')
    } finally {
      second.restore()
    }

    // refresh forces a full re-read, bypassing both the cache and the failure cooldown.
    const refreshed = await host.service.command({ action: 'refresh' })
    assert.equal(refreshed.stats.totals.tokens, 360)
    assert.deepEqual(
      readableReads(),
      ['session-a', 'session-b', 'session-c', 'session-a', 'session-b', 'session-c'],
      'refresh re-reads every readable session',
    )
    assert.equal(host.reads.filter((id) => id === 'session-e').length, 2, 'refresh also retries the failed session')

    const unknown = await host.service.command({ action: 'nope' })
    assert.equal(unknown.error.code, 'bad-request')
    const malformed = await host.service.command('nope')
    assert.equal(malformed.error.code, 'bad-request')
  } finally {
    host.restore()
  }
})

// A cache left behind by a deleted session is pruned on the next scan.
await withStateDir(async (stateDir) => {
  await mkdir(join(stateDir, 'plugin-state'), { recursive: true })
  await writeFile(
    join(stateDir, 'plugin-state', 'usage-stats-cache.json'),
    JSON.stringify({
      version: CACHE_VERSION,
      generatedAt: 1,
      sessions: { ghost: { revision: 'r', day: { '2026-11-01': { m: 5 } }, dayTurns: { '2026-11-01': 1 }, tokens: 5 } },
    }),
    'utf8',
  )
  const host = boot(corpus(), { stateDir })
  try {
    const result = await host.service.command({ action: 'getStats' })
    assert.equal(result.stats.totals.tokens, 360, 'the ghost entry is not counted')
    const cache = JSON.parse(await readFile(join(stateDir, 'plugin-state', 'usage-stats-cache.json'), 'utf8'))
    assert.equal(cache.sessions.ghost, undefined, 'the ghost entry is pruned')
  } finally {
    host.restore()
  }
})

// A cache written by the previous cache version is discarded and rebuilt.
await withStateDir(async (stateDir) => {
  await mkdir(join(stateDir, 'plugin-state'), { recursive: true })
  await writeFile(
    join(stateDir, 'plugin-state', 'usage-stats-cache.json'),
    JSON.stringify({ version: 1, generatedAt: 1, sessions: { 'session-a': { revision: 'rev-session-a', tokens: 1 } } }),
    'utf8',
  )
  const host = boot(corpus(), { stateDir })
  try {
    const result = await host.service.command({ action: 'getStats' })
    assert.equal(result.stats.totals.tokens, 360, 'a stale cache version is ignored')
    assert.equal(host.reads.length, 4, 'every readable session is re-read once')
    const cache = JSON.parse(await readFile(join(stateDir, 'plugin-state', 'usage-stats-cache.json'), 'utf8'))
    assert.equal(cache.version, CACHE_VERSION)
    assert.ok(cache.sessions['session-a'].dayTurns !== undefined, 'the rebuilt cache carries turns')
  } finally {
    host.restore()
  }
})

// A corrupt cache is discarded instead of blocking the page.
await withStateDir(async (stateDir) => {
  await mkdir(join(stateDir, 'plugin-state'), { recursive: true })
  await writeFile(join(stateDir, 'plugin-state', 'usage-stats-cache.json'), '{not json', 'utf8')
  const host = boot(corpus(), { stateDir })
  try {
    const result = await host.service.command({ action: 'getStats' })
    assert.equal(result.stats.totals.tokens, 360)
  } finally {
    host.restore()
  }
})

// A failing listing is reported, not thrown.
await withStateDir(async (stateDir) => {
  const host = boot([], { stateDir, listFails: true })
  try {
    const result = await host.service.command({ action: 'getStats' })
    assert.equal(result.error.code, 'scan-failed')
  } finally {
    host.restore()
  }
})

console.log('host tests passed')
