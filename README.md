# 股票模拟交易系统 · 开发计划

> 基于 [股票模拟交易系统编程题目.md](./股票模拟交易系统编程题目.md) 的三天交付计划。

---

## 一、项目目录结构（单 Git 仓库）

```
stock-trading/
├── README.md                      ← 本文件（整体规划）
├── docker-compose.yml             ← 一键启动三服务
├── stock-trading-frontend/        ← 子项目 1：前端
├── stock-trading-backend/         ← 子项目 2：后端
└── stock-trading-realtime/        ← 子项目 3：实时通信
```

| # | 子项目目录 | 技术栈 | 端口 | 职责 |
|---|---|---|---|---|
| 1 | **stock-trading-frontend/** | Vue 3 + TS + Vite + Pinia | 5173 | 纯前端 UI，不含业务逻辑 |
| 2 | **stock-trading-backend/** | Node.js + Express + TS | 3000 | REST API、撮合引擎、内存数据管理 |
| 3 | **stock-trading-realtime/** | Node.js + ws + TS | 3001 | WebSocket 推送：行情广播 + 事件推送 |

### 子项目间通信关系

```
┌──────────────────────┐     HTTP REST      ┌──────────────────────┐
│  stock-trading-      │ ◄────────────────── │  stock-trading-      │
│  frontend  :5173     │ ──────────────────► │  backend     :3000   │
│                      │                     │                      │
│  WebSocket           │                     │  撮合后 POST 事件     │
│  ◄─────────────────  │                     │  ──────────────────► │
└──────────────────────┘                     └──────────────────────┘
         │                                            │
         │        WebSocket (ws://localhost:3001)      │
         └────────────────────────────────────────────┘
                              │
                     ┌──────────────────────┐
                     │  stock-trading-      │
                     │  realtime    :3001   │
                     │                      │
                     │  · 每秒行情 tick      │
                     │  · 接收后端事件推送    │
                     │  · 广播给所有客户端    │
                     └──────────────────────┘
```

- **前端 → 后端**：HTTP REST（登录、注册、下单、查询）
- **后端 → 实时服务**：内部 HTTP POST（撮合/委托变更事件）
- **实时服务 → 前端**：WebSocket 长连接（行情推送 + 用户事件推送）

---

## 二、功能模块清单

| 模块 | 所属子项目 | 必做/加分 | 说明 |
|---|---|---|---|
| 登录 / 注册 | frontend + backend | 必做 | 内存存储，无数据库 |
| 行情看板（≥3 支股票） | frontend + realtime | 必做 | 每秒随机波动 |
| 交易面板（买入/卖出） | frontend + backend | 必做 | 限价单委托 |
| 委托列表（未成交/已成交） | frontend + backend | 必做 | 实时更新 |
| 持仓列表 | frontend + backend | 必做 | 实时更新 |
| 成交记录 | frontend + backend | 必做 | 最近成交展示 |
| 撮合引擎 | backend | 必做 | 价格优先、时间优先 |
| WebSocket 实时推送 | realtime + frontend | 必做 | 行情 + 用户事件 |
| WebSocket 断线重连 | frontend + realtime | 加分 | 重连后状态同步 |
| 撮合引擎单元测试 | backend | 加分 | Vitest，覆盖核心 case |
| Docker 一键启动 | 根目录 | 加分 | docker-compose.yml |

---

## 三、三天开发排期

### Day 1（搭建骨架 + 后端核心）

**上午：项目初始化**
- [ ] 创建统一 Git 仓库，建立三个子项目目录
- [ ] 各子项目初始化 TS + 依赖 + 基础配置
- [ ] 定义共享类型（股票、委托、成交、用户等 interface）

**下午：后端撮合引擎 + REST API**
- [ ] 实现内存用户管理（注册/登录，初始资金 100 万）
- [ ] 实现内存撮合引擎（价格优先、时间优先）
- [ ] 实现 REST API：登录、注册、下单、撤单（可选）、查询委托/持仓/成交
- [ ] 后端通过 HTTP POST 向实时服务推送事件
- [ ] Postman / curl 自测所有 API

**晚上：实时服务骨架**
- [x] 搭建 WebSocket 服务
- [x] 实现行情数据生成（5 支股票，每秒随机波动）
- [x] 实现行情广播（所有连接客户端）
- [x] 实现接收后端事件并推送给对应用户
- [x] 实现断线重连状态同步（resync）

---

### Day 2（前端全貌 + 实时联调）

**上午：前端路由与页面骨架**
- [ ] Vite + Vue 3 + TS 项目初始化
- [ ] Vue Router 路由配置（登录/注册/主面板）
- [ ] Pinia 状态管理（用户、行情、委托、持仓）
- [ ] 登录/注册页面

**下午：行情看板 + 交易面板**
- [ ] 行情看板组件（股票列表，实时价格/涨跌幅）
- [ ] WebSocket 客户端（连接实时服务，接收行情推送）
- [ ] 交易面板组件（选股、价格、数量、买入/卖出）
- [ ] 委托列表 + 持仓列表组件
- [ ] 成交记录组件

**晚上：前后端联调**
- [ ] 前端 → 后端 REST API 联调（登录/注册/下单）
- [ ] 前端 → 实时服务 WebSocket 联调（行情 + 事件推送）
- [ ] 完整交易闭环测试（注册→登录→买入→撮合→持仓更新→卖出）
- [ ] 修复联调中发现的 Bug

---

### Day 3（测试 + Docker + 收尾）

**上午：测试与加分项**
- [ ] 撮合引擎单元测试（价格优先、时间优先、部分成交）
- [ ] WebSocket 断线重连（前端自动重连 + 重连后状态同步）
- [ ] 边缘 case 验证（余额不足、股票不存在、数量为零等）

**下午：Docker + README**
- [ ] 各子项目编写 Dockerfile
- [ ] 根目录编写 docker-compose.yml（一键启动三服务）
- [ ] 主 README.md 完善（启动步骤、架构决策）
- [ ] 整理关键 Prompt 记录（3~5 条）

**晚上：最终验收**
- [ ] 按 README 步骤从零启动验证（clone → install → run）
- [ ] 全流程烟雾测试
- [ ] 代码审查与清理
- [ ] 提交交付物

---

## 四、各子项目详细规划

| 子项目 | 规划文档 | 状态 |
|---|---|---|
| stock-trading-frontend | [PLAN.md](./stock-trading-frontend/PLAN.md) | 待开发 |
| stock-trading-backend | [PLAN.md](./stock-trading-backend/PLAN.md) | 待开发 |
| stock-trading-realtime | [PLAN.md](./stock-trading-realtime/PLAN.md) | ✅ 已完成 |

---

## 五、关键架构决策

1. **三子项目拆分而非单体**：题目要求明确区分前后端和实时通信。将 WebSocket 从后端剥离为独立子项目，职责单一，各自可独立开发、测试。放在同一 Git 仓库下便于协同管理，docker-compose 统一编排。后端与实时服务通过内部 HTTP 通信，不会相互阻塞。

2. **内存撮合引擎而非数据库**：题目明确不要求持久化。使用纯内存的 OrderBook + Map 结构实现撮合，零外部依赖，启动即用。撮合逻辑集中在一个模块内，方便单元测试。

3. **前端状态管理用 Pinia + WebSocket 驱动**：行情和用户事件全部通过 WebSocket 推送驱动 Pinia store 更新，组件仅消费 store 状态。避免轮询，保证 UI 实时性。REST API 仅用于写操作（下单等）。

---

## 六、Prompt 记录模板

```
### Prompt X：场景描述
- **场景**：当时在做什么
- **问题**：遇到的具体问题
- **Prompt**：发给 AI 的原始 prompt
- **AI 回复**：AI 给了什么
- **我的调整**：审查后发现什么问题，做了什么修改
```

---

## 七、stock-trading-realtime 技术实现

### 目录结构
```
stock-trading-realtime/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts                  # 入口：启动 HTTP + WebSocket 服务（端口 3001）
│   ├── types/
│   │   └── index.ts              # 类型定义（StockQuote, Order, Position, Trade）
│   ├── market/
│   │   └── generator.ts          # 行情生成器（每秒 ±0.5% 随机波动）
│   ├── ws/
│   │   ├── server.ts             # WebSocket 服务端（连接管理 + 广播）
│   │   └── protocols.ts          # 消息协议定义（subscribe / resync / ping）
│   └── routes/
│       └── internal.ts           # 内部 HTTP 接口（/internal/event + /internal/health）
```

### 消息协议

**服务端 → 客户端：**
| type | 说明 |
|------|------|
| `quote` | 单支股票行情（每秒逐支广播） |
| `quotes` | 全部股票行情（首次订阅时发送） |
| `order` | 委托更新（后端撮合后推送） |
| `position` | 持仓更新（后端撮合后推送） |
| `trade` | 成交记录（后端撮合后推送） |
| `sync` | 全量状态同步（重连后 resync） |
| `pong` | 心跳响应 |

**客户端 → 服务端：**
| type | 说明 |
|------|------|
| `subscribe` | 订阅用户频道 `{ userId: string }` |
| `resync` | 请求全量同步 `{ userId: string }` |
| `ping` | 心跳 |

### 启动方式
```bash
cd stock-trading-realtime
npm install
npm run dev    # 开发模式（热重载）
npm start      # 生产模式
```