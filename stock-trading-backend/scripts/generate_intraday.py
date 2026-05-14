"""
基于日线OHLCV锚点生成秒级日内模拟数据
使用布朗桥模型（Brownian Bridge）约束日内价格路径

用法: python scripts/generate_intraday.py
输出: data/intraday/*.csv（每支股票一个文件）
      + data/intraday_summary.csv（合并文件）
"""
import csv
import math
import os
import random
from datetime import datetime, time, timedelta

random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
STOCKS_DIR = os.path.join(DATA_DIR, "stocks")
INTRADAY_DIR = os.path.join(DATA_DIR, "intraday")

TRADE_DATE = "2026-01-02"

# 交易日时间：每秒一个tick
# 上午 09:30:00 - 11:30:00（7200秒，含09:30:00）
# 下午 13:00:00 - 15:00:00（7200秒，含13:00:00）
MORNING_START = time(9, 30, 0)
MORNING_END   = time(11, 30, 0)
AFTERNOON_START = time(13, 0, 0)
AFTERNOON_END   = time(15, 0, 0)

def generate_second_timestamps() -> list[str]:
    """生成全天每秒的时间戳列表（HH:MM:SS）"""
    timestamps = []

    # 上午
    t = datetime.combine(datetime.min, MORNING_START)
    end = datetime.combine(datetime.min, MORNING_END)
    while t <= end:
        timestamps.append(t.strftime("%H:%M:%S"))
        t += timedelta(seconds=1)

    # 下午
    t = datetime.combine(datetime.min, AFTERNOON_START)
    end = datetime.combine(datetime.min, AFTERNOON_END)
    while t <= end:
        timestamps.append(t.strftime("%H:%M:%S"))
        t += timedelta(seconds=1)

    return timestamps


def box_muller() -> float:
    """Box-Muller变换生成标准正态分布随机数"""
    u1 = random.random()
    u2 = random.random()
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


def build_brownian_bridge(
    open_price: float,
    close_price: float,
    high_price: float,
    low_price: float,
    n_steps: int,
    volatility_scale: float = 0.003,
) -> list[float]:
    """
    生成严格收敛的布朗桥日内价格路径。
    先产生自由随机游走，再用 B_i = a + (b-a)*i/(N-1) + (Z_i - i/(N-1)*Z_{N-1}) 构造桥梁，
    保证 B_0 = open_price, B_{N-1} = close_price，且路径自然平滑。
    价格始终被硬约束在 [low_price, high_price] 范围内。
    """
    N = n_steps
    a = open_price
    b = close_price

    # 第一步：生成从 0 开始的自由随机游走 Z
    Z = [0.0]
    for i in range(1, N):
        pos = i / (N - 1) if N > 1 else 0
        if pos < 0.1 or pos > 0.9:
            local_vol = volatility_scale * 1.5
        else:
            local_vol = volatility_scale

        epsilon = box_muller() * local_vol * a
        Z.append(Z[-1] + epsilon)

    # 第二步：构造成布朗桥，保证终点严格收敛到 b
    Z_N = Z[-1]
    prices = []
    for i in range(N):
        frac = i / (N - 1) if N > 1 else 0
        # 布朗桥公式
        bridge = a + (b - a) * frac + (Z[i] - frac * Z_N)

        # 边界硬约束
        bridge = max(low_price, min(high_price, bridge))
        prices.append(round(bridge, 2))

    return prices


def distribute_volume(
    total_volume: int,
    total_amount: int,
    prices: list[float],
    n_steps: int,
) -> tuple[list[int], list[int]]:
    """
    按U型曲线分配成交量到每秒。
    开盘和收盘附近成交量最大，午间最小。
    """
    # U型权重：开盘高 → 中段低 → 尾盘高
    weights = []
    for i in range(n_steps):
        pos = i / (n_steps - 1)
        # 双曲余弦形状的U型曲线
        u = (pos - 0.5) * 3.0  # 缩放因子
        w = math.cosh(u)
        weights.append(w)

    total_weight = sum(weights)

    volumes = []
    amounts = []
    for i in range(n_steps):
        v = max(0, int(round(total_volume * weights[i] / total_weight)))
        # 加入泊松噪声使成交量不显得太均匀
        if v > 0:
            noise = random.gauss(0, math.sqrt(v))
            v = max(0, int(round(v + noise)))
        volumes.append(v)
        amounts.append(int(round(v * prices[i])))

    # 调整总量使总成交量接近原始值
    current_total = sum(volumes)
    if current_total > 0 and current_total != total_volume:
        scale = total_volume / current_total
        for i in range(n_steps):
            volumes[i] = max(0, int(round(volumes[i] * scale)))

    # 重新计算成交额
    for i in range(n_steps):
        amounts[i] = int(round(volumes[i] * prices[i]))

    return volumes, amounts


