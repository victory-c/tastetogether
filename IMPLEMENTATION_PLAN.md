# TasteTogether 多 Agent 实施计划

日期：2026-10-30 · 依据：[TasteTogether_PRD.md](TasteTogether_PRD.md) v0.2 · 截止：20:45 PDT（内部目标 19:45 PDT）

本文件定义分层、目录、接口契约、任务拆分与派发规则。**主控（Claude）负责所有决定正确性与安全性的部分；GPT‑6.1 Terra（high，经 `codex exec` CLI）只做边界清晰、契约已固定、出错代价低的部分。** 每个派发任务都有明确的文件所有权，主控审查后才合入。

---

## 0 G0 可行性实测结论（2026-10-30 01:56 PDT，真实 key）

| 项 | 结果 | 对实现的影响 |
| --- | --- | --- |
| Host / 认证 | `https://hackathon.api.qloo.com`，header `X-Api-Key` | 适配器只在服务端读取 `QLOO_API_KEY` |
| 实体查找 | `GET /search?query=…&types=urn:entity:place&take=n` 返回 `entity_id`、`properties.address`、`hours`、`geocode`、`external.resy/google_place` | 手动历史可解析为真实 entity ID；未命中保留 unresolved |
| 推荐 | `GET /v2/insights`，`filter.type=urn:entity:place`、`signal.interests.entities=…`、`filter.tags=urn:tag:genre:place:restaurant` | 每人独立信号各调一次 |
| 地点 | **`filter.location.query=Berkeley, CA` 被解析到 South Carolina，禁止使用**；`filter.location=POINT(-122.2727 37.8716)` + `filter.location.radius=4000`（米）正确 | 区域一律用 WKT 点 + 半径；返回 `query.distance` 为直线距离（米），UI 标注 "straight-line" |
| 价格 | `properties.price_level` 1–4，可能为 null；支持 `filter.price_level.max` | 价格档位硬过滤；null → "Price unverified"，严格预算时进入待确认 |
| 营业时间 | `properties.hours` 按星期列出 `opens/closes`（`T17:00:00`，无时区），`is_closed` | 按 America/Los_Angeles 解释；缺失显示 "Hours unverified" |
| 分数 | `query.affinity` 0–1 | **不跨查询比较原始值**，只在同一次查询内转成名次效用 |
| 补充评估 | `filter.results.entities=<id,id,…>` 可限定结果集，对指定候选按某人信号打分（6/6 返回） | PRD §6.4 的"补充评估"可实现，见 §3 |
| 双方自然重叠 | A（Chez Panisse）20 条 vs B（Cheese Board）40 条，交集仅 1 | 只取交集会假性无结果 → 必须做补充评估 |
| 延迟 | 单次 insights ≈ 0.9 s | 30 s 预算充裕；仍设 8 s 超时 + 1 次重试 |

结论：G0 通过，继续比赛冲刺。

---

## 1 技术栈（实现选择）

- **Next.js（App Router）+ TypeScript strict**，前后端一体，部署 Vercel。
- **数据库：libSQL（`@libsql/client`）**：本地 `file:./data/local.db`，线上 Turso `libsql://…`；同一份 SQL 与代码。手写 SQL 迁移，避免 ORM 生成步骤。
- **校验：zod**（所有 API 入参与 Qloo 响应映射）。
- **测试：vitest**（领域纯函数 + 适配器 mock + 路由权限）。
- **样式：Tailwind CSS**。
- **LLM：可选**。设 `ANTHROPIC_API_KEY` 时仅用于对已排序的结构化事实生成英文解释；未设或失败 → 事实模板降级（PRD §10）。排序永远不由 LLM 决定。
- **会话：匿名、服务端签发的 HMAC 签名 cookie**（`SESSION_SECRET`），一个浏览器 = 一个用户。

---

## 2 分层架构

