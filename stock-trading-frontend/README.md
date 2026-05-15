# stock-trading-frontend · 股票交易系统前端

Vue 3 + TypeScript + Vite 构建的股票模拟交易系统前端，采用极简工业风 B 端 UI 设计。

## 技术栈

| 类别 | 技术 | 说明 |
|---|---|---|
| 框架 | Vue 3 (`<script setup>`) | Composition API |
| 语言 | TypeScript | 严格类型 |
| 构建 | Vite / Rolldown | 极速 HMR + 生产构建 |
| 状态 | Pinia | 响应式 store |
| 路由 | Vue Router 4 | 动态路由 |
| HTTP | Axios | REST API 代理 |
| 实时 | WebSocket | 断线重连、行情全量推送 |

## 项目结构

```
src/
├── main.ts                    # 入口：挂载 App + Pinia + Router
├── App.vue                    # 根组件：AppLayout + RouterView
├── router/
│   └── index.ts               # 路由配置（/ → 行情 | /stock/:code → 个股 | /profile → 资产）
├── stores/                    # Pinia 状态管理
│   ├── auth.ts                # 用户认证（含 guest 游客模式）
│   ├── market.ts              # 行情数据
│   ├── order.ts               # 委托订单
│   ├── position.ts            # 持仓管理
│   └── trade.ts               # 成交记录
├── services/                  # 网络层
│   ├── api.ts                 # Axios REST 封装（/api → localhost:3000）
│   └── websocket.ts           # WebSocket 客户端（断线重连）
├── types/
│   └── index.ts               # 共享 TypeScript 类型
├── composables/
│   └── useSimulation.ts       # WebSocket 行情驱动（stockRefs / 分时 tick / K 线）
├── views/                     # 页面组件
│   ├── HomeView.vue           # 首页：上证 K 线 + 股票涨跌列表
│   ├── StockDetailView.vue    # 个股详情：K 线 + 挂单信息 + 快速交易
│   └── ProfileView.vue        # 个人中心：资产/盈亏曲线/持仓/交易记录
├── components/                # 可复用组件
│   ├── AppLayout.vue          # 顶部导航布局（暗色工业风）
│   └── KLineChart.vue         # HQChart K线图封装
├── assets/
│   └── main.css               # 全局暗色主题（CSS 变量 + 红绿色阶）
```

## 路由设计

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | HomeView | 上证指数 K 线 + 20 只股票实时涨跌（WebSocket 驱动） |
| `/stock/:code` | StockDetailView | 个股 K 线 + 挂单明细 + 快速买卖 |
| `/profile` | ProfileView | 总资产 / 盈亏曲线 / 持仓 / 交易记录 |

## 页面功能说明

### 行情页 `/`

- **左栏（3/5）**：上证指数 Canvas K 线图（支持实时 / 日K / 周K / 月K 切换）+ 实时价格 / 涨跌幅
- **右栏（2/5）**：20 只 A 股列表，WebSocket 实时推送行情更新
  - 双击任意行 → 跳转个股详情
  - 红绿颜色区分涨跌

### 个股详情 `/stock/:code`

- **顶部栏**：返回按钮 + 股票名称 / 代码 + 实时价格 + OHL 数据 + 挂单标记（买挂 N 手 / 卖挂 N 手）
- **左栏**：K 线图（支持实时/日 K/周 K/月 K 切换）
- **中栏**：五档盘口（买一~买五 / 卖一~卖五） + 交易明细（模拟其他用户实时成交，仅展示不参与计算），固定 340px 宽
- **右栏**：
  - **盘口信息**：最高/最低/今开/昨收/成交量/成交额/换手率/振幅/市盈率/每股收益/每股净资产/流通股本/总市值/流通市值/市净率
  - **账户持仓**：可用余额 / 持有股数 / 持仓成本 / 持仓市值 / 浮动盈亏
  - **快速交易**：价格 / 数量输入 + 买入 / 卖出按钮
  - **挂单明细**：买入挂单 / 卖出挂单（方向 / 价格 / 数量 / 已成交 / 状态）

### 个人中心 `/profile`

- **顶部 4 卡片**：总资产 / 持仓市值 / 可用余额 / 累计盈亏（含百分比）
- **左栏（3/5）**：30 天盈亏曲线（Canvas 绘制，贝塞尔平滑 + 渐变填充 + 网格线）
- **右栏（2/5）**：Tab 切换
  - **持仓明细**：股票 / 持仓股数 / 均价 / 现价 / 盈亏金额 / 盈亏%
  - **交易记录**：股票 / 方向 / 价格 / 数量 / 盈亏 / 时间

## 设计风格

- **暗色工业风**（`#0a0e14` 底色）：高对比度、低饱和度、专业交易终端
- **红绿色阶**：红涨绿跌（`#e5534b` / `#3fb950`）
- **霓虹蓝强调**：`#388bfd` / `#58a6ff`
- **等宽数字**：所有价格 / 收益率使用 `SF Mono` / `Consolas`
- **CSS 变量体系**：统一管理颜色、边框、字号

## 数据流

```
WebSocket (:3001) ─→ marketWebSocket.connect()
  ├─ sync 消息 ─→ 全量行情 quotes ─→ useMarketStore  ─→ useSimulation.tickFromWebSocket()
  ├─ quote 消息 ─→  单只行情更新  ─→ useMarketStore  ─→ stockRefs / currentPrices / stockTicks
  ├─ order 消息 ─→ 委托变更      ─→ useOrderStore
  ├─ position 消息 ─→ 持仓变更   ─→ usePositionStore
  └─ trade 消息 ─→ 成交推送     ─→ useTradeStore

REST API (:3000) ─→ api.ts (Axios)
  ├─ /api/auth/* ─→ useAuthStore
  ├─ /api/orders ─→ 下单
  └─ /api/trades / positions ─→ 轮询兜底

AppLayout (导航栏)
└── <RouterView>
    ├── HomeView          ← useSimulation (stockRefs / indexTicks / K 线)
    ├── StockDetailView   ← useSimulation (stockRefs / stockTicks / K 线) + Order/Position/Auth Store
    └── ProfileView       ← useSimulation (stockRefs / currentPrices) + Position/Trade/PnL/Auth Store
```

所有行情数据全权由后端 WebSocket 推送，前端不主动请求 CSV 或历史数据文件。

## 依赖服务

| 服务 | 端口 | 说明 |
|---|---|---|
| stock-trading-backend | :3000 | REST API |
| stock-trading-realtime | :3001 | WebSocket 行情推送 |

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 (localhost:5173)
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览构建产物
```

前端需配合后端服务才能获取行情数据，WebSocket 行情推送端口 `:3001`，REST API 端口 `:3000`。

## Docker

```bash
docker build -t stock-trading-frontend .
docker run -p 5173:5173 stock-trading-frontend
```
