"""
基于真实价格基准的历史日K线数据生成器
使用几何布朗运动模拟，纯Python标准库，无外部依赖

用法: python scripts/generate_stock_data.py
输出: data/stocks/*.csv  +  data/indices/*.csv
"""
import csv
import math
import os
import random
from datetime import date, timedelta

random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
STOCKS_DIR = os.path.join(DATA_DIR, "stocks")
INDICES_DIR = os.path.join(DATA_DIR, "indices")

START_DATE = date(2025, 1, 2)
END_DATE = date(2026, 1, 2)

# (代码, 名称, 基价(2025初), 年化波动率)
STOCKS = [
    ("600519", "贵州茅台", 1450.0, 0.22),
    ("000858", "五粮液",   130.0,  0.28),
    ("300750", "宁德时代", 250.0,  0.35),
    ("002594", "比亚迪",   280.0,  0.30),
    ("601318", "中国平安",  50.0,  0.18),
    ("600036", "招商银行",  42.0,  0.16),
    ("000333", "美的集团",  72.0,  0.20),
    ("000651", "格力电器",  42.0,  0.18),
    ("600276", "恒瑞医药",  48.0,  0.22),
    ("000725", "京东方A",    4.5,  0.25),
    ("002415", "海康威视",  33.0,  0.24),
    ("300059", "东方财富",  22.0,  0.32),
    ("601012", "隆基绿能",  16.0,  0.40),
    ("600900", "长江电力",  29.0,  0.13),
    ("002475", "立讯精密",  40.0,  0.28),
    ("601899", "紫金矿业",  18.0,  0.26),
    ("000063", "中兴通讯",  38.0,  0.30),
    ("600809", "山西汾酒", 200.0,  0.25),
    ("300124", "汇川技术",  65.0,  0.28),
    ("002230", "科大讯飞",  50.0,  0.33),
]

INDICES = [
    ("000001", "上证指数", 3200.0, 0.15),
    ("399001", "深证成指", 10000.0, 0.18),
    ("399006", "创业板指",  2000.0, 0.25),
]

def is_weekend(d: date) -> bool:
    return d.weekday() >= 5

def is_holiday(d: date) -> bool:
    """简化版中国假期判断（春节/国庆等关键长假）"""
    holidays = {
        date(2025, 1, 1),           # 元旦
        date(2025, 1, 28), date(2025, 1, 29), date(2025, 1, 30),
        date(2025, 1, 31), date(2025, 2, 3), date(2025, 2, 4),  # 春节
        date(2025, 4, 4), date(2025, 4, 7),                       # 清明
        date(2025, 5, 1), date(2025, 5, 2), date(2025, 5, 5),    # 劳动节
        date(2025, 6, 2),                                          # 端午
        date(2025, 9, 15),                                         # 中秋
        date(2025, 10, 1), date(2025, 10, 2), date(2025, 10, 3),
        date(2025, 10, 6), date(2025, 10, 7), date(2025, 10, 8),  # 国庆
        date(2026, 1, 1),                                          # 元旦
    }
    return d in holidays

def trading_days() -> list[date]:
    days = []
    d = START_DATE
    while d <= END_DATE:
        if not is_weekend(d) and not is_holiday(d):
            days.append(d)
        d += timedelta(days=1)
    return days

def box_muller() -> float:
    """Box-Muller 变换生成标准正态分布随机数"""
    u1 = random.random()
    u2 = random.random()
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)

