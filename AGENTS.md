# AGENTS.md

本文件面向在本仓库中工作的编码代理，适用于整个项目。本文件使用中文，是仓库的代理开发指南；面向用户的文档是英文 `README.md` 与中文 `README.zh-CN.md`。任何用户可见的变更都必须同步更新两份 README。

## 项目概览

dsh-usage-stats 是一个非官方的 DeepSeek Harness 设置面板插件，在「设置 → 使用统计」中展示本机会话的 Token 用量、按会话的用量排行（仅未归档会话）、活跃情况、聊天时长和模型分布。插件以 DSH bundle 形式发布，由 `cordis.patch.yml` 注册到 profile。

插件只读取本机会话日志，不联网、不上报；唯一写入是自己的折叠缓存文件。修改时必须保持这一隐私边界。

## 当前基线

| 项目 | 当前情况 |
| --- | --- |
| npm 包名 / 版本 | `dsh-usage-stats` / `0.3.1`（插件版本，与宿主版本无关） |
| 已验证宿主 | DeepSeek Harness `0.2.2-rc.3` Desktop；`0.2.2-rc.1` 起的接口契约未变化，建议使用 rc.1 或更新版本 |
| 导航图标 | DSH `0.2.2` 起提供 `settings.section.icon`；更旧宿主保留默认齿轮且不报错 |
| 运行时 | JavaScript ES Modules，Node.js `>= 22`；无第三方运行时依赖、无构建步骤 |
| 测试与 CI | `test/host.test.mjs`、`test/client.test.mjs`；CI 覆盖 ubuntu/windows × Node 22/24 与 package 内容检查 |
| 发布内容 | `npm pack --dry-run` 为 10 个文件；`AGENTS.md`、测试与仓库级文档不随之发布 |

## 技术约束

- 使用 JavaScript ES Modules，Node.js 版本要求为 >= 22（CI 覆盖 Node 22 / 24）。
- 不引入第三方运行时依赖，除非用户明确要求；Host 端只允许 Node.js 内置模块，Client 端只通过模块加载器获取 React 与 DSH 服务。
- 不引入构建步骤、TypeScript、打包器、linter 或 formatter；`index.js` 与 `client.js` 直接作为源码发布。
- Host 与 Client 分端实现，避免在 Client 中直接访问文件系统或会话日志。
- 图表和界面使用项目现有实现（React + 手写 CSS/SVG），不为了局部改动引入新的框架或构建流程。
- DeepSeek Harness 扩展 API 可能随宿主版本变化，修改集成逻辑时应保持现有兼容方式；`package.json` 未声明宿主版本约束，不要擅自添加 `engines.dsh` 或 DSH peer 依赖。
- 插件版本号在 `package.json`，与宿主版本号无关；文档中不要把两者混为一谈。

## 目录与职责

| 路径 | 职责 | 随 npm 包发布 |
| --- | --- | --- |
| `package.json` | 包身份、版本、Node engine、脚本、exports、`dsh.bundle` / `dsh.client` 清单与 `files` 清单 | ✓ |
| `index.js` | Host 端：扫描会话、折叠统计、按会话列表（归档过滤与标题）、增量缓存、持久化与 Remote 服务 | ✓ |
| `client.js` | Client 端：设置页、图表、会话用量卡片、交互、主题、国际化与导航图标 | ✓ |
| `cordis.patch.yml` | 插件行注册（id `usage-stats`，name `dsh-usage-stats`） | ✓ |
| `locale/en.json`、`locale/zh.json` | 插件清单的中英文标题与描述（不是页面文案） | ✓ |
| `icon.svg` | 插件图标 | ✓ |
| `README.md`、`README.zh-CN.md` | 功能、统计口径、安装、使用和开发说明（英文 / 中文） | ✓ |
| `LICENSE` | MIT 许可 | ✓ |
| `test/host.test.mjs` | Host 端统计、按会话列表、缓存、失败处理与迁移测试 | — |
| `test/client.test.mjs` | Client 端界面、图表、会话用量卡片、文案与交互测试 | — |
| `AGENTS.md` | 本文件：开发代理指南（中文） | — |
| `CONTRIBUTING.md` | 贡献指南 | — |
| `SECURITY.md` | 安全策略与隐私边界 | — |
| `.github/workflows/ci.yml` | CI：ubuntu/windows × Node 22/24 的语法检查与测试，以及 package 内容检查 | — |
| `.gitignore` | 忽略 node_modules、tgz 与 plugin-state | — |

