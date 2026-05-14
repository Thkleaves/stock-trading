# stock-trading-frontend · 股票交易系统前端

Vue 3 + TypeScript + Vite 构建的股票模拟交易系统前端。

## 技术栈

- **Vue 3** (`<script setup>` SFC)
- **TypeScript**
- **Vite** (开发服务器 + 构建)
- **Pinia** (状态管理)
- **Vue Router** (路由)
- **Axios** (HTTP 请求)

## 项目结构

```
src/
├── main.ts                    # 入口：挂载 App + Pinia + Router
├── App.vue                    # 根组件（RouterView）
├── router/
│   └── index.ts               # 路由配置 + 登录守卫
├── stores/
│   ├── auth.ts                # 用户登录状态 store
│   ├── market.ts              # 行情数据 store（WebSocket 驱动）
│   ├── order.ts               # 委托列表 store
│   ├── position.ts            # 持仓列表 store
│   └── trade.ts               # 成交记录 store
├── services/
│   ├── api.ts                 # Axios 封装（代理到后端 :3000）
│   └── websocket.ts           # WebSocket 客户端（含断线重连，连接 :3001）
├── types/
│   └── index.ts               # 共享类型定义
├── views/
│   ├── LoginView.vue          # 登录页
│   ├── RegisterView.vue       # 注册页
│   └── DashboardView.vue      # 主面板（双栏布局容器）
├── components/
│   ├── MarketBoard.vue        # 行情看板（实时价格卡片）
│   ├── TradePanel.vue         # 交易面板（买入/卖出表单）
│   ├── OrderList.vue          # 委托列表（未成交/已成交 Tab）
│   ├── PositionList.vue       # 持仓列表（含盈亏计算）
│   └── TradeRecord.vue        # 成交记录列表
└── assets/
    └── main.css               # 全局样式
```

## 路由设计

| 路径 | 组件 | 说明 | 鉴权 |
|---|---|---|---|
| `/login` | LoginView | 登录页 | 否 |
| `/register` | RegisterView | 注册页 | 否 |
| `/dashboard` | DashboardView | 主面板（含所有子组件） | 是 |

- 路由守卫：未登录跳转 `/login`
- 登录成功后跳转 `/dashboard`

## 数据流

```
App.vue
└── <RouterView>
    ├── LoginView        → auth store (login action)
    ├── RegisterView     → auth store (register action)
    └── DashboardView
        ├── MarketBoard      → market store (readonly)
        ├── TradePanel       → order store (create) + market store
        ├── OrderList        → order store (readonly)
        ├── PositionList     → position store (readonly)
        └── TradeRecord      → trade store (readonly)
```

1. 页面挂载 → WebSocket 建立连接
2. WebSocket 收到行情 → 写入 `market store` → MarketBoard 响应式更新
3. WebSocket 收到用户事件 → 写入 `order / position / trade store` → 各列表组件响应式更新
4. 用户下单 → `api.ts` POST 到后端 → 后端撮合 → 实时服务推送 WebSocket → store 更新

## 依赖服务

| 服务 | 端口 | 说明 |
|---|---|---|
| stock-trading-backend | :3000 | REST API（代理 /api → localhost:3000） |
| stock-trading-realtime | :3001 | WebSocket 实时行情推送 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 5173）
npm run dev

# 类型检查 + 构建
npm run build

# 预览构建产物
npm run preview
```

## 认证机制

系统使用 **HttpOnly Cookie** 进行用户认证，登录成功后后端自动设置 `userId` Cookie（有效期 24 小时），
所有后续请求浏览器自动携带，无需前端显式传递 userId 参数。

## HTTP API 清单

| 方法 | 路径 | 说明 | 认证 |
|---|---|---|---|
| POST | `/api/auth/register` | 注册（成功后设置 Cookie） | 否 |
| POST | `/api/auth/login` | 登录（成功后设置 Cookie） | 否 |
| POST | `/api/auth/logout` | 登出（清除 Cookie） | 否 |
| GET | `/api/auth/user` | 查询用户信息（余额等，从 Cookie 读取用户身份） | 是 |
| POST | `/api/orders` | 下单（从 Cookie 读取用户身份） | 是 |
| GET | `/api/orders` | 查询委托 | 是 |
| GET | `/api/positions` | 查询持仓 | 是 |
| GET | `/api/trades` | 查询成交记录 | 是 |

## WebSocket 消息协议

**服务端 → 客户端：**
- `type: "quotes"` → 全部股票行情（首次订阅）→ 批量更新 market store
- `type: "quote"` → 单支行情推送 → 更新 market store
- `type: "order"` → 委托更新 → 更新 order store
- `type: "position"` → 持仓更新 → 更新 position store
- `type: "trade"` → 成交推送 → 更新 trade store
- `type: "sync"` → 全量状态同步（重连后）
- `type: "error"` → 错误消息

**客户端 → 服务端：**
- `type: "subscribe"` → 订阅用户频道
- `type: "resync"` → 重连后请求同步

## Docker

```bash
docker build -t stock-trading-frontend .
docker run -p 5173:5173 stock-trading-frontend
```