def generate_prices(
    base_price: float, volatility: float, days: int, drift: float = 0.0
) -> list[tuple[float, float, float, float, float]]:
    """
    生成 OHLCV 数据
    返回: [(open, close, high, low, volume), ...]
    """
    results = []
    price = base_price
    dt = 1.0 / 244  # 日度时间步长

    for i in range(days):
        # 对数收益率 = 漂移 + 波动 * 随机项
        # 添加微弱均值回归
        mean_reversion = -0.002 * (price / base_price - 1.0)
        ret = (drift + mean_reversion) * dt + volatility * math.sqrt(dt) * box_muller()

        open_price = price
        close_price = price * math.exp(ret)

        # 日内波动
        intraday_vol = volatility * math.sqrt(dt) * 0.6
        high_price = max(open_price, close_price) * (1.0 + abs(box_muller()) * intraday_vol)
        low_price = min(open_price, close_price) * (1.0 - abs(box_muller()) * intraday_vol)

        # 成交量：基于价格水平的合理范围，带随机性
        base_vol = 5_000_000 + random.gauss(0, 2_000_000)
        vol_mult = base_price / price if price > 0 else 1.0
        volume = max(100_000, int(base_vol * vol_mult * (0.5 + random.random())))

        # 成交额 = 成交量 * 均价
        amount = int(volume * (open_price + close_price + high_price + low_price) / 4)

        results.append((round(open_price, 2), round(close_price, 2),
                        round(high_price, 2), round(low_price, 2),
                        volume, amount))

        price = close_price

    return results

def main():
    os.makedirs(STOCKS_DIR, exist_ok=True)
    os.makedirs(INDICES_DIR, exist_ok=True)

    days = trading_days()
    print(f"交易日数: {len(days)}")
    print(f"日期范围: {days[0]} ~ {days[-1]}")

    # ---- 股票 ----
    print(f"\n{'='*60}")
    print("生成 20 支股票日K线数据")
    print(f"{'='*60}")

    for code, name, base, vol in STOCKS:
        filepath = os.path.join(STOCKS_DIR, f"{code}_{name}.csv")
        prices = generate_prices(base, vol, len(days))

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["date", "open", "close", "high", "low", "volume", "amount"])
            for i, d in enumerate(days):
                o, c, h, l, v, a = prices[i]
                writer.writerow([
                    d.strftime("%Y-%m-%d"),
                    f"{o:.2f}", f"{c:.2f}", f"{h:.2f}", f"{l:.2f}",
                    str(v), str(a)
                ])

        first_c = prices[0][1]
        last_c = prices[-1][1]
        chg = (last_c - first_c) / first_c * 100
        print(f"  OK {code} {name:<6s}  {base:>8.1f} -> {first_c:>8.2f} -> {last_c:>8.2f}  ({chg:+.1f}%)")

    # ---- 大盘指数 ----
    print(f"\n{'='*60}")
    print("生成 3 个大盘指数日K线数据")
    print(f"{'='*60}")

    for code, name, base, vol in INDICES:
        filepath = os.path.join(INDICES_DIR, f"{code}_{name}.csv")
        prices = generate_prices(base, vol, len(days))

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["date", "open", "close", "high", "low", "volume", "amount"])
            for i, d in enumerate(days):
                o, c, h, l, v, a = prices[i]
                writer.writerow([
                    d.strftime("%Y-%m-%d"),
                    f"{o:.2f}", f"{c:.2f}", f"{h:.2f}", f"{l:.2f}",
                    str(v), str(a)
                ])

        first_c = prices[0][1]
        last_c = prices[-1][1]
        chg = (last_c - first_c) / first_c * 100
        print(f"  OK {code} {name:<6s}  {base:>8.1f} -> {first_c:>8.2f} -> {last_c:>8.2f}  ({chg:+.1f}%)")

    # ---- 汇总文件 ----
    summary_path = os.path.join(DATA_DIR, "stock_master.csv")
    with open(summary_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["code", "name", "type", "base_price", "volatility", "file"])
        for code, name, base, vol in STOCKS:
            writer.writerow([code, name, "stock", base, vol, f"stocks/{code}_{name}.csv"])
        for code, name, base, vol in INDICES:
            writer.writerow([code, name, "index", base, vol, f"indices/{code}_{name}.csv"])

    print(f"\n{'='*60}")
    print(f"全部完成！输出目录: {DATA_DIR}")
    print(f"  stocks/:  {len(STOCKS)} 个文件")
    print(f"  indices/: {len(INDICES)} 个文件")
    print(f"  stock_master.csv: 汇总索引")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