`npm pack --dry-run` 实际发布 10 个文件：`package.json` 的 `files` 清单中的 6 个（`index.js`、`client.js`、`cordis.patch.yml`、`locale/en.json`、`locale/zh.json`、`icon.svg`），加上 npm 自动带入的 `package.json`、`LICENSE`、`README.md`、`README.zh-CN.md`。`AGENTS.md`、`CONTRIBUTING.md`、`SECURITY.md`、CI 与测试只留在仓库中。

## 数据流与模块边界

```text
本机会话日志（只读）
  → sessionPersistence.list() 枚举会话
  → sessionQuery.readSession(id)（优先）/ sessionPersistence.open(id, 'read')（回退）
  → foldSession() 折叠每会话用量
  → <profile>/plugin-state/usage-stats-cache.json（内存 + 原子落盘）
  → aggregateStats() 汇总为 wire snapshot
  → Remote dsh-usage-stats#usageStats/command
  → client.js UsageStatsView / 各图表组件
```

Host 端不得在 Client 中复用；Client 只消费 Remote 返回的 `stats`，不读取日志或文件。

## 接口契约

### Host 注册与 Remote

- `export const inject = ['typert']`；`apply(ctx)` 在启动时注册服务与 Typert invocation。
- 发布 `ctx.provide('usageStats', { command })`；服务对象带不可枚举的 `typertRemote`（`{ service, serviceKey: 'usageStats', namespace: 'usageStats' }`）。
- Typert invocation id 为 `dsh-usage-stats#usageStats/command`，参数为单个 `request`，使用 `src-json` codec；Typert 不可用时服务仍提供、页面无法加载，日志会记录错误。
- `command(request)` 先等待缓存加载完成（`ready`）；非对象或未知 action 返回 `{ error: { code: 'bad-request', message } }`。

| Action | 请求 | 返回 |
| --- | --- | --- |
| `getStats` | `{ action: 'getStats', force?: boolean }` | `{ stats }` 或 `{ error }`；普通调用按 `revision` 增量，`force: true` 等同全量重读 |
| `refresh` | `{ action: 'refresh' }` | 同 `getStats`，强制全量重读并绕过失败冷却 |

错误码：`bad-request`、`stats-unavailable`（持久化列表服务不可用）、`scan-failed`（列表或其他扫描异常）。并发调用共享一次进行中的扫描。

### `stats` 载荷

```js
{
  generatedAt, today,
  sessions: { total, counted, skipped, retired, truncated },
  bySession?: {
    rows: [{ id, title: string | null, tokens, lastDay: string | null }],
    total, truncated
  },
  totals: { tokens, peakDay, peakTokens, longestChatMs, activeDays, firstDay, lastDay },
  daily: [{ day, tokens, turns, models: { [model]: tokens } }],
  models: [{ model, tokens }]
}
```

- `daily` 只包含今天及前 400 天（最多 401 个日点）；`totals`、`models`、峰值与最长聊天基于全部折叠历史。
- `bySession` 只在能读出 `workspaceRegistry.archivedSessionIds` 时出现；缺少时整张会话卡片不渲染。
- `sessions.total` 是当前持久化列表数量；`counted` 是缓存中参与聚合的条目数（含保留历史），`retired` 是已不在列表的条目数，`skipped` 是既无缓存又无法读取的会话数。

### Client 注册

- 入口必须是 `window.__ModuleLoader__.load({ id: 'dsh-usage-stats', factory(require) { ... } })`；只 `require('react')`，不要改成打包器入口。
- `inject = ['slots', 'locale', 'remote', 'typert']`；`package.json` 的 `dsh.client` 另外声明 `platform: 'web'`、`immediately: true` 与宿主 UI 包依赖。
- `ctx.remote.$mount()` 注册 `dsh-usage-stats#usageStats/command`（strict codec，`typeSymbol` 为 `dsh-usage-stats#UsageStatsCommandRequest` / `...Result`）；调用 `ctx.get('remote.usageStats').command()`，有 60,000ms 看门狗。
- `settings.section`：id `usage-stats`、order `101`、locale `usage-stats`，`inject()` 返回 `actions`（`refresh`）与 `hooks: { stats, colorScheme, locale }`；宿主转成 `useStats` / `useColorScheme` / `useLocale`。
- `settings.section.icon`：同一 id `usage-stats`，组件只画柱状图图标，不修改宿主 DOM；宿主未提供 slot 时保留默认齿轮。
- 主题：`ctx.get('theme').getTheme().active.colorScheme` + `theme/change` 事件，取不到回退 `light`。
- 国际化：`ctx.locale.register('usage-stats', { zh, en })` + `ctx.locale.bind('usage-stats')`；`localeSnapshot.id` 以 `zh` 前缀判定中文，其余语言由宿主回退英文。

