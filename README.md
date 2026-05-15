# 股票模拟交易系统 · 开发计划

> 基于 [股票模拟交易系统编程题目.md](./股票模拟交易系统编程题目.md) 的三天交付计划。

---

## 一、项目目录结构（单 Git 仓库）

```
stock-trading/
├── README.md                      ← 本文件（整体规划）
├── start.bat                      ← 一键环境检查 & 启动脚本
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
- **实时服务 → 前端**：WebSocket 长连接（聚合CSV回放行情 + 用户事件推送）
- **行情数据源**：聚合CSV `intraday_aggregated.csv`（23个标的按时间戳对齐），替代随机游走生成
- **时间同步**：`quotes` 消息携带 `timestamp` 字段，前端基于此同步显示时间

---

## 快速启动（一键脚本）

**Windows 用户双击根目录下的 `start.bat`** 即可自动完成以下全部步骤：

1. 检查 Node.js / npm / Python 运行环境
2. 自动安装三个子项目的 npm 依赖（首次运行时）
3. 依次在独立命令行窗口启动三个服务

脚本会依次打开三个窗口：

| 窗口标题 | 服务 | 端口 | 命令 |
|---|---|---|---|
| `Backend :3000` | stock-trading-backend | 3000 | `npm run dev` |
| `Realtime :3001` | stock-trading-realtime | 3001 | `npm run dev` |
| `Frontend :5173` | stock-trading-frontend | 5173 | `npm run dev` |

启动后在浏览器访问 **http://localhost:5173** 即可使用。

关闭 `start.bat` 的主窗口不影响已启动的服务，各服务窗口可独立关闭。

### 手动启动（备选）

```bash
# 终端 1：后端
cd stock-trading-backend && npm install && npm run dev

# 终端 2：实时服务
cd stock-trading-realtime && npm install && npm run dev

