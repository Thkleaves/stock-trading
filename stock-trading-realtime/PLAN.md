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

1. **行情广播**：每秒对所有连接的客户端推送最新行情（价格随机波动）
2. **事件转发**：接收后端 HTTP POST 的事件，推送给指定用户
3. **连接管理**：维护所有 WebSocket 连接，断线自动清理
4. **断线重连支持**：重连后为客户端提供全量状态同步

---

## 三、目录结构

```
stock-trading-realtime/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts                  # 入口：启动 HTTP + WebSocket 服务
│   ├── types/
│   │   └── index.ts              # 类型定义（与后端共享）
│   ├── market/
│   │   └── generator.ts          # 行情数据生成器（每秒随机波动）
│   ├── ws/
│   │   ├── server.ts             # WebSocket 服务端（连接管理 + 广播）
│   │   └── protocols.ts          # 消息协议定义
│   └── routes/
│       └── internal.ts           # 内部 HTTP 接口（接收后端事件）
```

---

## 四、行情生成器设计（generator.ts）

### 股票初始数据
```typescript
const STOCKS = [
  { code: '000001', name: '平安银行', price: 12.50 },
  { code: '000002', name: '万科A',   price: 8.32 },
  { code: '000333', name: '美的集团', price: 55.80 },
  { code: '000651', name: '格力电器', price: 38.60 },
  { code: '000858', name: '五粮液',   price: 148.00 },
]
```

### 价格波动算法
```typescript
// 每秒执行一次
function tick() {
  for (const stock of quotes) {
    // 随机波动幅度：±0.5%
    const changePercent = (Math.random() - 0.5) * 0.01  // -0.5% ~ +0.5%
    const newPrice = stock.price * (1 + changePercent)
    stock.price = round(newPrice, 2)          // 保留两位小数
    stock.change = round(newPrice - stock.prevClose, 2)
    stock.changePercent = round(changePercent * 100, 2)
  }
}
```

### 广播格式
```json
{
  "type": "quote",
  "data": {
    "code": "000001",
    "name": "平安银行",
    "price": 12.55,
    "change": 0.05,
    "changePercent": 0.40
  }
}
```

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
    "trades": [...]
  }
}
```

---

## 八、消息协议汇总

### 服务端 → 客户端

| type | 触发时机 | data 内容 |
|---|---|---|
| `quote` | 每秒 | 单支股票行情 `{ code, name, price, change, changePercent }` |
| `quotes` | 客户端首次订阅 | 全部股票行情（批量）`{ [code]: StockQuote }` |
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