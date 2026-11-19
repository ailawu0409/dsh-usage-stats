# dsh-usage-stats · Usage Statistics

[中文文档](README.zh-CN.md) · [GitHub](https://github.com/ailawu0409/dsh-usage-stats) · [Releases](https://github.com/ailawu0409/dsh-usage-stats/releases) · [Issues](https://github.com/ailawu0409/dsh-usage-stats/issues)

[![CI](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml/badge.svg)](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A community plugin for DeepSeek Harness that adds a **Usage Statistics** section to Settings: token totals, per-session usage, activity, chat duration, and model share for local sessions.

> **Unofficial plugin:** Not affiliated with or endorsed by DeepSeek. DSH extension APIs may change between releases.
>
> **Version note:** the version in `package.json` (currently `0.3.2`) is the plugin version, not the host version. The manifest declares no host version constraint, so the compatibility notes below are advisory.

## Features

- **Overview metrics (3)**: total tokens, peak tokens (single day), and longest chat duration.
- **Token activity heatmap**: GitHub-style weekly grid with Daily / Weekly / Cumulative color modes. In Daily mode hovering a cell shows the date, tokens and turns (e.g. `Oct 27, 2026` / `506 K tokens · 2 turns`); Weekly shows the week total and Cumulative shows the tokens accumulated up to that day. The summary line follows the mode (active days / active weeks / accumulated tokens) and counts only the range the grid draws.
  - Cells stay at the reference 11px; the number of weeks adapts to the panel width (up to 53, at least 13). The summary states the actual range, for example "over the last 8 months".
- **Daily token trend**: smoothed lines colored by model, with Last 7 days / Last 30 days ranges (8 / 31 points including today, with at most 8 date labels on the axis). Hover shows a vertical cursor, highlighted points, and a per-model breakdown for that day. Only the six models with the most tokens in the selected range are plotted, and the hover breakdown lists those series; the remaining models are not drawn individually (they are aggregated into "Other models" in the donut chart).
- **Model usage**: donut chart plus a share list (top 5 models + Other); hovering a segment shows its tokens and share.
- **Usage by session**: Sessions ranked by token usage, busiest first (up to 200 rows, scrolled inside the card). Each row shows the Session title, its last active day, and a usage bar. **Only unarchived Sessions appear**: archived, deleted, and subagent Sessions are left out of the list, while their usage still contributes to the totals, peak, heatmap, and model share under the history-retention rule below. A Session without a title is shown as "Untitled session · short id".
- Follows the host light/dark theme and official font, ships a bilingual Chinese/English UI, and provides a sticky Refresh button in the bottom-right corner. Refresh triggers a full re-scan of every listed session, not just a view update.
- The page header keeps only the title (host settings title scale, 16px); the settings navigation icon uses the plugin's own bar-chart glyph through the `settings.section.icon` slot introduced in DSH 0.2.2 (section id `usage-stats`, order 101, right after Archived sessions).
- Errors are presented in three states: a first load without data shows a full-page error with a retry button; a failed refresh keeps the existing data and shows one retryable banner at the top; a rendering crash is contained by an error boundary with its own retry.
- A footer note reports the counted sessions, retained history, skipped sessions, a truncation notice when the cap is hit, and the local-only data source.

## Compatibility

- Verified against DeepSeek Harness `0.2.2-rc.5` (desktop). The plugin relies only on contracts that are unchanged since `0.2.2-rc.1`, so rc.1 through rc.4 are expected to behave the same (runtime verification for this release covers rc.5); `0.2.2-rc.5` or newer is recommended. On hosts that lack the Workspace registry or session-list service, the per-session card or titles are unavailable, but the other statistics still work.
- On DeepSeek Harness 0.2.2 and newer, the Settings navigation icon is registered through the official `settings.section.icon` slot (section id `usage-stats`, order 101). Hosts older than 0.2.2 do not have that seat and show the default gear without error.
- Node.js 22 or newer for local development and tests. CI runs Node.js 22 and 24; there are no third-party runtime dependencies and no build step.
- The Settings UI is available in English and Chinese. Other host languages introduced in DSH 0.2.2 fall back to English for this plugin's text.

## Data source and accounting

All data comes from **local session logs** (read-only; no network access and nothing is uploaded). The plugin reads through the host's session services; the only file the plugin writes is its own fold cache.

- Total tokens: sum of `usage` on every `assistant/message` (`totalTokens` when present and positive, otherwise `inputTokens + outputTokens`).
- Peak tokens: highest single-day usage, using the local time zone calendar day.
- Longest chat: the maximum, within one session, of the summed completed `turn/start → turn/end` durations, so idle time across an overnight gap is not counted.
- Turns: counted on the **start day** of `turn/start`; a turn that crosses midnight counts on the day it started.
- Model label: `message.source.model`, falling back to `source.provider`, then `unknown`.
- Heatmap summary: counts only the range the grid actually draws, never history outside the window.
- Deduplication: forked sessions skip the inherited prefix (`seq < inheritedEventCount`), so they are not counted twice with their parent.
- History retention: after a session is archived, moved out of storage, or permanently deleted, its folded usage still contributes to totals, peak, heatmap, and model share. The footer notes "Includes history from N session(s) no longer listed". This follows the same usage-ledger idea as ZCode: statistics do not depend on the session list.
- Session list: only Sessions that are still listed in persistence, are not in the host Workspace registry's archive set (`archivedSessionIds`), are not subagent children (`header.origin === 'subagent'`), and have a token total above zero become rows. Deleted (`retiredAt`), archived, and subagent Sessions are excluded from the list while still counting in the totals under the rule above. Rows are ordered by token usage, capped at 200 and scrolled inside the card; the card notes "showing the top 200 by usage" when the cap is hit.
- Session titles: taken from the host session list's projection hints (the same titles the sidebar shows); cold Sessions come from the host's projection cache, so no extra log reads happen. A missing title (or a host without the session-list service) falls back to "Untitled session · short id", and the last active day is the Session's last day with usage.
- Failure retention: a failed read or a `migration-required` session never makes accumulated values shrink; the previous result is retained. Only sessions that have never been counted are reported as skipped. Failed sessions cool down for 5 minutes and are not re-read on every scan.
- Session count: the footer's "Across N sessions" includes retained history, so it can exceed the number of sessions currently stored.
- Cap: one scan reads and folds at most 20,000 **currently listed** sessions. When the listing is larger, the page shows a truncation note. Retained history and already-cached entries are still counted, so the displayed session count can exceed 20,000.
- Lifetime vs window: totals, peak, longest chat, and model share are computed from **all** folded history. Only the per-day detail sent to the Client is limited to a lookback of about 400 days (today plus the preceding 400 days, up to 401 daily points), which covers the 53-week heatmap and both trend ranges.

## Local data and privacy

The plugin has no telemetry, analytics, or network requests. It reads local session logs read-only through DeepSeek Harness's session services and writes only one file per profile:

- `<profile>/plugin-state/usage-stats-cache.json` — folded per-session token counts, per-day model buckets, turn counts, active durations, and `retiredAt`. The cache contains session IDs and model names but no message text, prompts, titles, or credentials.

Each DSH profile has its own `plugin-state` directory. The cache is loaded into memory once at plugin startup; later scans do not re-read the file. To clear all history, **fully quit DeepSeek Harness, delete the cache file, then restart the app** — see [Performance and cache](#performance-and-cache). Treat the cache as local data and do not attach it to public issues without review.

## Performance and cache

- Each session's folded result is cached in `<profile>/plugin-state/usage-stats-cache.json`; entries for removed sessions are retained (`retiredAt`), so the cache grows slowly after deletions. The file is written atomically (temporary file + rename).
- The state directory resolves from `DSH_PROFILE_DIR` (used by tests to point at a temporary directory), otherwise from the directory of `ctx.baseUrl` unless that is the plugin's own package, otherwise the working directory.
- The cache is loaded into memory **once when the plugin starts**; later scans never re-read the file.
- A normal `getStats` scan is incremental by the persistence `revision`: only changed sessions are re-read (`revision` is the official change token for derived caches). **Refresh** sends `action: 'refresh'`, which forces a full re-read of every listed session and bypasses both the revision cache and the 5-minute failure cooldown.
- Scans are bounded: at most 4 concurrent session reads, a 120-second abort deadline, and concurrent callers share one in-flight scan. The Client gives up on a Remote call after 60 seconds.
- The plugin warms the cache once, 5 seconds after activation, so opening the page is usually a cache hit.
- Cache migrations run automatically: a v2 cache is upgraded in place to v3 without a full re-read; only older (v1) or unknown versions are discarded and rebuilt. A corrupt file is discarded too.
- The per-session list keeps no title cache of its own: titles are read from the host's Session projections on every scan (no extra log reads), and the archive set is read from the Workspace registry each time. The fold cache layout and version therefore stay unchanged (still v3). Archiving, unarchiving, or deleting a Session shows up after the next scan — reopening the page or pressing Refresh.
- When the host lacks the Workspace registry (so archive state is unknown), the response omits the per-session list and the card is not rendered; a missing session-list service or a failed title read only costs the labels, never the statistics.
- To clear all history: **quit DeepSeek Harness completely, delete the cache file, then restart the app**. Deleting the file while the host is running does not clear the in-memory cache; the next scan — and especially a Refresh — writes the retained history back. After a restart the plugin rebuilds from the session logs that still exist.
- Host failures are returned as `{ error: { code, message } }` with `stats-unavailable`, `scan-failed`, or `bad-request`.

## Install

Open DeepSeek Harness Desktop once so its `desktop` profile exists, then fully quit the application before running any `dsh plugin --profile desktop ...` command. The command manages the profile and must not run while the app is using it.

From GitHub:

```sh
dsh plugin --profile desktop add github:ailawu0409/dsh-usage-stats
```

To install a specific release, use its tag, for example:

```sh
dsh plugin --profile desktop add github:ailawu0409/dsh-usage-stats#v0.3.2
```

For local development, link the package directory into the profile:

```sh
dsh plugin --profile desktop add /path/to/dsh-usage-stats
```

Use `github:<your-account>/dsh-usage-stats` for a fork. Restart DeepSeek Harness, then open **Settings → Usage Statistics** (below Archived sessions). If you use a profile other than `desktop`, replace `desktop` consistently in these commands.

### Upgrade

Back up important local data, fully quit DeepSeek Harness, run the installation command again to fetch the desired revision, and restart the application. Check the [release notes](https://github.com/ailawu0409/dsh-usage-stats/releases) before upgrading. Existing plugin cache files are not intentionally cleared by an upgrade.

### Uninstall

Fully quit DeepSeek Harness, then remove the package and restart:

```sh
dsh plugin --profile desktop remove dsh-usage-stats
```

Removing the package does not delete the plugin's cache file. To remove the remaining local statistics as well, delete `<profile>/plugin-state/usage-stats-cache.json` while the app is not running.

## Usage

### Overview

The page opens with three metrics: **total tokens** across all folded history, **peak tokens** for a single day, and the **longest chat** duration measured from completed turns. All three are lifetime figures, even when the trend range is Last 7 days or Last 30 days.

### Token activity heatmap

Choose **Daily**, **Weekly**, or **Cumulative** in the card header. Daily colors each day by its own tokens; Weekly colors each column by that week's total; Cumulative colors each day by the tokens accumulated up to that day. Hover a cell to see the date and the value for the active mode. The summary line follows the same mode and reports only the range the grid actually draws. Cells stay at 11px; the grid shows 13 to 53 weeks depending on the panel width, so a narrow Settings panel shows fewer weeks rather than shrinking cells.

### Daily token trend

Use **Last 7 days** or **Last 30 days** above the chart. The chart plots 8 or 31 points including today and shows at most 8 date labels. Lines are colored by model; only the six models with the most tokens in the selected range are drawn, and the hover breakdown lists those six series. Other models still appear in the donut chart's "Other models" segment.

### Model usage

The donut chart shows the top five models plus an aggregated **Other models** segment. Hover a segment to see its token count and share; the list beside the chart shows the same shares.

### Usage by session

The card ranks unarchived Sessions by token usage, busiest first, shows at most 200 rows, and scrolls inside the card when the list is taller than the card. Each row shows the Session title, the last active day, and a usage bar relative to the busiest listed Session. Archived, deleted, and subagent Sessions are not listed, but their usage still counts in the totals above. A Session without a title is shown as "Untitled session · short id".

The list reflects the archive state of the last scan. After archiving, unarchiving, or deleting a Session in the host's archive UI, reopen this page or press **Refresh** to update the list. When the host Workspace registry is unavailable, the card is hidden and the other statistics are unaffected.

### Refresh and states

The sticky **Refresh** button in the bottom-right corner triggers a full re-scan of every currently listed Session, not just a redraw. While it runs the button shows "Measuring…" and is disabled. The page shows a loading skeleton on first load, an empty state when no usage exists, a full-page error with a retry button when the first load fails, and a retryable banner at the top when a refresh fails while existing data remains on screen. A rendering error is contained by an error boundary with its own retry.

## Troubleshooting

- **Usage Statistics is missing from Settings.** Confirm the package is installed in the active profile and restart DeepSeek Harness. On 0.2.2 and newer the navigation uses the plugin's bar-chart glyph; older hosts show the default gear for the section, which is expected.
- **The page says usage statistics are unavailable.** The Client could not mount or call the Host Remote. Refresh the page, verify the host version and profile plugin, then restart DeepSeek Harness.
- **Some sessions are skipped.** A log could not be read or is marked `migration-required`; the plugin keeps any previous result and reports only sessions that were never counted. Failed reads cool down for 5 minutes and are retried later or when you press Refresh.
- **Refresh failed but the old numbers remain.** This is intentional: a failed refresh must not clear existing data. Retry, and restart the app if the error persists.
- **Usage by session is missing or stale.** The host may not expose the Workspace registry's archive set, or the page has not scanned since the archive changed. Press Refresh; if the registry is unavailable the card stays hidden while the other statistics continue to work.
- **Clearing history did not work.** Fully quit DeepSeek Harness before deleting `<profile>/plugin-state/usage-stats-cache.json`, then restart. Deleting the file while the app is running does not clear the in-memory cache and the next scan writes it back.
- **Numbers differ from another usage tool.** This plugin prefers `usage.totalTokens`, otherwise `inputTokens + outputTokens`. ZCode's `computedTotalTokens` is `input + cache + output`, so values can legitimately differ; see Known limitations.

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
| `index.js` | Host half: scans session logs, folds statistics, unarchived per-session list, durable cache, hand-written Remote |
| `client.js` | Client half: settings page, heatmap/trend/donut charts, per-session usage list, hover cards, i18n, navigation icon slot |
| `cordis.patch.yml` | Plugin row registration |
| `locale/*.json` | Plugin manifest title and description |
| `icon.svg` | Plugin icon |
| `package.json` | Exports, DSH plugin configuration, `files` manifest and scripts |
| `test/host.test.mjs`, `test/client.test.mjs` | Host / Client tests (repository only) |
| `AGENTS.md` | Development-agent guide, in Chinese (repository only) |
| `CONTRIBUTING.md`, `SECURITY.md` | Contribution guide and security policy (repository only) |
| `.github/workflows/ci.yml` | CI matrix and package check (repository only) |

`npm pack --dry-run` publishes 10 files: `index.js`, `client.js`, `cordis.patch.yml`, `locale/en.json`, `locale/zh.json`, `icon.svg`, plus npm's automatic `package.json`, `LICENSE`, `README.md`, and `README.zh-CN.md`. `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, the CI workflow, and the tests stay in the repository.

## Known limitations

- Deleting a session does not reduce historical totals (intentional): this avoids the surprising behavior where numbers shrink after a delete. Sessions deleted before this version cannot be recovered because their folded records were cleared with the old cache.
- Clearing history requires a full host restart: the cache is loaded once at startup, so deleting the cache file while the app is running has no lasting effect. See [Performance and cache](#performance-and-cache).
- Token accounting differs from ZCode: this plugin prefers `usage.totalTokens`, otherwise `inputTokens + outputTokens`; ZCode's `computedTotalTokens` is `input + cache + output`, so the numbers can differ.
- ZCode keeps raw usage detail for 30 days by default; this plugin keeps lifetime totals and limits only the per-day detail to about 400 days of lookback (today plus the preceding 400 days), used by the heatmap and trend.
- The "Last 7 days" trend plots 8 points and "Last 30 days" plots 31 points (today plus the preceding days), matching the reference design; the date axis shows at most 8 labels.
- The trend plots at most six model series, ranked by tokens in the selected range; other models appear only as part of "Other models" in the donut chart.
- The 20,000 cap applies to currently listed sessions per scan, not to retained history, so the footer's session count can be higher.
- The "Usage by session" list shows at most 200 rows and reflects the archive state of the last scan. It depends on the host Workspace registry; when that service is unavailable the card is hidden and the other statistics are unaffected.
- On a narrow settings panel the heatmap reduces the number of weeks instead of shrinking cells, so a full year is not visible on narrow panels.
- The empty state appears when total tokens are zero; an existing installation with cached history may still show numbers after the source sessions are gone.

## Contributing and security

- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

MIT, see [LICENSE](LICENSE).