# 终端 3：前端
cd stock-trading-frontend && npm install && npm run dev
```

---

## 二、功能模块清单

| 模块 | 所属子项目 | 必做/加分 | 说明 |
|---|---|---|---|
| 登录 / 注册 | frontend + backend | 必做 | 内存存储，无数据库 |
| 行情看板（20 支股票 + 3 个指数） | frontend + realtime | 必做 | 每秒随机波动 |
| 交易面板（买入/卖出） | frontend + backend | 必做 | 限价单委托 |
| 委托列表（未成交/已成交） | frontend + backend | 必做 | 实时更新，支持撤单 |
| 持仓列表 | frontend + backend | 必做 | 实时更新 |
| 成交记录 | frontend + backend | 必做 | 最近成交展示 |
| 资金冻结 | backend + frontend | 必做 | 买入下单时冻结资金，撮合成交后解冻扣减 |
| 撤单 | frontend + backend | 必做 | 撤单后退还未成交部分资金，标记已撤单 |
| 撮合引擎 | backend | 必做 | 价格优先、时间优先，防止自成交 |
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
- [ ] 实现内存撮合引擎（价格优先、时间优先，防止自成交）
- [ ] 实现 REST API：登录、注册、下单、撤单（可选）、查询委托/持仓/成交
- [ ] 后端通过 HTTP POST 向实时服务推送事件
- [ ] Postman / curl 自测所有 API

**晚上：实时服务骨架**
- [x] 搭建 WebSocket 服务
- [x] 实现行情数据生成（20 支股票 + 3 个指数，每秒随机波动）
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
| stock-trading-frontend | [PLAN.md](./stock-trading-frontend/PLAN.md) | ✅ 已完成 |
| stock-trading-backend | [PLAN.md](./stock-trading-backend/PLAN.md) | ✅ 已完成 |
| stock-trading-realtime | [PLAN.md](./stock-trading-realtime/PLAN.md) | ✅ 已完成 |

---

## 五、关键架构决策

1. **三子项目拆分而非单体**：题目要求明确区分前后端和实时通信。将 WebSocket 从后端剥离为独立子项目，职责单一，各自可独立开发、测试。放在同一 Git 仓库下便于协同管理，docker-compose 统一编排。后端与实时服务通过内部 HTTP 通信，不会相互阻塞。

2. **内存撮合引擎而非数据库**：题目明确不要求持久化。使用纯内存的 OrderBook + Map 结构实现撮合，零外部依赖，启动即用。撮合逻辑集中在一个模块内，方便单元测试。

3. **前端状态管理用 Pinia + WebSocket 驱动**：行情和用户事件全部通过 WebSocket 推送驱动 Pinia store 更新，组件仅消费 store 状态。避免轮询，保证 UI 实时性。REST API 仅用于写操作（下单等）。

4. **事件序号（eventSeq）+ 轮询兜底保障数据准确性**：后端为每个用户维护单调递增的事件序号，每次撮合产生事件时自增并随消息下发。前端收到事件后校验序号连续性，若序号跳跃（丢消息）则自动触发 REST 全量同步。WebSocket 断线时自动切入 5s 间隔轮询作为兜底，重连后停轮询。此机制确保"数据一致性由 REST 权威源保证，WS 仅作实时信号通道"，避免 WS 丢消息导致前端数据错乱。

5. **登录时一次性拉取全量快照**：`POST /api/auth/login` 和 `/register` 直接返回完整用户快照（user + positions + orders + trades + pnlCurve），前端立即填充全部 Pinia store，页面无需等待 WebSocket resync 即可渲染。切换用户时数据立即可见，WebSocket 仅用于后续增量事件和行情推送。页面初始化（`restoreSession`）仍通过 WS resync 获取全量数据。

6. **资金冻结与解冻机制**：用户提交买入委托时，资金立即从可用余额扣除并计入冻结余额（`freezeBalance`）。撮合成交时，已成交部分按实际成交价从冻结余额中解冻并扣除；委托撤单时，未成交部分的资金从冻结余额退还回可用余额。卖单不涉及资金冻结，仅校验持仓。此机制确保用户无法用同一笔资金重复下单。

7. **股票列表动态加载**：后端 `STOCKS` 不再硬编码。服务启动时从 `data/stock_master.csv` 加载全部 20 只可交易股票（过滤掉 3 个指数），保证股票列表与数据文件永远一致。每个用户初始化资金 100 万。新用户注册时随机获得其中 5 只股票，每只分配 `INITIAL_STOCK_SHARES`（1,000 股 = 10 手）作为初始持仓。

8. **盈亏曲线**：新用户注册时后端读取其随机持有的 5 只股票的日线 CSV 历史数据（最近 30 个交易日），假设用户一直持有这些股票，计算每日持仓市值与初始持仓成本的差额，生成真实的历史盈亏曲线。每次撮合成交后，根据当前总资产（余额 + 冻结余额 + 持仓估值）与用户初始总资产的差额追加新的盈亏数据点。曲线和初始总资产持久化到 `snapshot.json`（含 `pnlInitialAssets` 字段）。登录/注册时曲线随快照一并下发至前端 `pnlCurveStore`，ProfileView 直接读取渲染，无需额外 HTTP 请求。

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
├── data/
│   └── intraday_aggregated.csv   # 聚合行情数据（脚本生成）
├── scripts/
│   └── aggregate_intraday.py     # CSV聚合脚本
├── src/
│   ├── index.ts                  # 入口：启动 HTTP + WebSocket 服务（端口 3001）
│   ├── types/
│   │   └── index.ts              # 类型定义（StockQuote, Order, Position, Trade）
│   ├── market/
│   │   ├── generator.ts          # 股票定义（STOCKS数组，含code/name/volatility）
│   │   └── csvReader.ts          # 聚合CSV读取器（加载→逐行回放）
│   ├── ws/
│   │   ├── server.ts             # WebSocket 服务端（连接管理 + 广播）
│   │   └── protocols.ts          # 消息协议定义（subscribe / resync / ping）
│   └── routes/
│       └── internal.ts           # 内部 HTTP 接口（/internal/event + /internal/health）
```

