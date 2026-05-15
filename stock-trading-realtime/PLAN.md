# stock-trading-realtime · 详细规划

> Node.js + ws + TypeScript · 端口 3001

---

## 一、子项目信息

| 项 | 值 |
|---|---|
| 子项目目录 | `stock-trading-realtime/` |
| 技术栈 | Node.js + ws + TypeScript + tsx |
| 开发端口 | 3001 |
| 依赖方 | `stock-trading-frontend/` (WebSocket 连接), `stock-trading-backend/` (事件推送) |

---

## 二、职责定位

本服务是**纯推送层**，不持有业务数据，不处理业务逻辑。职责：

1. **历史数据加载**：启动时从 `stock-trading-backend/data/` 加载所有标的日K线、周K线（聚合）、月K线（聚合）、昨收价
2. **行情广播**：每秒对所有连接的客户端推送最新行情（聚合CSV逐行回放，替代随机游走），同时实时追踪日内最高/最低/开盘
3. **事件转发**：接收后端 HTTP POST 的事件，推送给指定用户
4. **连接管理**：维护所有 WebSocket 连接，断线自动清理
5. **断线重连支持**：重连后为客户端提供全量状态同步（含K线数据）
6. **时间同步**：`quotes` 消息携带 `timestamp` 字段，前端基于此同步显示时间

---

## 三、目录结构

```
stock-trading-realtime/
├── package.json
├── tsconfig.json
├── Dockerfile
├── data/
│   └── intraday_aggregated.csv   # 聚合行情数据（由 aggregate_intraday.py 生成）
├── scripts/
│   └── aggregate_intraday.py     # 将23个独立CSV聚合成单一宽表CSV
├── src/
│   ├── index.ts                  # 入口：启动 HTTP + WebSocket 服务
│   ├── types/
│   │   └── index.ts              # 类型定义（与后端共享）
│   ├── market/
│   │   ├── generator.ts          # 股票定义（STOCKS数组，含code/name/initialPrice/volatility）
│   │   ├── csvReader.ts          # 聚合CSV读取器（加载→逐行回放→计算change/changePercent）
│   │   └── klineLoader.ts        # 历史K线加载器（从backend-data加载日/周/月K线，追踪日内OHLC）
│   ├── ws/
│   │   ├── server.ts             # WebSocket 服务端（连接管理 + 广播）
│   │   └── protocols.ts          # 消息协议定义
│   └── routes/
│       └── internal.ts           # 内部 HTTP 接口（接收后端事件）
```

---

## 四、行情回放设计（csvReader.ts）

### 数据来源

聚合CSV文件 `data/intraday_aggregated.csv` 由脚本 `scripts/aggregate_intraday.py` 预生成。该文件包含全部23个标的在2026-01-02当日共约14402秒的价格数据（宽表格式：24列 = timestamp + 23个code列）。缺失秒级数据点已做前向填充（forward-fill），无空洞。

### 加载与回放算法

```typescript
// 启动时一次性加载全部行到内存
function loadAggregatedCsv(): void

// 每秒执行一次，返回值包含 timestamp 和全部23个 StockQuote
function getNextQuotes(): { timestamp: string; quotes: Map<string, StockQuote> } | null

// 回放完毕自动循环
function resetCsvReader(): void
```

**价格变更计算**：每行价格与上一行的差额即为 `change`，相对上一行的百分比为 `changePercent`。首行（开盘价）的 change/changePercent 均为 0。

### 广播格式（替代原逐支 quote 广播）

```json
{
  "type": "quotes",
  "timestamp": "2026-01-02 09:30:00",
  "data": {
    "600519": { "code": "600519", "name": "贵州茅台", "price": 2313.63, "change": 1.23, "changePercent": 0.05 },
    "000858": { "code": "000858", "name": "五粮液", "price": 95.93, "change": -0.50, "changePercent": -0.52 },
    "...": "..."
  }
}
```

**关键变更**：
- 每秒广播 1 条 `quotes` 批量消息（包含所有23个标的），替代原先 23 条逐支 `quote` 消息，消息数从 23n/秒 降至 1/秒
- 新增 `timestamp` 字段，前端据此同步显示时间，不再依赖 `new Date()`

---

## 五、WebSocket 服务设计（server.ts）

### 连接管理
```typescript
// userId → WebSocket 映射（一对多，用户可能有多个连接）
const clients: Map<string, Set<WebSocket>> = new Map()
// WebSocket → userId 反向映射
const wsToUser: Map<WebSocket, string> = new Map()
```

### 生命周期
```
连接建立 (ws.on('connection'))
  → 等待客户端发送 subscribe 消息（含 userId）
  → 注册到 clients Map
  → 开始接收消息

消息处理 (ws.on('message'))
  → { type: 'subscribe', userId: 'xxx' }  → 注册用户
  → { type: 'resync', userId: 'xxx' }     → 请求全量同步
  → { type: 'ping' }                      → 回复 { type: 'pong' }

连接断开 (ws.on('close'))
  → 从 clients Map 移除
  → 从 wsToUser Map 移除
```