```
┌──────────────────────────────────────────────────────────────┐
│ L5  UI（src/app/(pages)、src/components）  只调 L4 HTTP API    │  ← GPT（按契约）
│     所有文案取自 src/copy/en.ts                               │
├──────────────────────────────────────────────────────────────┤
│ L4  HTTP 路由（src/app/api/**/route.ts）                      │  ← 主控写模板与敏感路由
│     解析 zod → 取会话 → 调 L3 → 映射为英文错误                  │     GPT 写同构 CRUD 路由
├──────────────────────────────────────────────────────────────┤
│ L3  服务/编排（src/server/services）                          │  ← 主控
│     recommend（协调流程 + 状态机）、sessions、memories、feedback│
├───────────────┬───────────────────────┬──────────────────────┤
│ L2a 持久化     │ L2b Qloo 适配器        │ L2c LLM 适配器        │
│ src/server/db  │ src/server/qloo        │ src/server/llm        │  ← 主控（GPT 补 fixtures）
│ 仓储 + 所有权校验│ 超时/重试/预算/映射     │ 受限解释 + 模板降级     │
├───────────────┴───────────────────────┴──────────────────────┤
│ L1  领域纯函数（src/domain）无 I/O                             │  ← 主控
│     types、hardFilter、novelty、ranking、decision、validate     │
└──────────────────────────────────────────────────────────────┘
```

依赖方向只能向下：L1 不 import 任何其他层；L2 只 import L1；L5 只通过 `fetch('/api/…')` 与 `src/lib/api-types.ts` 中的共享类型交互，**不得 import `src/server/**`**（防止密钥进入浏览器包，用 `import 'server-only'` 强制）。

### 目录结构

```
src/
  domain/            L1  types.ts filters.ts ranking.ts decision.ts hours.ts validate.ts  (+ *.test.ts)
  server/
    auth/session.ts  L2  签名 cookie、getCurrentUser()
    db/              L2  client.ts migrate.ts migrations/001_init.sql repos/*.ts
    qloo/            L2  client.ts map.ts types.ts fixtures/*.json
    llm/             L2  explain.ts templates.ts
    services/        L3  recommend.ts sessions.ts memories.ts feedback.ts demo.ts
    http.ts          L4  路由公共工具：json()、errors、withUser()
  app/
    api/**/route.ts  L4
    page.tsx …       L5
  components/        L5
  copy/en.ts         L5  全部用户可见英文文案（集中管理）
  lib/api-types.ts   L4/L5 共享的请求/响应类型（无 server 依赖）
scripts/ setup-qloo.sh, seed-demo.ts, qloo-smoke.ts
```

---

## 3 协调与排序算法（P0，主控实现，可复现）

输入：参与者 P ∈ {A} 或 {A,B}，约束 C（中心点、半径、价格上限、禁忌标签、时间窗口、场景、决策模式、新鲜度开关），本次否决集合 R。

1. **约束校验**：缺中心点/半径 → `needs_clarification`。用户写了精确人均（如 "$30 per person"）→ 保留原文 `budget_note`，筛选只用价格档位，并加入 `conditions_to_confirm`。
2. **授权视图**：每个参与者只导出 `{positive_entity_ids, excluded_tags, price_preference, visited_place_ids, has_unresolved}`，不导出完整历史。
3. **发现（discover）**：对每个 p 调一次 insights（p 自己的正向实体、地点、餐厅标签、价格上限、take=30）。
4. **合并**：候选并集 U，按 entity_id 去重。
5. **硬过滤**（`domain/filters.ts`）：距离 > 半径、已知价格档位 > 上限、命中任一方禁忌标签、`is_closed`、新鲜度开启时 ∈ visited_A ∪ visited_B、∈ R、∈ dismissed。每个被排除候选记录原因（用于 no_match 说明）。
6. **补充评估（score）**：两人模式下，对每个 p 调一次 insights，`filter.results.entities = U'`（过滤后的候选，按 25 个分块），得到 p 对 U' 每个候选的 affinity —— **同一 p 的所有分数来自同一查询，可在 p 内部比较**。
7. **名次效用**：对每个 p，把 U' 按该 p 的 affinity 降序，`u_p = 1 - rank/(n-1)`（n=1 时 u=1）。某候选某人无分数 → 不虚构，移出共同排序，记入 `evidence.missing_scores`。
8. **排序**：主键 `min(uA,uB)` 降序；次键 `(uA+uB)/2`；再按直线距离升序；最后 entity_id 保证确定性。单人模式 `u = uA`。
9. **有界扩展**：合格候选 < 需要数（三选=3、拍板=1）时，发现阶段 take=60 且半径 ×1.5 **仅在用户已允许扩大范围时**；否则只做一次 take=60 不改约束的重试。
10. **决策模式**：`three` → 至多 3 家，不足如实返回；`pick` → 1 家首选 + 保留 `try_another`。
11. **状态**：`success | needs_clarification | no_match | provider_unavailable`；`no_match` 附 `relaxation_options`（`expand_radius | raise_price | allow_revisits`），只能由用户显式选择后生效。
12. **解释**：结构化 evidence →（可选 LLM）英文理由 → `validate.ts` 校验：理由里出现的餐厅名必须 ∈ 结果集，不得出现分钟数/美元金额等未提供事实，否则回落模板。