def read_daily_ohlcv(filepath: str) -> dict | None:
    """读取CSV文件的最后一行（2026-01-02的OHLCV数据）"""
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if len(rows) < 2:
        return None

    header = rows[0]
    last_row = rows[-1]

    data = dict(zip(header, last_row))
    return data


def main():
    os.makedirs(INTRADAY_DIR, exist_ok=True)

    timestamps = generate_second_timestamps()
    n_steps = len(timestamps)
    print(f"A股交易日秒数: {n_steps}（上午 {MORNING_START}-{MORNING_END}，下午 {AFTERNOON_START}-{AFTERNOON_END}）")
    print(f"日期: {TRADE_DATE}\n")

    # 确保随机种子的可复现性
    random.seed(20260102)

    stock_files = sorted(
        [f for f in os.listdir(STOCKS_DIR) if f.endswith(".csv")]
    )

    summary_rows = []

    for filename in stock_files:
        filepath = os.path.join(STOCKS_DIR, filename)
        # 从文件名解析代码和名称: "600519_贵州茅台.csv"
        basename = filename.replace(".csv", "")
        parts = basename.split("_", 1)
        code = parts[0]
        name = parts[1] if len(parts) > 1 else code

        daily = read_daily_ohlcv(filepath)
        if daily is None:
            print(f"  跳过 {filename}: 无数据")
            continue

        open_price  = float(daily["open"])
        close_price = float(daily["close"])
        high_price  = float(daily["high"])
        low_price   = float(daily["low"])
        total_vol   = int(daily["volume"])
        total_amt   = int(daily["amount"])

        # 波动率缩放因子：基于日内波幅调整
        daily_range_pct = (high_price - low_price) / open_price
        vol_scale = max(0.0005, min(0.02, daily_range_pct * 0.15))

        # 生成价格路径
        prices = build_brownian_bridge(
            open_price, close_price, high_price, low_price,
            n_steps, volatility_scale=vol_scale
        )

        # 分配成交量
        volumes, amounts = distribute_volume(total_vol, total_amt, prices, n_steps)

        # 写入个股CSV
        intraday_file = os.path.join(INTRADAY_DIR, f"{code}_{name}_intraday.csv")
        with open(intraday_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "price", "volume", "amount"])
            for i in range(n_steps):
                writer.writerow([
                    f"{TRADE_DATE} {timestamps[i]}",
                    f"{prices[i]:.2f}",
                    str(volumes[i]),
                    str(amounts[i])
                ])

        actual_h = max(prices)
        actual_l = min(prices)
        chg_pct = (close_price - open_price) / open_price * 100

        print(f"  OK {code} {name:<6s}  "
              f"O={open_price:>10.2f} C={close_price:>10.2f} "
              f"H={high_price:>10.2f}(sim:{actual_h:.2f}) L={low_price:>8.2f}(sim:{actual_l:.2f}) "
              f"涨跌{chg_pct:+.2f}%")

        summary_rows.append({
            "code": code,
            "name": name,
            "open": open_price,
            "close": close_price,
            "high": high_price,
            "low": low_price,
            "change_pct": round(chg_pct, 2),
            "file": f"intraday/{code}_{name}_intraday.csv"
        })

    # 写入合并摘要CSV
    summary_path = os.path.join(DATA_DIR, "intraday_summary.csv")
    with open(summary_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["code", "name", "open", "close", "high", "low",
                         "change_pct", "file", "date", "resolution"])
        for row in summary_rows:
            writer.writerow([
                row["code"], row["name"],
                row["open"], row["close"],
                row["high"], row["low"],
                row["change_pct"], row["file"],
                TRADE_DATE, "1s"
            ])

    print(f"\n{'='*60}")
    print(f"全部完成！输出目录: {INTRADAY_DIR}")
    print(f"  共生成 {len(summary_rows)} 支股票的秒级日内数据")
    print(f"  摘要文件: {summary_path}")
    print(f"  每支股票 {n_steps} 秒 ({n_steps // 3600}h{n_steps % 3600 // 60}m{n_steps % 60}s)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
