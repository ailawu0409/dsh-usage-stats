# dsh-usage-stats · Usage Statistics

[中文文档](README.zh-CN.md) · [GitHub](https://github.com/ailawu0409/dsh-usage-stats) · [Releases](https://github.com/ailawu0409/dsh-usage-stats/releases) · [Issues](https://github.com/ailawu0409/dsh-usage-stats/issues)

[![CI](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml/badge.svg)](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A community plugin for DeepSeek Harness that adds a **Usage Statistics** section to Settings: token totals, activity, chat duration, and model share for local sessions.

> **Unofficial plugin:** Not affiliated with or endorsed by DeepSeek. DSH extension APIs may change between releases. Verified against DeepSeek Harness 0.2.2-rc.2; 0.2.2-rc.1 or newer is recommended.
>
> **Version note:** the version in `package.json` (currently `0.2.2`) is the plugin version, not the host version. The manifest declares no host version constraint, so the compatibility notes above are advisory.

## Features

- **Overview metrics (3)**: total tokens, peak tokens (single day), and longest chat duration.
- **Token activity heatmap**: GitHub-style weekly grid with Daily / Weekly / Cumulative color modes. In Daily mode hovering a cell shows the date, tokens and turns (e.g. `Oct 27, 2026` / `506K tokens · 2 turns`); Weekly shows the week total and Cumulative shows the tokens accumulated up to that day. The summary line follows the mode (active days / active weeks / accumulated tokens) and counts only the range the grid draws.
  - Cells stay at the reference 11px; the number of weeks adapts to the panel width (up to 53, at least 13). The summary states the actual range, for example "over the last 8 months".
- **Daily token trend**: smoothed lines colored by model, with Last 7 days / Last 30 days ranges (8 / 31 points including today, with at most 8 date labels on the axis). Hover shows a vertical cursor, highlighted points, and a per-model breakdown for that day. Only the six models with the most tokens in the selected range are plotted, and the hover breakdown lists those series; the remaining models are not drawn individually (they are aggregated into "Other models" in the donut chart).
- **Model usage**: donut chart plus a share list (top 5 models + Other); hovering a segment shows its tokens and share.
- Follows the host light/dark theme and official font, ships a bilingual Chinese/English UI, and provides a sticky Refresh button in the bottom-right corner. Refresh triggers a full re-scan of every listed session, not just a view update.
- The page header keeps only the title (host settings title scale, 16px); the settings navigation icon uses the plugin's own bar-chart glyph through the `settings.section.icon` slot introduced in DSH 0.2.2 (section id `usage-stats`, order 101, right after Archived sessions).
- Errors are presented in three states: a first load without data shows a full-page error with a retry button; a failed refresh keeps the existing data and shows one retryable banner at the top; a rendering crash is contained by an error boundary with its own retry.
- A footer note reports the counted sessions, retained history, skipped sessions, a truncation notice when the cap is hit, and the local-only data source.

## Data source and accounting

All data comes from **local session logs** (read-only; no network access and nothing is uploaded). The only file the plugin writes is its own fold cache.

- Total tokens: sum of `usage` on every `assistant/message` (`totalTokens` when present and positive, otherwise `inputTokens + outputTokens`).
- Peak tokens: highest single-day usage, using the local time zone calendar day.
- Longest chat: the maximum, within one session, of the summed completed `turn/start → turn/end` durations, so idle time across an overnight gap is not counted.
- Turns: counted on the **start day** of `turn/start`; a turn that crosses midnight counts on the day it started.
- Model label: `message.source.model`, falling back to `source.provider`, then `unknown`.
- Heatmap summary: counts only the range the grid actually draws, never history outside the window.
- Deduplication: forked sessions skip the inherited prefix (`seq < inheritedEventCount`), so they are not counted twice with their parent.
- History retention: after a session is archived, moved out of storage, or permanently deleted, its folded usage still contributes to totals, peak, heatmap, and model share. The footer notes "Includes history from N session(s) no longer listed". This follows the same usage-ledger idea as ZCode: statistics do not depend on the session list.
- Failure retention: a failed read or a `migration-required` session never makes accumulated values shrink; the previous result is retained. Only sessions that have never been counted are reported as skipped. Failed sessions cool down for 5 minutes and are not re-read on every scan.
- Session count: the footer's "Across N sessions" includes retained history, so it can exceed the number of sessions currently stored.
- Cap: one scan reads and folds at most 20,000 **currently listed** sessions. When the listing is larger, the page shows a truncation note. Retained history and already-cached entries are still counted, so the displayed session count can exceed 20,000.
- Lifetime vs window: totals, peak, longest chat, and model share are computed from **all** folded history. Only the per-day detail sent to the Client is limited to a lookback of about 400 days (today plus the preceding 400 days, up to 401 daily points), which covers the 53-week heatmap and both trend ranges.

## Performance and cache

- Each session's folded result is cached in `<profile>/plugin-state/usage-stats-cache.json`; entries for removed sessions are retained (`retiredAt`), so the cache grows slowly after deletions. The file is written atomically (temporary file + rename).
- The state directory resolves from `DSH_PROFILE_DIR` (used by tests to point at a temporary directory), otherwise from the directory of `ctx.baseUrl` unless that is the plugin's own package, otherwise the working directory.
- The cache is loaded into memory **once when the plugin starts**; later scans never re-read the file.
- A normal `getStats` scan is incremental by the persistence `revision`: only changed sessions are re-read (`revision` is the official change token for derived caches). **Refresh** sends `action: 'refresh'`, which forces a full re-read of every listed session and bypasses both the revision cache and the 5-minute failure cooldown.
- Scans are bounded: at most 4 concurrent session reads, a 120-second abort deadline, and concurrent callers share one in-flight scan. The Client gives up on a Remote call after 60 seconds.
- The plugin warms the cache once, 5 seconds after activation, so opening the page is usually a cache hit.
- Cache migrations run automatically: a v2 cache is upgraded in place to v3 without a full re-read; only older (v1) or unknown versions are discarded and rebuilt. A corrupt file is discarded too.
- To clear all history: **quit DeepSeek Harness completely, delete the cache file, then restart the app**. Deleting the file while the host is running does not clear the in-memory cache; the next scan — and especially a Refresh — writes the retained history back. After a restart the plugin rebuilds from the session logs that still exist.
- Host failures are returned as `{ error: { code, message } }` with `stats-unavailable`, `scan-failed`, or `bad-request`.

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

Verified against DeepSeek Harness 0.2.2-rc.2. DeepSeek Harness 0.2.2-rc.1 or newer is recommended for the custom navigation icon; older hosts fall back to the default gear without error.

## Development

```sh
npm run check       # node --check index.js client.js
npm run test:host   # host tests only
npm run test:client # client tests only
npm test            # host + client tests
npm pack --dry-run  # inspect published files
```

There are no third-party runtime dependencies. Tests use temporary directories and fake services; they never touch real session data. CI runs `npm run check` and `npm test` on ubuntu/windows with Node 22 and 24, plus a package job that runs `npm pack --dry-run`.

## Structure

| File | Purpose |
| --- | --- |
| `index.js` | Host half: scans session logs, folds statistics, durable cache, hand-written Remote |
| `client.js` | Client half: settings page, heatmap/trend/donut charts, hover cards, i18n, navigation icon slot |
| `cordis.patch.yml` | Plugin row registration |
| `locale/*.json` | Plugin manifest title and description |
| `icon.svg` | Plugin icon |
| `package.json` | Exports, DSH plugin configuration, `files` manifest and scripts |
| `test/host.test.mjs`, `test/client.test.mjs` | Host / Client tests (repository only) |
| `AGENT.md` | Development-agent guide, in Chinese (repository only) |
| `CONTRIBUTING.md`, `SECURITY.md` | Contribution guide and security policy (repository only) |
| `.github/workflows/ci.yml` | CI matrix and package check (repository only) |

`npm pack --dry-run` publishes 10 files: `index.js`, `client.js`, `cordis.patch.yml`, `locale/en.json`, `locale/zh.json`, `icon.svg`, plus npm's automatic `package.json`, `LICENSE`, `README.md`, and `README.zh-CN.md`. `AGENT.md`, `CONTRIBUTING.md`, `SECURITY.md`, the CI workflow, and the tests stay in the repository.

## Known limitations

- Deleting a session does not reduce historical totals (intentional): this avoids the surprising behavior where numbers shrink after a delete. Sessions deleted before this version cannot be recovered because their folded records were cleared with the old cache.
- Clearing history requires a full host restart: the cache is loaded once at startup, so deleting the cache file while the app is running has no lasting effect. See [Performance and cache](#performance-and-cache).
- Token accounting differs from ZCode: this plugin prefers `usage.totalTokens`, otherwise `inputTokens + outputTokens`; ZCode's `computedTotalTokens` is `input + cache + output`, so the numbers can differ.
- ZCode keeps raw usage detail for 30 days by default; this plugin keeps lifetime totals and limits only the per-day detail to about 400 days of lookback (today plus the preceding 400 days), used by the heatmap and trend.
- The "Last 7 days" trend plots 8 points and "Last 30 days" plots 31 points (today plus the preceding days), matching the reference design; the date axis shows at most 8 labels.
- The trend plots at most six model series, ranked by tokens in the selected range; other models appear only as part of "Other models" in the donut chart.
- The 20,000 cap applies to currently listed sessions per scan, not to retained history, so the footer's session count can be higher.
- On a narrow settings panel the heatmap reduces the number of weeks instead of shrinking cells, so a full year is not visible on narrow panels.
- The settings navigation icon is registered through the `settings.section.icon` slot introduced in DSH 0.2.2 (the registration id equals the section id). Hosts older than 0.2.2 do not have that seat and show the default gear without error.
- DSH 0.2.2 adds German, Spanish, French, Japanese, Portuguese, and Russian UI; this plugin's copy remains Chinese/English and falls back to English for other languages.

## Contributing and security

- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

MIT, see [LICENSE](LICENSE).
