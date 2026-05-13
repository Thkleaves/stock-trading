# stock-trading-backend · 详细规划

> Node.js + Express + TypeScript · 端口 3000

---

## 一、子项目信息

| 项 | 值 |
|---|---|
| 子项目目录 | `stock-trading-backend/` |
| 技术栈 | Node.js + Express + TypeScript + tsx (dev runner) |
| 开发端口 | 3000 |
| 被依赖方 | `stock-trading-frontend/` (HTTP), `stock-trading-realtime/` (事件推送) |

---

## 二、目录结构

```
stock-trading-backend/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts                  # 入口：启动 Express 服务
│   ├── types/
│   │   └── index.ts              # 共享类型定义（与前端、实时服务一致）
│   ├── store/
│   │   ├── users.ts              # 内存用户存储（Map<userId, User>）
│   │   ├── orders.ts             # 内存委托存储（Map<orderId, Order>）
│   │   ├── positions.ts          # 内存持仓存储（Map<userId, Position[]>）
│   │   └── trades.ts             # 内存成交记录存储（Trade[]）
│   ├── engine/
│   │   ├── matcher.ts            # 撮合引擎核心（价格优先、时间优先）
│   │   └── matcher.test.ts       # 撮合引擎单元测试（Vitest）
│   ├── routes/
│   │   ├── auth.ts               # POST /api/auth/register, /api/auth/login
│   │   ├── orders.ts             # POST /api/orders, GET /api/orders
│   │   ├── positions.ts          # GET /api/positions
│   │   └── trades.ts             # GET /api/trades
│   └── services/
│       └── eventPusher.ts        # HTTP POST 事件到实时服务
```

---

## 三、核心数据结构

### User
```typescript
interface User {
  id: string            // uuid
  username: string
  password: string      // 明文（题目无安全要求）
  balance: number       // 初始 1,000,000
}
```

### Stock（硬编码 5 支股票）
```typescript
const STOCKS = [
  { code: '000001', name: '平安银行', initialPrice: 12.50 },
  { code: '000002', name: '万科A',   initialPrice: 8.32 },
  { code: '000333', name: '美的集团', initialPrice: 55.80 },
  { code: '000651', name: '格力电器', initialPrice: 38.60 },
  { code: '000858', name: '五粮液',   initialPrice: 148.00 },
]
```

### Order
```typescript
interface Order {
  id: string
  userId: string
  stockCode: string
  type: 'buy' | 'sell'
  price: number          // 限价
  quantity: number       // 委托数量
  filledQuantity: number // 已成交数量
  status: 'pending' | 'partial' | 'filled' | 'cancelled'
  createdAt: number      // 时间戳 ms（用于时间优先排序）
}
```

### Position
```typescript
interface Position {
  userId: string
  stockCode: string
  quantity: number      // 持仓数量
  avgPrice: number      // 持仓均价
}
```

### Trade
```typescript
interface Trade {
  id: string
  buyOrderId: string
  sellOrderId: string
  stockCode: string
  price: number
  quantity: number
  time: number
}
```

---

## 四、撮合引擎设计（核心）

### 撮合规则
- **价格优先**：买单按价格从高到低排列，卖单按价格从低到高排列
- **时间优先**：同价位按委托时间先后排列
- **成交条件**：买单价格 ≥ 卖单价格

### 数据结构
```typescript
// 买单队列：按 price desc, createdAt asc
let buyOrders: Order[] = []
// 卖单队列：按 price asc, createdAt asc
let sellOrders: Order[] = []
```

### 撮合流程（matchOrder 函数）

```
输入：新委托 Order
输出：Trade[] （本次撮合产生的成交记录）

1. 将新委托加入对应队列（买/卖），按价格+时间排序
2. 取买单队列最优价（最高买价）和卖单队列最优价（最低卖价）
3. while (最优买价 >= 最优卖价 && 两队列均非空):
   a. 取最优买单（highestBid）和最优卖单（lowestAsk）
   b. 成交价 = 较早委托的价格（时间优先定价）
   c. 成交量 = min(highestBid.remaining, lowestAsk.remaining)
   d. 生成 Trade 记录
   e. 更新双方 filledQuantity 和 status
   f. 资金结算：
      - 买方 balance -= 成交价 × 成交量
      - 卖方 balance += 成交价 × 成交量
   g. 更新持仓：
      - 买方：对应股票持仓 + 成交量，均价重新计算
      - 卖方：对应股票持仓 - 成交量（需校验持仓充足）
   h. 完全成交的委托移出队列
4. 撮合完成后通知实时服务推送事件
```