## 宿主端实现

### 会话读取与折叠

- `sessionPersistence.list({ signal })` 是扫描入口；服务缺失返回 `stats-unavailable`，抛错返回 `scan-failed`。
- `sessionQuery.readSession(id)` 优先；没有时使用 `sessionPersistence.open(id, 'read')`，并在 `finally` 中关闭句柄。两者都需提供 `header`、`events`、`inheritedEventCount`。
- `foldSession` 只统计有 `time` 且 token > 0 的 `assistant/message`；`usageTokens` 优先大于 0 的 `usage.totalTokens`，否则 `inputTokens + outputTokens`（负数按 0）。
- 模型名取 `message.source.model`，回退 `source.provider`，再回退 `unknown`；按本地自然日 `YYYY-MM-DD` 分桶。
- `turn/start` 按开始日计入 `dayTurns`；`turn/end` 只累计同一 `turn` 已完成的 `end - start`（`end > start`）；单会话所有已完成轮次之和为该会话 `activeMs`。
- Fork 会话跳过 `seq < inheritedEventCount` 的继承前缀，避免与父会话重复计数。

### 扫描与缓存

- 缓存文件为 `<state>/plugin-state/usage-stats-cache.json`，`CACHE_VERSION = 3`；`CACHE_COMPATIBLE_VERSIONS = [2, 3]`，v2 原地迁移为 v3，v1/未知版本丢弃重建，损坏文件也丢弃。
- 缓存条目字段：`revision`、`sizeBytes`、`createdAt`、`start`、`end`、`activeMs`、`tokens`、`day`（日期 → 模型 → token）、`dayTurns`（日期 → 轮次数）、`retiredAt`（不在列表后的时间戳）。
- 扫描先取完整持久化列表（即使超过 `MAX_SESSIONS`）；对缓存中已不在列表且仍贡献统计的条目保留并标记 `retiredAt`；完全没有贡献的空条目删除。
- 对仍在列表的会话：`formatStatus === 'migration-required'` 时保留旧缓存或计入 `skipped`；`revision`（以及可选 `sizeBytes`）未变且非 `force` 时直接用缓存；失败过的会话 5 分钟内不重试（`FAILED_RETRY_MS = 300000`）。
- 读取通过 `mapLimit` 最多 4 个并发；单次扫描 120 秒后中止（`SCAN_DEADLINE_MS = 120000`）；中止的读取下次重试，不记失败；真实失败记录冷却并沿用旧缓存。
- 扫描结束若有变化才原子写盘（临时文件 + rename）；缓存只在插件启动时读入内存一次，后续扫描不重新读盘。状态目录按 `DSH_PROFILE_DIR` → `ctx.baseUrl` 所在目录（排除插件自身包目录）→ `process.cwd()` 解析。
- 插件激活后 5 秒预热一次（`WARMUP_DELAY_MS = 5000`）；`ctx.effect` 清理定时器并中止进行中的扫描。
- `MAX_SESSIONS = 20000` 只限制每轮扫描从当前列表读取/折叠的会话数；已缓存条目与 `retiredAt` 保留历史仍计入，`counted` 可能大于 20000。

### 聚合与按会话列表

