---
name: "stock-simulator"
description: "生成20支股票（含3个指数）的秒级日内模拟CSV。用户给出日期时，从日线数据提取当日行情，用布朗桥模型模拟每秒价格/涨跌额/涨跌幅/成交量/成交额。当用户要求生成股票秒级模拟数据时调用。"
---

# 股票秒级日内模拟数据生成器

## 功能

根据指定的交易日，从 `stock-trading-backend/data/stocks/`（20支A股）和 `stock-trading-backend/data/indices/`（3个大盘指数）中日线OHLCV数据出发，使用布朗桥模型模拟该日每秒（09:30-11:30 + 13:00-15:00，共14402秒）的行情数据，生成23个CSV文件。

## 输出格式

每个CSV文件包含以下字段：

| 字段 | 说明 |
|------|------|
| `timestamp` | 时间戳，格式 `YYYY-MM-DD HH:MM:SS` |
| `price` | 每秒价格 |
| `change_amount` | 涨跌额（相对前收盘价） |
| `change_pct` | 涨跌幅百分比（相对前收盘价） |
| `volume` | 成交量（U型分布 + 泊松噪声） |
| `amount` | 成交额（price × volume） |

输出目录：`stock-trading-backend/data/intraday/<YYYY-MM-DD>/`

## 执行方式

当用户给出日期时，执行以下命令：

```bash
cd stock-trading-backend
python scripts/generate_intraday_v2.py --date <YYYY-MM-DD> [--seed <种子>]
```

- `--date`：必选，目标交易日，格式 `YYYY-MM-DD`
- `--seed`：可选，随机种子（默认42），保证结果可复现

## 算法说明

1. 从日线CSV中提取目标日期的 `open`、`close`、`high`、`low`、`volume`、`amount`
2. 从目标日期的前一交易日提取 `close` 作为前收盘价（用于计算涨跌额/涨跌幅）
3. 使用**布朗桥模型**生成严格收敛的价格路径（起点=开盘价，终点=收盘价，硬约束在 [low, high] 内）
4. 成交量按**U型曲线**分配（开盘/收盘高，午间低），叠加泊松噪声

## 注意事项

- 目标日期必须在日线数据的交易日区间内（2025-01-02 ~ 2026-01-02），周末和节假日无数据
- 若日期在日线CSV中不存在，脚本会跳过该文件并报告
- 共生成23个文件：20支股票 + 3个指数（上证指数、深证成指、创业板指）
