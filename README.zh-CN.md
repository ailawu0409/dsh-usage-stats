# dsh-usage-stats · 使用统计

[English](README.md) | 中文

DeepSeek Harness 的设置面板插件：在「设置 → 使用统计」中展示本机会话的 Token 用量、活跃情况、聊天时长与模型分布。

> 非官方插件，与 DeepSeek 官方无隶属关系。DSH 扩展 API 可能随版本变化。已在 DeepSeek Harness 0.2.2-rc.2 上验证；建议使用 0.2.2-rc.1 或更新版本。
>
> **版本说明**：`package.json` 中的版本号（当前 `0.2.2`）是插件版本，不是宿主版本；清单未声明宿主版本约束，上述兼容性说明仅供参考。

[GitHub 仓库](https://github.com/ailawu0409/dsh-usage-stats) · [发布记录](https://github.com/ailawu0409/dsh-usage-stats/releases) · [问题反馈](https://github.com/ailawu0409/dsh-usage-stats/issues)

[![CI](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml/badge.svg)](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 功能

- **概览指标（3 项）**：累计 Token 数、峰值 Token 数（单日）、最长聊天时长。
- **Token 活动热力图**：GitHub 风格周网格，支持「每日 / 每周 / 累计」三种着色口径。「每日」模式悬停显示日期、Token 与轮次（`2026年10月27日` / `50.6万 tokens · 2 轮消息`）；「每周」显示当周合计，「累计」显示截至当日累计。摘要文案随模式切换（活跃天数 / 活跃周数 / 累计 Token），且只统计网格实际画出的区间。
  - 格子固定为参考设计的 11px，**周数随面板宽度自适应**（最多 53 周，最少 13 周）；摘要文案会写明实际区间，例如「近 8 个月」。
- **每日 Token 趋势图**：按模型分色的平滑折线，支持「近 7 日 / 近 30 日」（含今天共 8 / 31 个点，日期轴最多 8 个标签）；悬停显示竖向参考线、各曲线高亮点，以及当日各模型用量浮层。仅绘制所选区间内用量前 6 的模型，悬停明细也只列这些模型序列；其余模型不单独绘制（在环形图中聚合为「其他模型」）。
- **模型用量**：环形图 + 占比列表（前 5 名 + 其他模型），悬停某段显示该模型 Token 与占比。
- 跟随宿主主题（亮/暗）与官方字体、中英双语、右下角 sticky「刷新」按钮。刷新会触发 Host 对当前列表中所有会话的**全量重扫**，不只是重绘页面。
- 页头只保留标题（宿主设置标题样式 16px）；设置导航通过宿主 0.2.2 的 `settings.section.icon` slot 显示插件自己的柱状图图标（section id `usage-stats`、order 101，位于「归档管理」之后）。
- 错误分三种状态：首次加载且无数据显示整页错误与重试按钮；刷新失败时保留已有数据，仅在顶部显示一条可重试的提示；渲染崩溃由错误边界兜底并提供重试。
- 页面底部说明行汇总：共统计会话数、已不在列表中的保留历史、已跳过会话、命中上限时的截断提示，以及「数据来自本机会话日志」。

## 数据来源与口径

全部数据来自**本机会话日志**（只读，不联网、不上报）；插件唯一写入的是自己的折叠缓存文件。

- 累计 Token：所有 `assistant/message` 的 `usage` 求和（优先取大于 0 的 `totalTokens`，否则 `inputTokens + outputTokens`）。
- 峰值 Token：单日最高用量（按本机时区自然日）。
- 最长聊天时长：单会话内各轮已完成的 `turn/start → turn/end` 时长之和的最大值，避免跨夜空闲被计入。
- 轮次：按 `turn/start` 的**开始日**计数，跨午夜的轮次计在开始那天。
- 模型名称：取 `message.source.model`，回退 `source.provider`，再回退 `unknown`。
- 热力图摘要：只统计网格实际画出的区间，不会把窗口外的历史算进去。
- 去重：fork 会话跳过 `seq < inheritedEventCount` 的继承前缀，避免与父会话重复计数。
- 历史保留：会话被归档、移出存储或永久删除后，其已折叠的用量仍计入累计、峰值、热力图与模型分布；页面底部会注明「其中 N 个会话已不在列表中，历史用量仍计入」。这与 ZCode 的用量账本思路一致：统计不依赖会话列表。
- 失败保留：读取失败或 `migration-required` 的会话不会让累计值回退——若已有上次结果就继续沿用；只有从未统计过的会话才计入「已跳过」。失败会话有 5 分钟冷却，不会每次扫描都重读。
- 会话计数：页面底部的「共统计 N 个会话」包含历史保留的会话，因此可能多于当前存储中的会话数。
- 上限：单次扫描最多读取/折叠 **当前列表中** 20000 个会话；列表更长时页面会显示截断提示。已缓存条目与保留历史仍计入，因此显示的会话数可能超过 20000。
- 全量历史与窗口：累计值、峰值、最长聊天与模型分布都基于**全部**折叠历史；只有发给 Client 的每日明细受约 400 天回看限制（今天 + 前 400 天，最多 401 个日点），足以覆盖 53 周热力图和两个趋势区间。

## 性能与缓存

- 每个会话的折叠结果缓存在 `<profile>/plugin-state/usage-stats-cache.json`；已移除会话的条目会保留（`retiredAt`），因此缓存会随删除缓慢增长。缓存以「临时文件 + rename」原子写入。
- 状态目录按 `DSH_PROFILE_DIR`（测试用它指向临时目录）→ `ctx.baseUrl` 所在目录（若不是插件自身包目录）→ 工作目录依次解析。
- 缓存**仅在插件启动时读入内存一次**，后续扫描不会重新读盘。
- 普通 `getStats` 扫描按持久化层 `revision` 增量：只有变化的会话会被重新读取（`revision` 是官方提供的派生缓存变更令牌）。**刷新**发送 `action: 'refresh'`，会强制全量重读所有列出的会话，并同时绕过 revision 缓存与 5 分钟失败冷却。
- 扫描有边界：最多 4 个并发会话读取、120 秒后中止、并发调用合并为一次扫描；Client 对 Remote 调用设有 60 秒看门狗。
- 插件激活 5 秒后后台预热一次，打开页面通常即为缓存命中。
- 缓存版本变化时自动迁移：v2 缓存会原地升级为 v3，不会触发全量重读；更旧的版本（v1 及未知）与损坏文件才会丢弃重建。
- 如需清空全部历史：**先完全退出 DeepSeek Harness，删除缓存文件，再重启应用**。宿主运行中删除文件不会清掉内存缓存；下一次扫描（尤其是刷新）会把保留历史重新写回。重启后插件会按现存日志重新统计。
- Host 侧失败以 `{ error: { code, message } }` 返回，错误码为 `stats-unavailable`、`scan-failed` 或 `bad-request`。

## 安装

从 GitHub 安装：

```sh
dsh plugin --profile desktop add https://github.com/ailawu0409/dsh-usage-stats
```

也可以使用本地包路径或你 fork 的仓库地址：

```sh
dsh plugin --profile desktop add <包路径或仓库地址>
```

或在本地开发时把包目录加入 profile：

```sh
dsh plugin --profile desktop add /path/to/dsh-usage-stats
```

重启 DeepSeek Harness 后打开 **设置 → 使用统计**（位于「归档管理」下方）。

已在 DeepSeek Harness 0.2.2-rc.2 上验证。建议使用 DeepSeek Harness 0.2.2-rc.1 或更新版本以显示自定义导航图标；更旧的宿主会显示默认设置齿轮，但不会报错。

## 开发

```sh
npm run check       # node --check index.js client.js
npm run test:host   # 仅运行 Host 端测试
npm run test:client # 仅运行 Client 端测试
npm test            # 运行全部测试
npm pack --dry-run  # 检查实际发布内容
```

无第三方运行时依赖；测试使用临时目录与假服务，不会接触真实会话数据。CI 在 ubuntu / windows × Node 22 / 24 上运行 `npm run check` 与 `npm test`，另有 package job 运行 `npm pack --dry-run`。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：扫描会话日志、折叠统计、持久缓存、手写 Remote |
| `client.js` | Client 半：设置页、热力图/折线/环形图、悬停浮层、i18n、导航图标 slot |
| `cordis.patch.yml` | 插件行注册 |
| `locale/*.json` | 插件清单标题与描述 |
| `icon.svg` | 插件图标 |
| `package.json` | 包导出、DSH 插件配置、`files` 清单与开发脚本 |
| `test/host.test.mjs`、`test/client.test.mjs` | Host / Client 测试（仅仓库内） |
| `AGENT.md` | 开发代理指南（中文，仅仓库内） |
| `CONTRIBUTING.md`、`SECURITY.md` | 贡献指南与安全策略（仅仓库内） |
| `.github/workflows/ci.yml` | CI 矩阵与包内容检查（仅仓库内） |

`npm pack --dry-run` 实际发布 10 个文件：`index.js`、`client.js`、`cordis.patch.yml`、`locale/en.json`、`locale/zh.json`、`icon.svg`，以及 npm 自动带入的 `package.json`、`LICENSE`、`README.md`、`README.zh-CN.md`。`AGENT.md`、`CONTRIBUTING.md`、`SECURITY.md`、CI 配置与测试只留在仓库中。

## 已知取舍

- 删除会话不会减少历史累计（有意设计）：这是为了避免「删掉会话后数字变小」的不合理行为。本版本之前已被删除的会话无法恢复（其折叠记录已随旧缓存清理）。
- 清空历史必须完全重启宿主：缓存只在启动时加载，运行中删除缓存文件不会生效。详见「性能与缓存」。
- Token 口径与 ZCode 不同：本插件优先用 `usage.totalTokens`，否则 `inputTokens + outputTokens`；ZCode 的 `computedTotalTokens` 是 `input + cache + output`，两者数值可能不同。
- ZCode 的原始用量明细默认只保留 30 天，本插件保留终身累计，仅每日明细限制为约 400 天回看（今天 + 前 400 天），用于热力图与趋势图。
- 「近 7 日」趋势图绘制 8 个点、「近 30 日」绘制 31 个点（今天 + 之前各天），与参考设计一致；日期轴最多显示 8 个标签。
- 趋势图最多绘制 6 条模型序列（按所选区间内用量排名），其余模型只在环形图的「其他模型」中体现。
- 20000 上限只作用于单次扫描的当前列表会话，不作用于保留历史，因此底部会话数可能更高。
- 设置面板较窄时会减少热力图周数而不是缩小格子，因此窄面板看不到完整一年。
- 设置导航图标通过宿主 0.2.2 提供的 `settings.section.icon` slot 注册（注册 id 与 section id 一致）；0.2.2 之前的宿主没有该入口，会显示默认设置齿轮，但不会报错。
- 0.2.2 起宿主新增德语、西班牙语、法语、日语、葡萄牙语、俄语界面；本插件文案仍只提供中英文，其他语言由宿主回退到英文。

## 贡献与安全

- 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全策略：[SECURITY.md](SECURITY.md)

## 许可

MIT，见 [LICENSE](LICENSE)。