- `aggregateStats` 遍历全部缓存条目（含 `retiredAt`）累计 `totals.tokens`、峰值日、`longestChatMs`、`activeDays`、`models` 与逐日 `daily`；`daily` 只发送今天及前 `DAILY_WINDOW_DAYS = 400` 天的数据。
- 按会话列表只从「仍在持久化列表中、`retiredAt` 为空、不在 `workspaceRegistry.archivedSessionIds` 中、`header.origin !== 'subagent'`、且折叠 Token > 0」的条目生成；按 Token 降序（同量按 id 升序），最多 `SESSION_LIST_LIMIT = 200` 行；`bySession.total` 是过滤后总数，`truncated` 表示超过 200。
- 会话标题取 `sessionController.list({}, signal)` 的 `projections.values.title`（与侧栏一致的投影提示，冷会话由投影缓存提供，零额外日志读取）；缺失或读取失败只影响标题，不要把标题写进折叠缓存或改动缓存版本。
- 归档集合读取失败时 `readArchivedSessionIds()` 返回 `null`，响应省略 `bySession`；归档/子智能体/已删除会话仍按账本口径计入累计，不因列表过滤改变。
- 失败保留：读取失败或 `migration-required` 的会话不会让累计值回退；已有上次结果继续沿用，只有从未统计过的会话才计入 `skipped`。

## 客户端实现

- `client.js` 通过 `window.__ModuleLoader__.load` 注册；`UsageStatsView` 从 props 读取 `useStats` / `useColorScheme` / `useLocale` 与 `actions`，不要改回 `props.hooks.*`。
- 状态：首次加载显示骨架和「正在统计用量…」；`stats === null` 显示整页错误与重试；已有数据但刷新失败显示顶部可重试 banner，保留旧数据；渲染错误由 `SectionBoundary` 兜底；`totals.tokens <= 0` 显示空状态。
- 概览 `StatRow` 固定三项：累计 Token、峰值 Token、最长聊天；不要恢复已移除的连续天数指标。
- `TokenActivityCard`：Daily / Weekly / Cumulative 三模式；`buildHeatmap` 用 `HEATMAP_CELL = 11`、`HEATMAP_GAP = 3`，周数 `heatmapWeeks()` 在 13–53 之间自适应；悬停内容随模式变化；摘要只统计网格实际绘制的 `windowStart`–`windowEnd`。
- `TrendCard`：`windowDays = rangeDays + 1`（7/30 日 → 8/31 个点）；`buildTrend` 按窗口内总用量取前 `TREND_SERIES_LIMIT = 6` 个模型；缺失日为 0；X 轴最多 8 个日期标签；悬停显示竖向参考线、高亮点和该日模型明细。
- `ModelUsageCard`：环形图取前 `DONUT_SEGMENTS = 5` 个模型 + Other；占比列表与悬停 share 使用同一总量。
- `SessionUsageCard`：只渲染 `stats.bySession.rows`，不自行过滤或重排；缺 `stats.bySession` 时整卡不渲染；标题为空显示「未命名会话 · 短 id」；保留最近活跃日期和相对最高用量的占比条。
- 刷新按钮为 sticky 右下角；点击触发 `{ action: 'refresh' }` 全量重扫，busy 时禁用并显示「统计中…」。
- 底部说明行覆盖 `sessions.counted`、`retired`、`skipped`、`truncated` 与 `page.source`，中英文案保持一致。
- 用户可见文案全部在 `client.js` 的 `zh` / `en` 字典；`locale/*.json` 只用于插件清单元数据。`test/client.test.mjs` 会检查两本字典 key 完全一致且无未使用 key；`activity.*` / `range.*` 通过模板字符串动态使用。
- 样式只用宿主已定义的 `--dsw-*` tokens；不要修改宿主 DOM，不要使用未定义的 token（如 `--dsw-alias-label-error`）；导航图标通过 `settings.section.icon` slot 注册。

## 测试与验证

- `test/host.test.mjs` 是独立 `node:assert/strict` 脚本：`boot(sessions, options)` 构造假 Cordis 上下文、假持久化/查询/注册表/会话列表与临时状态目录；`withStateDir()` 用 `mkdtemp` 和 `DSH_PROFILE_DIR` 隔离。新增行为先加 `async function testX()`，再把它加入底部 `tests` 数组。
- `test/client.test.mjs` 在导入前 mock `globalThis.window.__ModuleLoader__`，用最小 `ReactStub` 执行 `plugin.apply(ctx)`；`plugin.__test` 暴露纯 helper；测试覆盖 Remote descriptor、slot 注册、theme 事件、字典一致性、CSS token 与关键组件渲染。修改 helper 时同步更新 `__test` 与断言。
- 任何行为变化都必须有回归测试；禁止只改断言掩盖回归，禁止使用真实会话、真实 DSH profile、生产日志、凭据或个人信息。
- 常用命令：