### 行情推送机制

**CSV回放模式**（替代原随机游走生成）：
1. 启动时读取 `data/intraday_aggregated.csv`（一次性加载全部14402行到内存）
2. 每秒取下一行，该行包含所有23个标的在该秒的价格
3. `change` 和 `changePercent` 实时计算（当前价格 vs 上一秒价格）
4. 广播一条 `quotes` 批量消息（含 `timestamp`），替代原先的23条逐支 `quote` 消息
5. 回放结束后自动循环（reset → 重新开始）

### 消息协议

**服务端 → 客户端：**
| type | 说明 |
|------|------|
| `quote` | 单支股票行情（每秒逐支广播） |
| `quotes` | 全部股票行情（首次订阅时发送） |
| `order` | 委托更新（后端撮合后推送，含 `eventSeq`） |
| `position` | 持仓更新（后端撮合后推送，含 `eventSeq`） |
| `trade` | 成交记录（后端撮合后推送，含 `eventSeq`） |
| `user` | 用户资金更新（含 `balance` / `frozenBalance`，含 `eventSeq`） |
| `sync` | 全量状态同步（重连后 resync） |
| `pong` | 心跳响应 |
| `error` | 服务端错误通知 |

**事件序号（eventSeq）机制**：`order`、`position`、`trade`、`user` 四类消息体顶层携带 `eventSeq` 字段（用户级单调递增整数）。前端每次收到事件消息先校验序号连续性：连续则正常处理，跳跃则自动触发 REST 增量同步，重复则跳过。

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

---

## 八、数据生成脚本与技能

### 8.1 日线数据生成器

