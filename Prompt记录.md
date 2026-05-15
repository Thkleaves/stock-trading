# 关键 Prompt 记录

> 本文档从 [README.md](./README.md) 中提取，记录项目开发过程中与 AI 协作的关键 Prompt 及决策过程。

---

## Prompt 1：行情数据源从随机游走切换到聚合 CSV 回放

- **场景**：最早用随机游走生成行情，但发现各股票价格走势完全独立，缺乏真实感，且每秒对 23 个标的各做一次随机波动计算量大、JavaScript 浮点精度累积误差严重。
- **问题**：随机游走导致同一行业的股票各自涨跌，完全不像真实市场；且每秒要广播 23 条 `quote` 消息，WebSocket 带宽压力大。
- **Prompt**：
  > 当前行情生成器用 Math.random 做每秒随机游走，产生以下问题：
  > 1. 23 个标的之间价格变动毫无关联，不像真实同步行情
  > 2. 每次游走累积浮点误差，运行 1 小时后价格明显漂移
  > 3. 每秒 23 条 WS 消息，带宽浪费严重
  >
  > 我想到一个方案：先用 Python 脚本离线生成所有标的的秒级 CSV 数据（布朗桥模型，从日线 OHLCV 锚点生成），再将 23 个 CSV 聚合为单一宽表。Node.js 启动时一次性加载到内存，每秒读一行批量广播。请评估这个方案的可行性和性能影响，并给出实现要点。
- **AI 回复**：AI 确认方案可行，指出关键点：(1) 聚合 CSV 可将每秒广播从 23 条消息降为 1 条 `quotes` 批量消息，(2) 前向填充处理缺失数据，(3) 离线生成确保数据可复现。给出了聚合脚本伪代码和 csvReader 的加载/回放/循环重置接口设计。
- **我的调整**：AI 建议将聚合 CSV 放在 `stock-trading-realtime/data/` 目录下，但我决定将生成脚本放在 `stock-trading-backend/scripts/`、聚合脚本放在 `stock-trading-realtime/scripts/`，数据也分离：原始 CSV 在 backend、聚合 CSV 在 realtime。这样数据生产者和消费者职责清晰。另外 AI 建议用 `changePercent` 基于昨收计算，我改为基于上一秒价格计算（逐秒变化百分比），更符合「涨跌幅」的直觉含义。还增加了 `timestamp` 字段随 `quotes` 消息下发，前端用服务端时间同步显示而非 `new Date()`，确保所有客户端时钟一致。

---

## Prompt 2：资金冻结与撮合结算机制

- **场景**：撮合引擎第一版只做了成交，没有对用户下单时的资金做冻结，导致用户可以同时提交多笔买单，每笔都能通过资金校验但撮合后余额变负数。
- **问题**：用户在委托未成交期间，同一笔资金可以被多笔委托重复使用。卖出委托的持仓校验也有类似问题——只校验了存量，却未阻止用户将同一持仓同时挂多笔卖单。
- **Prompt**：
  > 撮合引擎需要设计资金冻结/解冻机制。用户提交买单时，资金应立即从 `balance` 扣除并计入 `frozenBalance`，撮合成交时从冻结余额中扣减（若成交价更低则退差价），撤单时退还冻结余额。卖单需要预占持仓（下单时扣除可用持仓、挂卖单中不可重复挂）。请设计 `User` 接口扩展和 `usersStore` 方法（freeze/unfreeze/consumeFrozen），同时给出撮合流程中冻结→解冻→扣减的完整时序。
