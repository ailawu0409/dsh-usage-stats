# dsh-usage-stats · 使用统计

DeepSeek Harness 的设置面板插件：在「设置 → 使用统计」中展示本机会话的 Token 用量、活跃情况、聊天时长与模型分布。

> 非官方插件，与 DeepSeek 官方无隶属关系。DSH 扩展 API 可能随版本变化。当前适配 DeepSeek Harness 0.2.2-rc.1。

[GitHub 仓库](https://github.com/ailawu0409/dsh-usage-stats) · [问题反馈](https://github.com/ailawu0409/dsh-usage-stats/issues)

[![CI](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml/badge.svg)](https://github.com/ailawu0409/dsh-usage-stats/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 功能

- **概览指标（3 项）**：累计 Token 数、峰值 Token 数（单日）、最长聊天时长。
- **Token 活动热力图**：GitHub 风格周网格，支持「每日 / 每周 / 累计」三种着色口径；悬停单元格显示日期、Token 与轮次（`2026年10月27日` / `50.6万 tokens · 2 轮消息`）。
  - 格子固定为参考设计的 11px，**周数随面板宽度自适应**（最多 53 周，最少 13 周）；摘要文案会写明实际区间，例如「近 8 个月活跃 2 天」。
- **每日 Token 趋势图**：按模型分色的平滑折线，支持「近 7 日 / 近 30 日」；悬停显示竖向参考线、各曲线高亮点，以及当日各模型用量浮层。
- **模型用量**：环形图 + 占比列表（前 5 名 + 其他模型），悬停某段显示该模型 Token 与占比。
- 跟随宿主主题（亮/暗）与官方字体、中英双语、右下角「刷新」重新统计。
- 页头只保留标题（宿主设置标题样式 16px）；设置导航通过宿主 0.2.2 的 `settings.section.icon` slot 显示插件自己的柱状图图标。
- 刷新失败时保留已有数据，仅在顶部显示一条可重试的提示。

## 数据来源与口径

全部数据来自**本机会话日志**（只读，不联网、不上报）：

- 累计 Token：所有 `assistant/message` 的 `usage` 求和（`totalTokens` 优先，否则 `inputTokens + outputTokens`）。
- 峰值 Token：单日最高用量（按本机时区自然日）。
- 最长聊天时长：单会话内各轮次 `turn/start → turn/end` 时长之和的最大值，避免跨夜空闲被计入。
- 轮次：按 `turn/start` 的**开始日**计数，跨午夜的轮次计在开始那天。
- 热力图摘要：只统计网格实际画出的区间，不会把窗口外的历史算进去。
- 去重：fork 会话跳过 `seq < inheritedEventCount` 的继承前缀，避免与父会话重复计数。
- 历史保留：会话被归档、移出存储或永久删除后，其已折叠的用量仍计入累计、峰值、热力图与模型分布；页面底部会注明「其中 N 个会话已不在列表中」。这与 ZCode 的用量账本思路一致：统计不依赖会话列表。
- 失败保留：读取失败或 `migration-required` 的会话不会让累计值回退——若已有上次结果就继续沿用；只有从未统计过的会话才计入「已跳过」。失败会话有 5 分钟冷却，不会每次扫描都重读。
- 会话计数：页面底部的「共统计 N 个会话」包含历史保留的会话，因此可能多于当前存储中的会话数。
- 上限：最多统计 20000 个会话，超出时页面会注明。

## 性能与缓存

- 每个会话的折叠结果缓存在 `<profile>/plugin-state/usage-stats-cache.json`；已移除会话的条目会保留（`retiredAt`），因此缓存会随删除缓慢增长。
- 之后按持久化层 `revision` 增量：只有变化的会话会被重新读取（`revision` 是官方提供的派生缓存变更令牌）。
- 插件激活 5 秒后后台预热一次，打开页面通常即为缓存命中。
- 缓存版本变化时自动迁移：v2 缓存会原地升级为 v3，不会触发全量重读；更旧的版本（v1 及未知）才会丢弃重建。
- 如需清空全部历史（例如想从零开始），删除缓存文件后刷新即可，插件会按现存日志重新统计。

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

## 开发

```sh
npm run check   # node --check index.js client.js
npm test        # host + client 测试
npm pack --dry-run
```

无第三方运行时依赖；测试使用临时目录与假服务，不会接触真实会话数据。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：扫描会话日志、折叠统计、持久缓存、手写 Remote |
| `client.js` | Client 半：设置页、热力图/折线/环形图、悬停浮层、i18n、导航图标 slot |
| `cordis.patch.yml` | 插件行注册 |
| `locale/*.json` | 插件清单标题与描述 |
| `icon.svg` | 插件图标 |
| `test/*.mjs` | Host / Client 测试 |

## 已知取舍

- 删除会话不会减少历史累计（有意设计）：这是为了避免「删掉会话后数字变小」的不合理行为。本版本之前已被删除的会话无法恢复（其折叠记录已随旧缓存清理）。
- Token 口径与 ZCode 不同：本插件优先用 `usage.totalTokens`，否则 `inputTokens + outputTokens`；ZCode 的 `computedTotalTokens` 是 `input + cache + output`，两者数值可能不同。
- ZCode 的原始用量明细默认只保留 30 天，本插件保留终身累计，仅每日明细窗口限制为 400 天（用于热力图/趋势）。
- 「近 7 日」趋势图实际绘制 8 个点（今天 + 前 7 天），与参考设计一致。
- 设置面板较窄时会减少热力图周数而不是缩小格子，因此窄面板看不到完整一年。
- 设置导航图标通过宿主 0.2.2 提供的 `settings.section.icon` slot 注册（注册 id 与 section id 一致）；0.2.2 之前的宿主没有该入口，会显示默认设置齿轮，但不会报错。
- 0.2.2 起宿主新增德语、西班牙语、法语、日语、葡萄牙语、俄语界面；本插件文案仍只提供中英文，其他语言由宿主回退到英文。

## 许可

MIT，见 [LICENSE](LICENSE)。
