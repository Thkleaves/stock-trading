# stock-trading-frontend · 详细规划

> Vue 3 + TypeScript + Vite · 端口 5173

---

## 一、子项目信息

| 项 | 值 |
|---|---|
| 子项目目录 | `stock-trading-frontend/` |
| 技术栈 | Vue 3 + TypeScript + Vite + Pinia + Vue Router |
| 开发端口 | 5173 |
| 依赖后端 | `stock-trading-backend/` (REST API, :3000) |
| 依赖实时服务 | `stock-trading-realtime/` (WebSocket, :3001) |
| 数据来源 | 全量 WebSocket 推送，前端不主动请求静态 CSV |

---

## 二、目录结构

```
stock-trading-frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── Dockerfile
├── src/
│   ├── main.ts                    # 入口：挂载 App + Pinia + Router
│   ├── App.vue                    # 根组件
│   ├── router/
│   │   └── index.ts               # 路由配置
│   ├── stores/
│   │   ├── auth.ts                # 用户登录状态 store
│   │   ├── market.ts              # 行情数据 store（WebSocket 驱动）
│   │   ├── order.ts               # 委托列表 store
│   │   ├── position.ts            # 持仓列表 store
│   │   └── trade.ts               # 成交记录 store
│   ├── services/
│   │   ├── api.ts                 # HTTP REST 封装（axios/fetch）
│   │   └── websocket.ts           # WebSocket 客户端（含断线重连）
│   ├── types/
│   │   └── index.ts               # 共享类型定义
│   ├── views/
│   │   ├── LoginView.vue          # 登录页
│   │   ├── RegisterView.vue       # 注册页
│   │   └── DashboardView.vue      # 主面板（三栏布局）
│   ├── components/
│   │   ├── MarketBoard.vue        # 行情看板（股票列表卡片）
│   │   ├── TradePanel.vue         # 交易面板（买入/卖出表单）
│   │   ├── OrderList.vue          # 委托列表（未成交/已成交 tab）
│   │   ├── PositionList.vue       # 持仓列表
│   │   └── TradeRecord.vue        # 成交记录列表
│   └── assets/
│       └── main.css               # 全局样式
```

---

## 三、路由设计

| 路径 | 组件 | 说明 | 鉴权 |
|---|---|---|---|
| `/login` | LoginView | 登录页 | 否 |
| `/register` | RegisterView | 注册页 | 否 |
| `/dashboard` | DashboardView | 主面板（含所有子组件） | 是 |

- 路由守卫：未登录跳转 `/login`
- 登录成功后跳转 `/dashboard`

---

## 四、组件树与数据流

```
App.vue
└── <RouterView>
    ├── LoginView.vue        → auth store (login action)
    ├── RegisterView.vue     → auth store (register action)
    └── DashboardView.vue
        ├── MarketBoard.vue      → market store (readonly)
        ├── TradePanel.vue       → order store (create order) + market store
        ├── OrderList.vue        → order store (readonly)
        ├── PositionList.vue     → position store (readonly)
        └── TradeRecord.vue      → trade store (readonly)
```

**数据流向：**
1. 页面挂载 → `websocket.ts` 建立 WebSocket 连接
2. WebSocket 收到行情 → 写入 `market store` → MarketBoard 响应式更新
3. WebSocket 收到用户事件 → 写入 `order / position / trade store` → 各列表组件响应式更新
4. 用户下单 → `api.ts` POST 到后端 → 后端撮合 → 后端通知实时服务 → 实时服务推送 WebSocket 事件 → store 更新

---

## 五、Pinia Store 设计

### auth store
```typescript
interface AuthState {
  user: { id: string; username: string; balance: number } | null
  token: string | null           // 登录后后端返回的 userId（简化鉴权）
}
// actions: login(username, password), register(username, password), logout()
```

### market store
```typescript
interface StockQuote {
  code: string      // 如 "000001"
  name: string      // 如 "平安银行"
  price: number     // 最新价
  change: number    // 涨跌额
  changePercent: number // 涨跌幅 %
}
interface MarketState {
  quotes: Record<string, StockQuote>  // key 为 stock code
}
// 由 WebSocket 消息驱动更新，无 action
```

### order store
```typescript
interface Order {
  id: string
  userId: string
  stockCode: string
  type: 'buy' | 'sell'
  price: number
  quantity: number
  filledQuantity: number
  status: 'pending' | 'partial' | 'filled' | 'cancelled'
  createdAt: number
}
interface OrderState {
  orders: Order[]       // 当前用户的委托
}
// 查询：GET /api/orders（初始化加载）
// 更新：WebSocket 推送驱动
```

### position store
```typescript
interface Position {
  stockCode: string
  stockName: string
  quantity: number       // 持仓数量
  avgPrice: number       // 均价
  currentPrice: number   // 从 market store 关联
}
interface PositionState {
  positions: Position[]
}
// 查询：GET /api/positions（初始化加载）
// 更新：WebSocket 推送驱动
```