### 资金与持仓校验
- **买入**：委托金额（price × quantity）≤ 用户可用资金
- **卖出**：委托数量 ≤ 用户该股票持仓数量

---

## 五、REST API 详设

### 认证模块 (`routes/auth.ts`)

**POST `/api/auth/register`**
```
Request:  { username: string, password: string }
Response: { userId: string, username: string, balance: 1000000 }
Error:    409 "用户名已存在"
```

**POST `/api/auth/login`**
```
Request:  { username: string, password: string }
Response: { userId: string, username: string, balance: number }
Error:    401 "用户名或密码错误"
```

### 委托模块 (`routes/orders.ts`)

**POST `/api/orders`**
```
Request:  { userId: string, stockCode: string, type: 'buy'|'sell', price: number, quantity: number }
Response: { order: Order, trades: Trade[] }  // 返回委托及本次撮合产生的成交
校验:
  - 买入: price * quantity ≤ user.balance，否则 400 "资金不足"
  - 卖出: quantity ≤ 持仓数量，否则 400 "持仓不足"
  - stockCode 必须存在于 STOCKS 列表
```

**GET `/api/orders?userId=xxx`**
```
Response: { orders: Order[] }  // 该用户所有委托（按时间倒序）
```

### 持仓模块 (`routes/positions.ts`)

**GET `/api/positions?userId=xxx`**
```
Response: { positions: Position[] }  // 该用户所有持仓（stockCode 维度聚合）
```

### 成交记录模块 (`routes/trades.ts`)

**GET `/api/trades?userId=xxx`**
```
Response: { trades: Trade[] }  // 该用户相关的成交记录（实时倒序，最近 50 条）
```

---

## 六、事件推送服务（eventPusher.ts）

后端撮合/委托变更后，通过 HTTP POST 通知实时服务：

```typescript
const REALTIME_URL = 'http://localhost:3001'

async function pushEvent(event: RealtimeEvent) {
  await fetch(`${REALTIME_URL}/internal/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  })
}
```

**事件类型：**
```typescript
type RealtimeEvent =
  | { type: 'order', userId: string, data: Order }
  | { type: 'position', userId: string, data: Position[] }
  | { type: 'trade', userId: string, data: Trade }
```

---

## 七、Express 中间件配置

```
- cors()            // 允许前端跨域
- express.json()    // JSON body 解析
- 路由挂载           // /api/auth, /api/orders, /api/positions, /api/trades
- 静态文件（可选）    // 生产环境可托管前端 dist
```

---

## 八、单元测试计划（match.test.ts）

使用 Vitest，覆盖以下 case：

| 测试用例 | 说明 |
|---|---|
| 完全成交 | 买单价格 > 卖单价格，数量相等，一笔成交 |
| 价格优先 | 多个买单，高价优先成交 |
| 时间优先 | 同价位，先到先成交 |
| 部分成交 | 数量不匹配，部分成交后剩余继续挂单 |
| 价格不匹配 | 买价 < 卖价，不成交，挂单等待 |
| 多笔连续撮合 | 一个大单匹配多个小单 |
| 资金不足校验 | 买入超过余额，应拒绝 |
| 持仓不足校验 | 卖出超过持仓，应拒绝 |

---

## 九、开发步骤

### Step 1：项目初始化
- `npm init` + 安装 express, cors, uuid, tsx, typescript
- 配置 tsconfig.json（target ES2022, module NodeNext）
- 编写 `src/index.ts` Express 骨架

### Step 2：数据层
- 实现 `store/users.ts`（注册/登录/查询）
- 实现 `store/orders.ts`（增删改查）
- 实现 `store/positions.ts`（增改查）
- 实现 `store/trades.ts`（追加/查询）

### Step 3：撮合引擎
- 实现 `engine/matcher.ts`（核心撮合逻辑）
- 实现资金校验 + 持仓校验
- 实现事件推送调用

### Step 4：路由
- `routes/auth.ts`（注册 + 登录）
- `routes/orders.ts`（下单 + 查询）
- `routes/positions.ts`（查询持仓）
- `routes/trades.ts`（查询成交）

### Step 5：单元测试
- 安装 vitest
- 编写 `matcher.test.ts` 覆盖 8 个核心 case

### Step 6：Dockerfile

---

## 十、Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npx", "tsx", "src/index.ts"]
```