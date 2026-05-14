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
| 实时 | WebSocket | 断线重连 |
| K 线 | HQChart + jQuery | 专业金融图表 |

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
├── data/
│   └── mock.ts                # Mock 数据（20 支 A 股 + K 线 + 用户资产）
├── views/                     # 页面组件
│   ├── HomeView.vue           # 首页：上证 K 线 + 股票涨跌列表
│   ├── StockDetailView.vue    # 个股详情：K 线 + 挂单信息 + 快速交易
│   └── ProfileView.vue        # 个人中心：资产/盈亏曲线/持仓/交易记录
├── components/                # 可复用组件
│   ├── AppLayout.vue          # 顶部导航布局（暗色工业风）
│   └── KLineChart.vue         # HQChart K线图封装
├── assets/
│   └── main.css               # 全局暗色主题（CSS 变量 + 红绿色阶）
└── hqchart.d.ts               # HQChart / jQuery 全局类型声明
```

## 路由设计

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | HomeView | 上证指数 K 线 + 20 支持股实时涨跌 |
| `/stock/:code` | StockDetailView | 个股 K 线 + 挂单明细 + 快速买卖 |
| `/profile` | ProfileView | 总资产 / 盈亏曲线 / 持仓 / 交易记录 |

## 页面功能说明

### 行情页 `/`

- **左栏（3/5）**：上证指数 HQChart K 线图（含 MA / VOL / MACD 指标）+ 实时价格 / 涨跌幅 / OHL
- **右栏（2/5）**：20 支 A 股列表，每隔 2 秒随机游走模拟行情波动
  - 顶部统计：上涨 / 平盘 / 下跌 家数
  - 双击任意行 → 跳转个股详情
  - 红绿颜色区分涨跌

### 个股详情 `/stock/:code`

- **顶部栏**：返回按钮 + 股票名称 / 代码 + 实时价格 + OHL 数据 + 挂单标记（买挂 N 手 / 卖挂 N 手）
- **左栏（3/4）**：HQChart K 线图
- **右栏（1/4）**：
  - 快速交易面板（价格 / 数量输入 + 买入 / 卖出按钮）
  - 挂单明细列表（方向 / 价格 / 数量 / 已成交 / 状态）

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
App.vue
└── AppLayout (导航栏)
    └── <RouterView>
        ├── HomeView           → mock.ts（K 线 + 行情）
        ├── StockDetailView    → mock.ts（K 线 + 挂单）
        └── ProfileView        → mock.ts（资产 + 持仓 + 交易）
```

**Mock 模式**（当前）：所有数据由 `src/data/mock.ts` 提供，无需后端即可全功能预览。20 支持股模拟随机行情波动。

**完整模式**（对接后端后）：WebSocket 实时驱动 market store → 各组件响应式更新。用户下单 → REST API → 撮合 → WebSocket 推送。

## 依赖服务（完整模式）

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

**无需后端即可运行**：`npm run dev` 后直接访问 `localhost:5173`，所有页面均使用内置 Mock 数据渲染。

## Docker

```bash
docker build -t stock-trading-frontend .
docker run -p 5173:5173 stock-trading-frontend
```
