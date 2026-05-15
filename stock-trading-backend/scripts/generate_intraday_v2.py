"""
基于日线OHLCV锚点生成指定日期的秒级日内模拟数据（v2 增强版）
使用布朗桥模型约束日内价格路径，输出含涨跌额与涨跌幅

用法: python scripts/generate_intraday_v2.py --date 2025-06-15 [--seed 42]
输出: data/intraday/<YYYY-MM-DD>/*.csv（20支股票 + 3个指数的秒级数据）
"""
import argparse
import csv
import math
import os
import random
from datetime import datetime, time, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
STOCKS_DIR = os.path.join(DATA_DIR, "stocks")
INDICES_DIR = os.path.join(DATA_DIR, "indices")

MORNING_START = time(9, 30, 0)
MORNING_END = time(11, 30, 0)
AFTERNOON_START = time(13, 0, 0)
AFTERNOON_END = time(15, 0, 0)


def generate_second_timestamps() -> list[str]:
    timestamps = []

    t = datetime.combine(datetime.min, MORNING_START)
    end = datetime.combine(datetime.min, MORNING_END)
    while t <= end:
        timestamps.append(t.strftime("%H:%M:%S"))
        t += timedelta(seconds=1)

    t = datetime.combine(datetime.min, AFTERNOON_START)
    end = datetime.combine(datetime.min, AFTERNOON_END)
    while t <= end:
        timestamps.append(t.strftime("%H:%M:%S"))
        t += timedelta(seconds=1)

    return timestamps


def box_muller() -> float:
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
    N = n_steps
    a = open_price
    b = close_price
    price_range = high_price - low_price

    step_vol = volatility_scale * price_range / math.sqrt(N)

    Z = [0.0]
    for i in range(1, N):
        pos = i / (N - 1) if N > 1 else 0
        local_vol = step_vol * 1.5 if (pos < 0.1 or pos > 0.9) else step_vol
        epsilon = box_muller() * local_vol
        Z.append(Z[-1] + epsilon)

    Z_N = Z[-1]
    raw_prices = []
    for i in range(N):
        frac = i / (N - 1) if N > 1 else 0
        bridge = a + (b - a) * frac + (Z[i] - frac * Z_N)
        bridge = max(low_price, min(high_price, bridge))
        raw_prices.append(round(bridge, 2))

    prices = list(raw_prices)
    for i in range(1, N - 1):
        if prices[i] == prices[i - 1]:
            direction = 1 if random.random() < 0.5 else -1
            new_val = round(prices[i] + direction * 0.01, 2)
            if low_price <= new_val <= high_price:
                if i == N - 2 and new_val == prices[i + 1]:
                    new_val = round(prices[i] - direction * 0.01, 2)
                if low_price <= new_val <= high_price:
                    prices[i] = new_val
                    continue
            new_val = round(prices[i] - direction * 0.01, 2)
            if low_price <= new_val <= high_price:
                if i == N - 2 and new_val == prices[i + 1]:
                    new_val = round(prices[i] + direction * 0.02, 2)
                if low_price <= new_val <= high_price:
                    prices[i] = new_val
                    continue
            mid = round((low_price + high_price) / 2, 2)
            prices[i] = mid if prices[i - 1] != mid else round(mid + 0.01, 2)

    if prices[N - 2] == prices[N - 1]:
        for offset in (0.01, -0.01, 0.02, -0.02, 0.03, -0.03):
            new_val = round(prices[N - 2] + offset, 2)
            if low_price <= new_val <= high_price and new_val != prices[N - 3]:
                prices[N - 2] = new_val
                break

    return prices


def distribute_volume(
    total_volume: int,
    prices: list[float],
    n_steps: int,
) -> list[int]:
    weights = []
    for i in range(n_steps):
        pos = i / (n_steps - 1)
        u = (pos - 0.5) * 3.0
        w = math.cosh(u)
        weights.append(w)

    total_weight = sum(weights)
    volumes = []
    for i in range(n_steps):
        v = max(0, int(round(total_volume * weights[i] / total_weight)))
        if v > 0:
            noise = random.gauss(0, math.sqrt(v))
            v = max(0, int(round(v + noise)))
        volumes.append(v)

    current_total = sum(volumes)
    if current_total > 0 and current_total != total_volume:
        scale = total_volume / current_total
        for i in range(n_steps):
            volumes[i] = max(0, int(round(volumes[i] * scale)))

    return volumes