```sh
npm run check       # node --check index.js && node --check client.js
npm run test:host   # 运行 Host 端测试
npm run test:client # 运行 Client 端测试
npm test            # 运行全部测试
npm pack --dry-run  # 检查实际发布内容
```

CI 在 ubuntu/windows × Node 22/24 上运行 `npm run check` 与 `npm test`，另有 package job 运行 `npm pack --dry-run`。

## 开发规范

### 通用

- 优先进行小而集中的修改，保持现有代码风格和模块边界。
- 修改行为时同步更新相关测试，不要只修改断言来掩盖回归。
- 用户可见功能、统计口径、安装方式、限制或文件清单变化时，同步更新 `README.md` 与 `README.zh-CN.md`，两份章节、数值和口径逐条对应。
- 不提交真实会话日志、个人数据、缓存文件或本地配置。
- 不执行与当前任务无关的重构、格式化或依赖升级。

### Host 端

- 保持日志读取为只读，不修改宿主持久化数据；`stats-unavailable` / `scan-failed` 返回错误对象而不是抛异常。
- 统计口径必须与 `README.md` 及 `README.zh-CN.md` 一致：`totalTokens`（> 0）优先、否则 `inputTokens + outputTokens`；本地自然日；轮次按 `turn/start` 开始日计；最长聊天为单会话内已完成 `turn/start → turn/end` 时长之和的最大值；模型名取 `message.source.model`，回退 `source.provider`，再回退 `unknown`。
- Fork 会话必须排除继承前缀 `seq < inheritedEventCount`，避免与父会话重复计数。
- 按会话列表只从「仍在持久化列表中、不在 `workspaceRegistry.archivedSessionIds` 中、`header.origin !== 'subagent'`（宿主会话列表同样隐藏子智能体行）、且折叠 Token > 0」的条目生成，按 Token 降序（同量按 id 升序），最多 `SESSION_LIST_LIMIT = 200` 行；`bySession` 只在能读到归档集合时返回，读不到时省略该字段（页面隐藏卡片），不得返回未过滤的列表。归档、子智能体与已删除会话仍按账本口径计入累计，不因列表过滤而改变。
- 会话标题取 `sessionController.list()` 的 `projections.values.title`（宿主投影提示，冷会话由投影缓存提供，零额外日志读取）；缺失或读取失败只影响标题与回退文案。不要把标题写进折叠缓存，也不要因此改动缓存版本。
- 用量聚合必须与会话列表解耦：会话从持久化列表消失（永久删除、移出存储、暂时不可用）时保留其折叠结果并继续计入历史；不得因会话消失或单次读取失败让累计值回退。设计参考 ZCode 的 `model_usage` 用量账本（统计查询不 join 会话表、删除为软删除）。
- 保留对读取失败、`migration-required`、失败冷却（5 分钟）和会话数量上限的处理；已有上次结果时沿用，只有从未统计过的会话才计入跳过。
- 缓存结构变化时，同步处理缓存版本迁移和增量统计逻辑；当前 v2→v3 为兼容迁移（v1 及未知版本才丢弃重建），不得丢弃可迁移的历史。
- 状态目录按 `DSH_PROFILE_DIR`（测试用）→ `ctx.baseUrl` 所在目录（排除插件自身包目录）→ `process.cwd()` 解析；缓存写在 `<state>/plugin-state/usage-stats-cache.json`，以临时文件 + rename 原子写入，绝不写进插件包目录。
- 缓存**只在插件启动时读入内存一次**，后续扫描不重新读盘。清空历史的正确流程是「完全退出宿主 → 删除缓存文件 → 重启」；文档不得写成「删文件后刷新」，因为刷新会把内存中的保留历史重新写回。
- `getStats` 按持久化层 `revision` 增量；`refresh` 强制全量重读并绕过失败冷却；并发调用合并为一次扫描；单轮最多 4 个并发会话读取，120 秒后中止；插件启动 5 秒后预热一次。
- `MAX_SESSIONS = 20000` 只限制每轮扫描从**当前列表**读取/折叠的会话数；已缓存条目和 `retiredAt` 保留历史仍计入，因此 `counted` 可能大于 20000。
- 只有发给 Client 的每日明细受约 400 天回看限制（今天 + 前 400 天，最多 401 个日点）；累计、峰值、最长聊天和模型分布基于全部折叠历史。
- 测试使用临时目录（`DSH_PROFILE_DIR`）和假服务，不得读取或依赖开发者真实会话数据。