- **AI 回复**：AI 给出了完整的 `User` 接口（新增 `frozenBalance` 字段）和 `usersStore` 四个方法，以及撮合流程中调用的时机。还建议卖单侧也做「冻结持仓」，在 `positionsStore` 中新增 `frozenQuantity` 字段。
- **我的调整**：接受了买单资金冻结方案，但拒绝了卖单持仓冻结方案。原因：(1) 题目只要求限价单，卖单的「可用持仓」可以直接通过 `positionsStore.getOne()` 返回的 `quantity` 减去所有 `pending`/`partial` 卖单已挂数量来计算，无需新增字段；(2) 引入持仓冻结会让数据模型更复杂，且卖单被成交后需要同时修改 `frozenQuantity` 和 `quantity`，容易出 Bug。后来在 `validateSell` 中改为遍历所有 `pending`/`partial` 卖单计算已挂卖量，从总持仓中扣除得到可卖数量。对于自成交防护，AI 建议用 `userId` 比较来跳过，我审查后发现还需要处理时间优先的冲突（同一用户同时有买单和卖单在队列顶部时应该跳过自己的订单而非整个撮合失败），于是新增了 `createdAt` 比较来决定移除哪边的委托。

---

## Prompt 3：WebSocket 断线重连 + 轮询兜底 + eventSeq 校验三重保障

- **场景**：前后端联调时发现 WebSocket 偶发断线后，价格和持仓没有自动恢复，刷新页面才能看到正确数据。
- **问题**：(1) 断线重连后没有状态同步，前端数据停留在上次在线状态；(2) WebSocket 消息可能丢包，`onmessage` 处理可能出现乱序；(3) 纯依赖 WebSocket 可靠性不够，需要兜底方案。
- **Prompt**：
  > 前端 WebSocket 客户端需要实现三层数据一致性保障：
  > 1. **断线重连**：指数退避（1s→2s→4s→…→30s max），区分主动断开和被动断开
  > 2. **重连后全量同步**：发送 `resync` 消息给后端，后端从 REST 拉全量数据后推送 `sync` 消息
  > 3. **eventSeq 序号校验**：后端为每个用户维护单调递增的事件序号，每次撮合事件携带 `eventSeq`。前端校验序号连续性：连续则处理，跳跃则触发 REST 增量同步，重复则跳过
  > 4. **轮询兜底**：WebSocket 断开期间每 5s 轮询 REST API，重连成功后停止轮询
  >
  > 请设计 `MarketWebSocket` 类的完整实现，保证上述机制协作运行时的状态一致性。
- **AI 回复**：AI 给出了 `MarketWebSocket` 类框架，包含 `connect`/`disconnect`/`createConnection`/`scheduleReconnect`/`dispatch`/`startPolling`/`stopPolling` 等方法，以及 `eventSeq` 的三态判断逻辑（ok/skip/gap）。
- **我的调整**：(1) AI 将 `dispatch` 中所有消息处理逻辑写在一个巨大的 `switch` 里，我将其拆分为 `handleEventSeq` + `dispatch` 两步，序号校验在分发前统一处理，代码更清晰；(2) AI 的 `incrementalResync` 只拉取了 trades，我扩展为同时拉取 orders、positions、user 全量数据；(3) AI 把 `pollData` 和 `incrementalResync` 写成了两套独立逻辑，我将其抽取为私有方法 `fetchFullState` 由两者共享调用，减少重复代码；(4) `resync` 消息下发后需要 `resetEventSeq()` 重置序号计数器，AI 遗漏了这一点，我补充了该调用。

---

## Prompt 4：盈亏曲线基于真实历史日线数据生成

- **场景**：个人中心页需要展示盈亏曲线，第一版用随机数模拟近 30 天每日盈亏，曲线毫无意义。
- **问题**：(1) 盈亏曲线需要真实反映用户持仓的历史表现，不能是随机数；(2) 新用户注册时还没有任何交易记录，但系统需要展示一条从开户至今的曲线；(3) 如何将日线 CSV 数据与用户持仓信息关联计算每日浮动盈亏。
- **Prompt**：
  > 需求：新用户注册时（还未做任何交易），从 `data/stocks/*.csv` 读取近 30 个交易日的日线收盘价，假设该用户一直持有注册时分配的 5 只随机股票（每只 1000 股），计算每日持仓总市值与初始持仓成本的差额，生成真实的历史盈亏曲线。每次撮合成交后追加新的盈亏数据点。
  >
  > 请给出：
  > 1. `pnlCurveStore` 的数据结构和接口设计
  > 2. 初始化函数 `generateInitialPnlCurve(userId, positions)` 的实现方案
  > 3. 撮合引擎中如何在每次成交后调用 `updatePnlForUser`
  > 4. 曲线的 HTTP 下发方式（登录时随 snapshot 返回 vs 独立 API）