`RecommendationRun` 记录 `profile_versions`、`constraint_version`、provider 请求摘要（脱敏）、候选、证据、结果。会话约束或任一方档案版本变化 → 旧 run `stale=true`。

---

## 4 数据模型（SQL 迁移 001，主控）

`users(id, created_at)` · `profiles(id, owner_id UNIQUE, display_name, center_lat, center_lon, radius_m, price_max, excluded_tags JSON, positive_entities JSON, is_demo, version, updated_at)` · `memories(id, profile_id, place_id NULL, unresolved_name NULL, name, address, status CHECK in visited/want_to_try/dismissed, visit_date NULL, visit_count NULL, rating NULL CHECK in liked/neutral/disliked, revisit_intent NULL, source, created_at, updated_at)` · `match_sessions(id, owner_id, invite_token_hash, participant_a, participant_b NULL, consent_b, constraints JSON, decision_mode, novelty_both_unvisited, state, version, expires_at, revoked)` · `recommendation_runs(id, session_id NULL, owner_id, idempotency_key UNIQUE, profile_versions JSON, constraint_version, provider_refs JSON, candidate_ids JSON, evidence JSON, result JSON, status, stale, created_at)` · `feedback(id, run_id, profile_id, place_id, kind CHECK in selected/dismissed/visited, rating, revisit_intent, reason, created_at)`。

规则：访问者只能读写 `profiles.owner_id = me` 的档案与其 memories；房间只有 A/B 两位参与者可读；`dismissed`（本次否决）写入 run 的排除集，不写 memories；只有 `POST /api/feedback kind=visited` 会创建 `visited` 记忆，且只写调用者自己的档案。

---

## 5 任务拆分与归属

图例：🟣 主控（Claude）亲自完成 · 🟢 GPT‑6.1 Terra high 派发 · 🔍 主控审查

### Wave 0 — 骨架（🟣，串行，其他一切的前提）
- W0.1 Next.js + TS + Tailwind + vitest + zod + libsql 脚手架、`tsconfig` 路径别名、`npm scripts`。
- W0.2 `src/domain/types.ts`、`src/lib/api-types.ts`：全部共享类型（契约冻结点）。
- W0.3 `src/copy/en.ts` 文案键骨架。

### Wave 1 — 核心（🟣）
- W1.1 `domain/filters.ts` `ranking.ts` `decision.ts` `hours.ts` `validate.ts` + 关键测试。
- W1.2 `server/qloo/*`：client（超时 8s、1 次重试、进程内调用预算）、zod 映射、search/discover/score。
- W1.3 `server/db/*`：迁移、client、带所有权校验的 repos。
- W1.4 `server/auth/session.ts`、`server/http.ts`。
- W1.5 `server/services/recommend.ts`（§3 全流程）、`sessions.ts`（邀请 token 只存 hash、过期、撤销、版本递增使旧 run 过期）、`feedback.ts`。
- W1.6 敏感路由：`/api/sessions/**`、`/api/recommendations`、`/api/feedback`，以及一条 CRUD 示范路由 `/api/profiles`（GPT 照此写其余路由）。