**脚本**：[`scripts/generate_stock_data.py`](file:///c:/Users/Kleaves/Desktop/Trading-system/stock-trading-backend/scripts/generate_stock_data.py)

使用几何布朗运动（Box-Muller 变换）生成20支A股 + 3个大盘指数的日K线 OHLCV 数据（2025-01-02 ~ 2026-01-02，含中国节假日判断）。

```bash
cd stock-trading-backend
python scripts/generate_stock_data.py
```

输出：
- `data/stocks/*.csv` — 20支股票日线（date, open, close, high, low, volume, amount）
- `data/indices/*.csv` — 3个指数日线（同上格式）
- `data/stock_master.csv` — 股票总索引

### 8.2 秒级日内数据生成器（v1）

**脚本**：[`scripts/generate_intraday.py`](file:///c:/Users/Kleaves/Desktop/Trading-system/stock-trading-backend/scripts/generate_intraday.py)

基于日线OHLCV锚点，使用**布朗桥模型**生成单日固定（2026-01-02）的秒级日内数据。输出字段：timestamp, price, volume, amount。

### 8.3 秒级日内数据生成器（v2 增强版）· Skill

**脚本**：[`scripts/generate_intraday_v2.py`](file:///c:/Users/Kleaves/Desktop/Trading-system/stock-trading-backend/scripts/generate_intraday_v2.py)

**Skill 名称**：`stock-simulator`

**Skill 定义**：[`.trae/skills/stock-simulator/SKILL.md`](file:///c:/Users/Kleaves/Desktop/Trading-system/.trae/skills/stock-simulator/SKILL.md)

**触发方式**：对 AI 说「stock-simulator」+ 日期，例如：
> stock-simulator 2025-06-03

**功能**：从 `data/stocks/` 和 `data/indices/` 中日线数据中提取指定日期的 OHLCV 行情，使用**改进的布朗桥模型**模拟该日每秒（09:30-11:30 + 13:00-15:00，共14402秒）的行情数据，生成23个CSV文件（20支股票 + 3个指数）。指数数据直接从指数日线 OHLCV 锚点生成，不再依赖成分股合成。

**输出格式**：

| 字段 | 说明 |
|------|------|
| `timestamp` | 时间戳 `YYYY-MM-DD HH:MM:SS` |
| `price` | 每秒价格 |
| `change_amount` | 涨跌额（相对前收盘价） |
| `change_pct` | 涨跌幅百分比（相对前收盘价） |
| `volume` | 成交量（U型分布 + 泊松噪声） |
| `amount` | 成交额（price × volume） |

输出目录：`data/intraday/`（与 v1 脚本同目录，直接生成到聚合脚本可读取的位置）

**手动执行**：
```bash
cd stock-trading-backend
python scripts/generate_intraday_v2.py --date 2025-06-03 [--seed 42]
```

**算法核心**：
1. 从日线CSV中提取目标日期的 open/close/high/low/volume/amount
2. 从目标日期的前一交易日提取 close 作为前收盘价（计算涨跌额/涨跌幅的基准）
3. 布朗桥模型生成严格收敛的价格路径（起点=开盘价，终点=收盘价，硬约束在 [low, high] 内）
4. **波动率改进**：噪声幅度与日内波幅（high-low）成正比，而非绝对价格，避免高价股波动过大
5. **反重复机制**：确保相邻秒级价格不出现完全相同的情况（收盘价被保护不被修改）
6. 成交量按 U 型曲线分配（开盘/收盘高，午间低），叠加高斯噪声避免过于均匀

### 8.4 指数合成脚本（已被 v2 替代）

> ⚠️ **注意**：此脚本已被 `generate_intraday_v2.py` 替代。v2 直接从指数日线 OHLCV 数据生成指数秒级数据，不再需要从成分股加权合成。该脚本保留作为参考。

**脚本**：[`scripts/synthesize_indices.py`](file:///c:/Users/Kleaves/Desktop/Trading-system/stock-trading-backend/scripts/synthesize_indices.py)

**功能**：基于 20 支股票已有的秒级日内数据（`data/intraday/`），以各成分股当日总成交额为权重，加权合成三大指数的秒级数据。后续模拟可参照此数据进行。

**成分股映射**：

| 指数 | 成分股筛选 | 股票数 |
|------|-----------|--------|
| 上证指数 (000001) | 代码以 `600`/`601` 开头的沪市主板股票 | 8 |
| 深证成指 (399001) | 代码以 `000`/`002` 开头的深市主板股票 | 9 |
| 创业板指 (399006) | 代码以 `300` 开头的创业板股票 | 3 |

**权重**：按当日总成交额（amount）归一化，模拟市值加权。

**执行**：
```bash
cd stock-trading-backend
python scripts/synthesize_indices.py
```

**输出**：`data/intraday/` 下的三个文件（与股票秒级数据同一目录）：
- `000001_上证指数_intraday.csv`
- `399001_深证成指_intraday.csv`
- `399006_创业板指_intraday.csv`

**算法**：对每秒，计算所有成分股相对各自开盘价的收益率，以成交额加权平均后应用到指数开盘价上；成交量/成交额为成分股之和。

### 8.5 日内数据聚合脚本

**脚本**：[`scripts/aggregate_intraday.py`](file:///c:/Users/Kleaves/Desktop/Trading-system/stock-trading-realtime/scripts/aggregate_intraday.py)

**功能**：将20支股票和3个指数的独立秒级CSV文件聚合成**单一宽表CSV**。每行一个时间戳，列依次为 `timestamp, 600519, 000858, ..., 399006`（共24列）。缺失秒级数据点使用前向填充（forward-fill），确保所有标的在所有时间戳上都有价格，无空洞。

**执行**：
```bash
cd stock-trading-realtime
python scripts/aggregate_intraday.py
```

**输出**：`stock-trading-realtime/data/intraday_aggregated.csv`（约14402行×24列）

**设计意图**：real-time服务在推送行情时只需读取这一个文件，减少23次文件I/O为1次。时间戳列被随 `quotes` 消息下发给前端，前端据此同步显示时间（不再依赖本地 `new Date()`）。