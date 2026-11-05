# dsh-usage-stats · Usage Statistics

[中文文档](README.zh-CN.md) · [GitHub](https://github.com/ailawu0409/dsh-usage-stats) · [Releases](https://github.com/ailawu0409/dsh-usage-stats/releases) · [Issues](https://github.com/ailawu0409/dsh-usage-stats/issues)

[![CI](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml/badge.svg)](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A community plugin for DeepSeek Harness that adds a **Usage Statistics** section to Settings: token totals, activity, chat duration, and model share for local sessions.

> **Unofficial plugin:** Not affiliated with or endorsed by DeepSeek. DSH extension APIs may change between releases. This release targets DeepSeek Harness 0.2.2-rc.1.

## Features

- **Overview metrics (3)**: total tokens, peak tokens (single day), and longest chat duration.
- **Token activity heatmap**: GitHub-style weekly grid with Daily / Weekly / Cumulative color modes; hovering a cell shows the date, tokens, and turns (e.g. `Oct 27, 2026` / `506K tokens · 2 turns`).
  - Cells stay at the reference 11px; the number of weeks adapts to the panel width (up to 53, at least 13). The summary states the actual range, for example "Active 2 days over the last 8 months".
- **Daily token trend**: smoothed lines colored by model, with Last 7 days / Last 30 days ranges; hover shows a vertical cursor, highlighted points, and a per-model breakdown for that day.
- **Model usage**: donut chart plus a share list (top 5 models + Other); hovering a segment shows its tokens and share.
- Follows the host light/dark theme and official font, ships a bilingual Chinese/English UI, and provides a Refresh button in the bottom-right corner.
- The page header keeps only the title (host settings title scale, 16px); the settings navigation icon uses the plugin's own bar-chart glyph through the `settings.section.icon` slot introduced in DSH 0.2.2.
- A failed refresh keeps existing data and shows one retryable banner at the top.

## Data source and accounting

All data comes from **local session logs** (read-only; no network access and nothing is uploaded):

- Total tokens: sum of `usage` on every `assistant/message` (`totalTokens` when present, otherwise `inputTokens + outputTokens`).
- Peak tokens: highest single-day usage, using the local time zone calendar day.
- Longest chat: the maximum, within one session, of the summed `turn/start → turn/end` durations, so idle time across an overnight gap is not counted.
- Turns: counted on the **start day** of `turn/start`; a turn that crosses midnight counts on the day it started.
- Heatmap summary: counts only the range the grid actually draws, never history outside the window.
- Deduplication: forked sessions skip the inherited prefix (`seq < inheritedEventCount`), so they are not counted twice with their parent.
- History retention: after a session is archived, moved out of storage, or permanently deleted, its folded usage still contributes to totals, peak, heatmap, and model share. The footer notes "N of the counted sessions are no longer listed". This follows the same usage-ledger idea as ZCode: statistics do not depend on the session list.
- Failure retention: a failed read or a `migration-required` session never makes accumulated values shrink; the previous result is retained. Only sessions that have never been counted are reported as skipped. Failed sessions cool down for 5 minutes and are not re-read on every scan.
- Session count: the footer's "N sessions counted" includes retained history, so it can exceed the number of sessions currently stored.
- Cap: at most 20,000 sessions are counted; the page notes when the cap is exceeded.

## Performance and cache

- Each session's folded result is cached in `<profile>/plugin-state/usage-stats-cache.json`; entries for removed sessions are retained (`retiredAt`), so the cache grows slowly after deletions.
- Later scans are incremental by the persistence `revision`: only changed sessions are re-read (`revision` is the official change token for derived caches).
- The plugin warms the cache once, 5 seconds after activation, so opening the page is usually a cache hit.
- Cache migrations run automatically: a v2 cache is upgraded in place to v3 without a full re-read; only older or unknown versions are discarded and rebuilt.
- To clear all history (for example, to start from zero), delete the cache file and refresh; the plugin rebuilds from the session logs that still exist.

## Install

From GitHub:

```sh
dsh plugin --profile desktop add https://github.com/ailawu0409/dsh-usage-stats
```

Or use a local package path or a fork:

```sh
dsh plugin --profile desktop add <package-path-or-repo-url>
```

For local development, link the package directory into the profile:

```sh
dsh plugin --profile desktop add /path/to/dsh-usage-stats
```

Restart DeepSeek Harness and open **Settings → Usage Statistics** (below Archived sessions).

DeepSeek Harness 0.2.2-rc.1 or newer is recommended for the custom navigation icon; older hosts fall back to the default gear without error.

## Development

```sh
npm run check   # node --check index.js client.js
npm test        # host + client tests
npm pack --dry-run
```

There are no third-party runtime dependencies. Tests use temporary directories and fake services; they never touch real session data.

## Structure

| File | Purpose |
| --- | --- |
| `index.js` | Host half: scans session logs, folds statistics, durable cache, hand-written Remote |
| `client.js` | Client half: settings page, heatmap/trend/donut charts, hover cards, i18n, navigation icon slot |
| `cordis.patch.yml` | Plugin row registration |
| `locale/*.json` | Plugin manifest title and description |
| `icon.svg` | Plugin icon |
| `test/*.mjs` | Host / Client tests |

## Known limitations

- Deleting a session does not reduce historical totals (intentional): this avoids the surprising behavior where numbers shrink after a delete. Sessions deleted before this version cannot be recovered because their folded records were cleared with the old cache.
- Token accounting differs from ZCode: this plugin prefers `usage.totalTokens`, otherwise `inputTokens + outputTokens`; ZCode's `computedTotalTokens` is `input + cache + output`, so the numbers can differ.
- ZCode keeps raw usage detail for 30 days by default; this plugin keeps lifetime totals and limits only the daily detail window to 400 days (used by the heatmap and trend).
- The "Last 7 days" trend actually plots 8 points (today plus the previous 7), matching the reference design.
- On a narrow settings panel the heatmap reduces the number of weeks instead of shrinking cells, so a full year is not visible on narrow panels.
- The settings navigation icon is registered through the `settings.section.icon` slot introduced in DSH 0.2.2 (the registration id equals the section id). Hosts older than 0.2.2 do not have that seat and show the default gear without error.
- DSH 0.2.2 adds German, Spanish, French, Japanese, Portuguese, and Russian UI; this plugin's copy remains Chinese/English and falls back to English for other languages.

## Contributing and security

- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

MIT, see [LICENSE](LICENSE).