### trade store
```typescript
interface Trade {
  id: string
  stockCode: string
  price: number
  quantity: number
  type: 'buy' | 'sell'
  time: number
}
interface TradeState {
  trades: Trade[]
}
// 查询：GET /api/trades（初始化加载）
// 更新：WebSocket 推送驱动
```

---

## 六、WebSocket 客户端设计

```typescript
// services/websocket.ts
class MarketWebSocket {
  private ws: WebSocket | null
  private reconnectTimer: number | null
  private url = 'ws://localhost:3001'

  connect(userId: string)
  disconnect()
  private onMessage(event: MessageEvent)  // 分发到各 store
  private onClose()                       // 触发自动重连
  private reconnect()                     // 指数退避重连，最大间隔 30s
  private onReconnected()                 // 重连后请求全量状态同步
}
```

**WebSocket 消息协议（JSON）：**

服务端 → 客户端：
```json
// 行情推送
{ "type": "quote", "data": { "code": "000001", "price": 12.50, "change": 0.15, "changePercent": 1.21 } }

// 委托更新
{ "type": "order", "data": { "order": {...} } }

// 持仓更新
{ "type": "position", "data": { "positions": [...] } }

// 成交推送
{ "type": "trade", "data": { "trade": {...} } }

// 全量状态同步（重连后）
{ "type": "sync", "data": { "quotes": {...}, "orders": [...], "positions": [...], "trades": [...] } }
```

客户端 → 服务端：
```json
// 订阅用户频道
{ "type": "subscribe", "userId": "xxx" }

// 重连后请求同步
{ "type": "resync", "userId": "xxx" }
```

---

## 七、HTTP API 调用清单

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{ username, password }` | `{ userId, username, balance }` | 注册 |
| POST | `/api/auth/login` | `{ username, password }` | `{ userId, username, balance }` | 登录 |
| POST | `/api/orders` | `{ userId, stockCode, type, price, quantity }` | `{ order }` | 下单 |
| GET | `/api/orders?userId=xxx` | - | `{ orders }` | 查询委托 |
| GET | `/api/positions?userId=xxx` | - | `{ positions }` | 查询持仓 |
| GET | `/api/trades?userId=xxx` | - | `{ trades }` | 查询成交记录 |

---

## 八、页面 UI 布局（DashboardView）

```
┌─────────────────────────────────────────────────┐
│  Header: 用户名 | 资金余额 ¥1,000,000 | 退出      │
├────────────────────┬────────────────────────────┤
│  MarketBoard       │  TradePanel                │
│  ┌──────────────┐  │  ┌──────────────────────┐  │
│  │ 000001 平安银行│  │  │ 股票: [下拉选择]      │  │
│  │ ¥12.50 +1.21% │  │  │ 价格: [输入框]        │  │
│  ├──────────────┤  │  │ 数量: [输入框]        │  │
│  │ 000002 万科A  │  │  │ [买入] [卖出]         │  │
│  │ ¥8.32 -0.48% │  │  └──────────────────────┘  │
│  ├──────────────┤  │                            │
│  │ 000003 茅台   │  │  OrderList                │
│  │ ¥1680 +2.15% │  │  ┌──────────────────────┐  │
│  └──────────────┘  │  │ [未成交] [已成交]      │  │
│                    │  │ ...委托列表            │  │
├────────────────────┤  └──────────────────────┘  │
│  PositionList      │                            │
│  ┌────────────────┐│  TradeRecord               │
│  │ 持仓列表        ││  ┌──────────────────────┐  │
│  └────────────────┘│  │ 最近成交记录           │  │
│                    │  └──────────────────────┘  │
└────────────────────┴────────────────────────────┘
```

左列：行情看板 + 持仓列表
右列：交易面板 + 委托列表 + 成交记录

---

## 九、开发步骤

### Step 1：项目初始化
- `npm create vite@latest . -- --template vue-ts`
- 安装依赖：`vue-router`, `pinia`, `axios`
- 配置 `vite.config.ts`（代理 /api 到 localhost:3000）

### Step 2：类型定义 + 路由
- 定义 `types/index.ts`（所有接口类型）
- 配置路由（login / register / dashboard）

### Step 3：Store + Service
- 编写 5 个 Pinia store
- 编写 `api.ts`（axios 封装）
- 编写 `websocket.ts`（含断线重连）

### Step 4：页面与组件
- LoginView / RegisterView（表单 + 校验）
- DashboardView（三栏布局容器）
- MarketBoard（实时价格展示，红涨绿跌）
- TradePanel（表单 + 提交）
- OrderList（tab 切换未成交/已成交）
- PositionList（表格展示）
- TradeRecord（时间倒序列表）

### Step 5：联调与样式
- 与后端 API 联调
- 与实时服务 WebSocket 联调
- CSS 样式美化（简洁即可，不需要 UI 库）

---

## 十、Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```