### Wave 2 — 派发（🟢，可并行，文件所有权互不重叠）
| ID | 任务 | 只能修改的文件 | 完成定义 |
| --- | --- | --- | --- |
| T1 | memories / places 搜索 CRUD 路由（照 `/api/profiles` 模式） | `src/app/api/memories/**`、`src/app/api/places/**` | 调用现有 service/repo；不得新增 SQL；`npm run typecheck` 通过 |
| T2 | Qloo 测试 fixtures + 适配器/排序的 mock 测试（不足三家、零候选、超时、price null、hours 缺失、unresolved） | `src/server/qloo/fixtures/**`、`tests/**` | `npm test` 全绿；fixtures 只用于测试 |
| T3 | 示例档案 seed 数据（两个明确标注 "Sample" 的虚构人物，真实 Berkeley entity ID 由主控给出）+ `/api/demo` 调用方 UI 按钮 | `src/server/services/demo-data.ts` | 只含虚构资料、全英文 |
| T4 | UI：首页、My Taste（偏好 + 历史列表 + 搜索添加 + 编辑删除 + unresolved 提示） | `src/app/page.tsx`、`src/app/taste/**`、`src/components/taste/**` | 只用 `api-types.ts` 与 `copy/en.ts`；无中文；移动端可用 |
| T5 | UI：约饭房间、邀请加入页、结果卡片、换一家、反馈 | `src/app/room/**`、`src/app/join/**`、`src/components/room/**` | 按 status 渲染四种状态；三选/拍板；不展示对方历史 |
| T6 | README（英文）、LICENSE（MIT）、`.env.example` 补全、手动双浏览器测试步骤 | `README.md`、`LICENSE`、`.env.example`、`docs/TESTING.md` | 从干净环境可运行 |

派发规则（写进每个 prompt）：
1. 只改所有权列表内的文件；需要改契约时停下并在最终消息里说明，而不是修改 `src/domain`、`src/server`、`src/lib/api-types.ts`。
2. 不安装依赖、不运行 git 写操作、不访问网络（真实 Qloo 由主控测）。
3. 所有用户可见文本为英文，取自或新增到 `src/copy/en.ts` 中本任务专属的命名空间段落（T4 用 `taste.*`、T5 用 `room.*`）。
4. 结束前运行 `npm run typecheck` 与 `npm test`，在最终消息中报告结果和改动文件列表。
5. 命令：`codex exec -m gpt-6.1-terra -c model_reasoning_effort=high -s workspace-write -C <repo> -o logs/<T>.md "<prompt>"`，日志写入被 gitignore 的 `logs/`。

### Wave 3 — 集成与验证（🟣 + 🔍）
- 逐个审查 Wave 2 diff（契约、所有权、权限、英文文案、无编造事实）。
- 全量 `typecheck`、`test`、`build`；真实 Qloo 冒烟（`scripts/qloo-smoke.ts`）：A、B、A+B 三种档案对照。
- 双浏览器端到端：创建房间 → 加入 → 改 B 约束使旧 run 过期 → 生成 → 换一家 → 确认到访。
- 中文浏览器环境下检查无中文残留（`grep -P '[\x{4e00}-\x{9fff}]' src/` 应只命中注释为零）。
- 对抗式审查：权限越权、密钥泄漏、状态误渲染为成功。

### Wave 4 — 部署与提交（需 Victor 授权）
Turso 数据库 + Vercel 环境变量（`QLOO_API_KEY`、`QLOO_API_URL`、`DATABASE_URL`、`DATABASE_AUTH_TOKEN`、`SESSION_SECRET`、可选 `ANTHROPIC_API_KEY`）→ 部署 → 无痕窗口验收 → 公开仓库 → Devpost。部署平台账号操作、公开仓库、Devpost 提交前需 Victor 确认。

---

## 6 风险与停止条件

| 风险 | 缓解 |
| --- | --- |
| 双方候选交集小 | §3.6 补充评估；仍不足则 `no_match` + 放宽选项，不凑数 |
| `filter.location.query` 误解析 | 只用 POINT + radius |
| 公开 demo 耗尽配额 | 每进程/每用户调用预算、每 run ≤ 6 次 Qloo 调用、幂等键 |
| GPT 改动越界 | 文件所有权 + 主控 diff 审查；越界改动直接回退 |
| 无 LLM key | 模板解释为默认路径，LLM 为增强 |
| 营业时间无时区 | 固定按 America/Los_Angeles 解释并标注 |

PRD §12 的停止条件不变：不能砍真实 Qloo、双人条件、历史排除和公开可用性来宣称完成。