def read_daily_data_for_date(filepath: str, target_date: str) -> tuple[dict | None, float]:
    """
    读取CSV，返回目标日期的OHLCV dict和前一交易日的收盘价。
    若无前一交易日，以前收盘价 = 当日开盘价。
    """
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if len(rows) < 2:
        return None, 0.0

    prev_close = None
    target_row = None

    for i, row in enumerate(rows):
        if row["date"] == target_date:
            target_row = row
            if i > 0:
                prev_close = float(rows[i - 1]["close"])
            break

    if target_row is None:
        return None, 0.0

    if prev_close is None:
        prev_close = float(target_row["open"])

    return target_row, prev_close


def main():
    parser = argparse.ArgumentParser(description="生成指定日期的秒级日内模拟数据（含涨跌额/涨跌幅）")
    parser.add_argument("--date", required=True, help="目标日期，格式 YYYY-MM-DD")
    parser.add_argument("--seed", type=int, default=42, help="随机种子（默认42）")
    args = parser.parse_args()

    trade_date = args.date
    random.seed(args.seed)

    output_dir = os.path.join(DATA_DIR, "intraday")
    os.makedirs(output_dir, exist_ok=True)

    timestamps = generate_second_timestamps()
    n_steps = len(timestamps)
    print(f"A股交易日秒数: {n_steps}（上午 {MORNING_START}-{MORNING_END}，下午 {AFTERNOON_START}-{AFTERNOON_END}）")
    print(f"目标日期: {trade_date}\n")

    all_files = []

    for fname in os.listdir(STOCKS_DIR):
        if fname.endswith(".csv"):
            all_files.append((STOCKS_DIR, fname, "stock"))

    for fname in os.listdir(INDICES_DIR):
        if fname.endswith(".csv"):
            all_files.append((INDICES_DIR, fname, "index"))

    all_files.sort(key=lambda x: x[1])

    success_count = 0
    failed_files = []

    for data_dir, fname, asset_type in all_files:
        filepath = os.path.join(data_dir, fname)
        basename = fname.replace(".csv", "")
        parts = basename.split("_", 1)
        code = parts[0]
        name = parts[1] if len(parts) > 1 else code

        target_row, prev_close = read_daily_data_for_date(filepath, trade_date)

        if target_row is None:
            failed_files.append(f"{code} {name}")
            print(f"  跳过 {code} {name}: 日期 {trade_date} 在日线数据中不存在")
            continue

        open_price = float(target_row["open"])
        close_price = float(target_row["close"])
        high_price = float(target_row["high"])
        low_price = float(target_row["low"])
        total_vol = int(target_row["volume"])
        total_amt = int(target_row["amount"])

        daily_range_pct = (high_price - low_price) / open_price
        vol_scale = max(0.05, min(0.25, daily_range_pct * 3.0))

        prices = build_brownian_bridge(
            open_price, close_price, high_price, low_price,
            n_steps, volatility_scale=vol_scale
        )

        volumes = distribute_volume(total_vol, prices, n_steps)

        intraday_file = os.path.join(output_dir, f"{code}_{name}_intraday.csv")
        with open(intraday_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "price", "change_amount", "change_pct", "volume", "amount"])
            for i in range(n_steps):
                p = prices[i]
                change_amount = round(p - prev_close, 2)
                change_pct = round((p - prev_close) / prev_close * 100, 2)
                amount = int(round(volumes[i] * p))
                writer.writerow([
                    f"{trade_date} {timestamps[i]}",
                    f"{p:.2f}",
                    f"{change_amount:.2f}",
                    f"{change_pct:.2f}",
                    str(volumes[i]),
                    str(amount)
                ])

        actual_h = max(prices)
        actual_l = min(prices)
        day_chg = (close_price - prev_close) / prev_close * 100
        intraday_chg = (close_price - open_price) / open_price * 100
        print(f"  OK {code} {name:<6s} [{asset_type}]  "
              f"前收={prev_close:>10.2f}  O={open_price:>10.2f} C={close_price:>10.2f}  "
              f"H={high_price:.2f}(sim:{actual_h:.2f}) L={low_price:.2f}(sim:{actual_l:.2f})  "
              f"日涨跌{day_chg:+.2f}%  振幅{intraday_chg:+.2f}%")

        success_count += 1

    print(f"\n{'='*60}")
    print(f"完成！成功 {success_count}/{len(all_files)}")
    if failed_files:
        print(f"失败 ({len(failed_files)}): {', '.join(failed_files)}")
    print(f"输出目录: {output_dir}")
    print(f"每支股票 {n_steps} 秒数据")
    print(f"字段: timestamp, price, change_amount, change_pct, volume, amount")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
