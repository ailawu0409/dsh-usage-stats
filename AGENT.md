# AGENT.md

本文件面向在本仓库中工作的开发代理，适用于整个项目。本文件本身就是中文版本（仓库内没有单独的 `AGENT.zh-CN.md` 或英文版）；面向用户的文档是英文 `README.md` 与中文 `README.zh-CN.md`。

## 项目概述

dsh-usage-stats 是一个非官方的 DeepSeek Harness 设置面板插件，在「设置 → 使用统计」中展示本机会话的 Token 用量、活跃情况、聊天时长和模型分布。

插件只读取本机会话日志，不联网、不上报；唯一写入是自己的折叠缓存文件。修改时必须保持这一隐私边界。

## 技术约束

- 使用 JavaScript ES Modules，Node.js 版本要求为 >= 22（CI 覆盖 Node 22 / 24）。
- 不引入第三方运行时依赖，除非用户明确要求。
- Host 与 Client 分端实现，避免在 Client 中直接访问文件系统或会话日志。
- DeepSeek Harness 扩展 API 可能随宿主版本变化，修改集成逻辑时应保持现有兼容方式；当前适配 0.2.2-rc.3（0.2.2-rc.2 → rc.3 没有影响本插件所用接口的变化），`package.json` 未声明宿主版本约束。
- 图表和界面使用项目现有实现（React + 手写 CSS/SVG），不为了局部改动引入新的框架或构建流程。
- 插件版本号在 `package.json`，与宿主版本号无关；文档中不要把两者混为一谈。

## 目录与职责

| 路径 | 职责 | 随 npm 包发布 |
| --- | --- | --- |
| `index.js` | Host 端：扫描会话、聚合统计、增量缓存和 Remote 服务 | ✓ |
| `client.js` | Client 端：设置页、图表、交互、主题和国际化 | ✓ |
| `cordis.patch.yml` | 插件行注册 | ✓ |
| `locale/en.json`、`locale/zh.json` | 插件清单的中英文标题与描述 | ✓ |
| `icon.svg` | 插件图标 | ✓ |
| `package.json` | 包导出、DSH 插件配置、`files` 清单和开发脚本 | ✓ |
| `README.md`、`README.zh-CN.md` | 功能、统计口径、安装和开发说明（英文 / 中文） | ✓ |
| `LICENSE` | MIT 许可 | ✓ |
| `test/host.test.mjs` | Host 端统计、缓存、失败处理与迁移测试 | — |
| `test/client.test.mjs` | Client 端界面、图表、文案与交互测试 | — |
| `AGENT.md` | 本文件：开发代理指南（中文） | — |
| `CONTRIBUTING.md` | 贡献指南 | — |
| `SECURITY.md` | 安全策略与隐私边界 | — |
| `.github/workflows/ci.yml` | CI：ubuntu/windows × Node 22/24 的语法检查与测试，以及 package 内容检查 | — |
| `.gitignore` | 忽略 node_modules、tgz 与 plugin-state | — |

`npm pack --dry-run` 实际发布 10 个文件：`package.json` 的 `files` 清单中的 6 个（`index.js`、`client.js`、`cordis.patch.yml`、`locale/en.json`、`locale/zh.json`、`icon.svg`），加上 npm 自动带入的 `package.json`、`LICENSE`、`README.md`、`README.zh-CN.md`。仓库级文档、CI 与测试不随包发布。

## 接口契约

改动集成逻辑前先确认这些约定，改一处就要同步检查另一端：

| 位置 | 约定 |
| --- | --- |
| Host `inject` | `['typert']` |
| Host 依赖 | `sessionQuery.readSession(id)`（优先）、`sessionPersistence.list()` / `.open(id, 'read')`（回退）、`logger`、`typert.register()` |
| Host 提供 | `ctx.provide('usageStats', { command })`；Typert invocation id 为 `dsh-usage-stats#usageStats/command` |
| Remote 请求 | `{ action: 'getStats', force?: boolean }` 走增量；`{ action: 'refresh' }` 强制全量重读；非法请求返回 `bad-request` |
| Remote 返回 | `{ stats }`，或 `{ error: { code, message } }`（`bad-request`、`stats-unavailable`、`scan-failed`） |
| Client `inject` | `['slots', 'locale', 'remote', 'typert']`；`package.json` 的 `dsh.client.inject` 另外声明宿主 UI 包 |
| Client Remote | `ctx.remote.$mount()` 注册 `dsh-usage-stats#usageStats/command`（strict codec），通过 `ctx.get('remote.usageStats').command()` 调用，并有 60 秒看门狗 |
| Slots | `settings.section`（id `usage-stats`、order 101、locale `usage-stats`）与 `settings.section.icon`（**同一 id**）；`inject()` 返回 `actions` 与 `hooks: { stats, colorScheme, locale }`，宿主转成 `useStats` / `useColorScheme` / `useLocale` 传给组件 |
| 主题 | `ctx.get('theme').getTheme().active.colorScheme` 加 `theme/change` 事件，取不到时回退 light |
| 国际化 | `ctx.locale.register('usage-stats', { zh, en })` + `ctx.locale.bind('usage-stats')`；`zh` 前缀判定中文，其余语言由宿主回退英文 |

## 常用命令

```sh
npm run check       # node --check index.js && node --check client.js
npm run test:host   # 运行 Host 端测试
npm run test:client # 运行 Client 端测试
npm test            # 运行全部测试
npm pack --dry-run  # 检查实际发布内容
```

CI 在 ubuntu/windows × Node 22/24 上运行 `npm run check` 与 `npm test`，另有 package job 运行 `npm pack --dry-run`。修改代码后至少运行 `npm run check` 和与改动端对应的测试；无法确定影响范围时运行 `npm test`。涉及发布文件、导出或插件清单时，再运行 `npm pack --dry-run`。

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
- 不将 Host 专属 API、Node.js 内置模块或文件系统访问带入 Client。
- 宿主 0.2.2 起提供 `settings.section.icon` slot；`client.js` 用与 `settings.section` 相同的 id 注册柱状图图标，不修改宿主 DOM。宿主未提供该 slot 时保留默认齿轮且不报错。

## 验证要求

完成修改前检查：

1. 语法检查和相关测试通过，CI 矩阵（ubuntu/windows × Node 22/24）与 package job 对应的检查均通过。
2. 新增或改变的行为有对应测试。
3. 用户可见文案的中英文保持一致，两份 README 的章节、数值、口径与文件清单一致。
4. 统计口径、缓存、发布清单和隐私边界没有意外变化。
5. 文档与最终实现一致（包括缓存清空流程、上限口径、回看窗口等容易写错的细节）。
6. 工作区只包含本任务需要的改动。

如果检查无法运行或失败，应在最终回复中明确说明原因，不要声称已经验证。