### 广播方法
```typescript
// 广播给所有连接
function broadcastAll(message: object)

// 推送给指定用户
function sendToUser(userId: string, message: object)

// 推送给所有订阅了特定股票的用户（可选优化）
function sendToStockWatchers(stockCode: string, message: object)
```

### 心跳机制
```
服务端每 30 秒发送 ping → 客户端回复 pong
客户端 60 秒无响应 → 主动断开连接
```

---

## 六、内部 HTTP 接口（routes/internal.ts）

接收后端推送的事件，转发给 WebSocket 客户端。

**POST `/internal/event`**
```
Request: {
  type: 'order' | 'position' | 'trade',
  userId: string,
  data: { ... }
}

处理流程:
  1. 查找 userId 对应的 WebSocket 连接
  2. 如果连接存在，推送事件给该用户
  3. 如果连接不存在，忽略（用户不在线则不需要推送）

Response: { ok: true }
```

**GET `/internal/health`**
```
Response: { status: 'ok', connections: number }
```

---

## 七、断线重连与状态同步

### 前端重连流程
```
1. WebSocket 断开 → 触发 onClose
2. 启动重连定时器（指数退避：1s → 2s → 4s → 8s → 16s → 30s max）
3. 重连成功后:
   a. 发送 { type: 'subscribe', userId: 'xxx' }
   b. 发送 { type: 'resync', userId: 'xxx' }
   c. 收到 sync 消息后，用后端最新数据覆盖前端 store
```

### 服务端 resync 处理
```
收到 { type: 'resync', userId: 'xxx' }
  → 向后台 API 请求最新数据（GET /api/orders, /api/positions, /api/trades）
  → 组装 sync 消息推送给该用户
```

> **注意**：resync 需要实时服务主动向后台后端请求数据。为实现此功能，实时服务需内置一个简单的 HTTP 客户端指向 `http://localhost:3000`。

sync 消息格式：
```json
{
  "type": "sync",
  "data": {
    "quotes": { "000001": {...}, "000002": {...}, ... },
    "orders": [...],
    "positions": [...],
    "trades": [...],
    "user": {...},
    "pnlCurve": [...],
    "klDaily": { "600519": [{"date":"2025-01-02","open":1450,...}, ...], ... },
    "klWeekly": { "600519": [...], ... },
    "klMonthly": { "600519": [...], ... },
    "dailyOhlc": { "600519": {"code":"600519","name":"贵州茅台","type":"stock","open":2313,"high":2350,"low":2290,"preClose":2299}, ... }
  }
}
```

---

## 八、消息协议汇总

### 服务端 → 客户端

| type | 触发时机 | data 内容 |
|---|---|---|
| `quote` | 每秒（已废弃） | 单支股票行情（现已被 `quotes` 批量消息替代） |
| `quotes` | 每秒CSV回放 / 客户端首次订阅 | 全部23个标的行情（批量）`{ [code]: StockQuote }` + `timestamp` 字段 |
| `order` | 后端撮合后推送 | 单个委托 `Order` |
| `position` | 后端撮合后推送 | 用户全部持仓 `Position[]` |
| `trade` | 后端撮合后推送 | 单笔成交 `Trade` |
| `sync` | 客户端 resync 请求 | 全量状态 `{ quotes, orders, positions, trades }` |
| `pong` | 响应 ping | `{}` |
| `error` | 异常 | `{ message: string }` |

### 客户端 → 服务端

| type | 说明 | payload |
|---|---|---|
| `subscribe` | 订阅用户频道 | `{ userId: string }` |
| `resync` | 请求全量同步 | `{ userId: string }` |
| `ping` | 心跳 | `{}` |

---

## 九、开发步骤

### Step 1：项目初始化
- `npm init` + 安装 ws, express, cors, tsx, typescript
- 配置 tsconfig.json
- 编写 `src/index.ts`（启动 HTTP + WebSocket 双服务，共用端口 3001）

### Step 2：行情生成器
- 实现 `generator.ts`
- 用 `setInterval` 每秒 tick
- tick 后广播所有行情给所有客户端

### Step 3：WebSocket 服务
- 实现 `server.ts`（连接管理、消息路由、广播）
- 实现 `protocols.ts`（消息类型定义）

### Step 4：内部 HTTP 接口
- 实现 `routes/internal.ts`（接收后端事件并转发）
- 实现 resync 逻辑（向后端请求数据）

### Step 5：联调
- 与后端联调事件推送
- 与前端联调 WebSocket 连接 + 行情接收

### Step 6：Dockerfile

---

## 十、Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
```