- **AI 回复**：AI 建议用独立的 `POST /api/pnl/init` 和 `GET /api/pnl/:userId` API，曲线在登录成功后前端单独拉取。给出了日线 CSV 的读取和排序逻辑。
- **我的调整**：(1) 拒绝了 AI 的独立 API 方案，改为「登录时一次性拉取全量快照」——`POST /api/auth/login` 和 `/register` 的响应直接包含 `pnlCurve` 数组，前端在 `sync` 消息中一并接收。减少 HTTP 请求次数，页面渲染更快；(2) AI 在计算 `computeUserPnl` 时直接用 `avgPrice` 作为持仓成本，我改为需要同时考虑资金余额、冻结余额和持仓市值（用股票的 `initialPrice` 作为估值基准），统一用「总资产 - 初始总资产」作为累计盈亏，与前端展示口径一致；(3) AI 用 `pnlCurveStore.appendEntry` 后没有持久化，我新增了 `snapshot.json` 持久化逻辑（含 `pnlInitialAssets`），重启服务后盈亏曲线不丢失。

---

## Prompt 5：股票列表动态加载 + 新用户随机初始持仓

- **场景**：第一版 `STOCKS` 是硬编码的后端常量数组，只有 5 只股票。后来生成了 20 只股票 + 3 个指数的数据，需要让后端自动识别数据文件中的股票列表。
- **问题**：(1) 每次新增股票数据都要手动改代码，效率极低；(2) 新用户注册后持仓为空，没有初始股票可交易，体验差；(3) 指数（上证、深证、创业板）不应该作为可交易标的出现在交易面板中。
- **Prompt**：
  > 后端 `STOCKS` 数组目前硬编码了 5 只股票，但 `data/stock_master.csv` 中已有 20 只股票 + 3 个指数的元数据。请做以下改造：
  > 1. 启动时从 `stock_master.csv` 加载全部标的，按 `type` 字段过滤：`type='stock'` 为可交易股票，`type='index'` 为指数（仅行情展示，不可下单）
  > 2. 新用户注册时，从可交易股票中随机选 5 只，每只分配 `INITIAL_STOCK_SHARES`（1000 股 = 10 手）作为初始持仓
  > 3. 修改撮合引擎的股票校验逻辑，用 `getStockByCode` 从动态列表中查找
  >
  > 请给出 `types/index.ts` 数据结构调整和 `src/index.ts` 启动加载逻辑。
- **AI 回复**：AI 给出了 `StockMeta` 接口（含 `code/name/type`），`stock_master.csv` 的 `readFileSync` 解析代码，以及随机选股函数 `pickRandomStocks(count)`。但 AI 在解析 CSV 时用了 `split(',')` 直接切分，没有处理可能存在的引号转义。
- **我的调整**：(1) `stock_master.csv` 格式简单（`code,name,type,initialPrice,volatility`），没有逗号转义问题，所以接受了 `split(',')` 方案；(2) AI 的随机选股用了 `Math.random()` 无种子，导致每次重启分配给不同用户，我改为基于用户 ID 的确定性哈希选股（`hash(userId) % totalStocks` 偏移后连续取 5 只），同一用户重启后分配相同股票；(3) 在 `getStockByCode` 中新增了 `tradeable` 属性，`POST /api/orders` 下单时校验 `getStockByCode(stockCode)?.tradeable !== false`，指数类标的无法下单，返回「该标的不可交易」错误；(4) 将 `STOCKS` 类型拆分：`ALL_STOCKS`（23 个，含指数）用于行情广播，`TRADEABLE_STOCKS`（20 个）用于交易面板和撮合引擎。