### Client 端

- 保持设置面板现有视觉风格，并适配宿主亮暗主题、官方字体和中英文界面；页头只保留 16px 标题。
- 修改图表时兼顾悬停浮层、空数据、大数据量和窄面板布局；热力图优先保持 11px 格子，通过 13–53 周自适应宽度。
- 热力图的悬停数值与摘要必须随 Daily / Weekly / Cumulative 模式切换，且摘要只统计网格实际绘制的区间。
- 趋势图最多绘制 6 条模型序列（按所选窗口内用量排名），悬停明细限于这些序列；近 7 日为 8 个点、近 30 日为 31 个点，X 轴最多 8 个日期标签；环形图为前 5 模型 + Other。
- 刷新按钮为 sticky 右下角，触发 Host 全量重扫；保留首屏全页错误、刷新失败顶部可重试 banner、渲染崩溃 ErrorBoundary 三种状态，刷新失败时不得清空已有数据。
- 底部说明行需覆盖会话数、保留历史、跳过、截断提示与「数据来自本机会话日志」，中英文案保持一致。
- 「会话用量」卡片只渲染 Host 给出的行，不自行过滤归档或重排；缺 `stats.bySession`（旧 Host 或归档集合不可用）时整张卡片不渲染；标题缺失时显示「未命名会话 · 短 id」，并保留最近活跃日期与用量占比条。
- 不将 Host 专属 API、Node.js 内置模块或文件系统访问带入 Client。
- 宿主 0.2.2 起提供 `settings.section.icon` slot；`client.js` 用与 `settings.section` 相同的 id 注册柱状图图标，不修改宿主 DOM。宿主未提供该 slot 时保留默认齿轮且不报错。
- `client.js` 的模块入口形状、`inject`、Remote strict codec、`settings.section` / `settings.section.icon` 注册和 hooks 名称都有测试锁定，改动需同步 `test/client.test.mjs`。
- 用户可见文案只放在 `client.js` 的 `zh` / `en` 字典；`locale/*.json` 仅用于插件清单元数据；两本字典 key 必须一致且无未使用 key。
- 样式只使用宿主已定义的 `--dsw-*` token；不要修改宿主 DOM，不要使用未定义 token（`--dsw-alias-label-error` 不是有效 token）。

## 提交与发布

- 未获用户明确要求，不提交、推送、打标签或发布。
- 发布前运行 `npm run check`、`npm test`、`npm pack --dry-run`，并核对发布文件清单与 `README.md` / `README.zh-CN.md` 的安装说明。
- 发布相关改动时保持 `package.json`、Git 标签与 GitHub Releases 一致；使用 `v<version>` 标签。
- 验证 GitHub Actions 与文档中的安装流程和当前发布版本一致。

## 文档约定

- `README.md` 是英文用户契约：功能、兼容性、安装、使用、数据来源与隐私、性能、常见问题、开发、结构、已知限制。
- `README.zh-CN.md` 必须与英文版逐节对应，命令、版本号、数值、链接、表格和限制说明保持一致；不要只更新其中一份。
- 本 `AGENTS.md` 保持中文，面向编码代理；架构、接口契约、测试机制或兼容基线变化时应同步更新本文件。
- `CONTRIBUTING.md` 与 `SECURITY.md` 分别维护贡献流程与安全策略；不要在 README 或本文件中重复整段政策文本。

## 验证要求

完成修改前检查：

1. 语法检查和相关测试通过，CI 矩阵（ubuntu/windows × Node 22/24）与 package job 对应的检查均通过。
2. 新增或改变的行为有对应测试。
3. 用户可见文案的中英文保持一致，两份 README 的章节、数值、口径与文件清单一致。
4. 统计口径、缓存、发布清单和隐私边界没有意外变化。
5. 文档与最终实现一致（包括缓存清空流程、上限口径、回看窗口等容易写错的细节）。
6. 工作区只包含本任务需要的改动。

如果检查无法运行或失败，应在最终回复中明确说明原因，不要声称已经验证。
