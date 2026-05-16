"""
基于网络查询的真实日线数据，生成2026-01-05秒级日内模拟数据。
- 20支股票：使用布朗桥模型
- 上证指数(000001)：使用V字形曲线
- 深证成指(399001)和创业板指(399006)：使用布朗桥模型

用法: python scripts/generate_intraday_real.py [--seed 42]
输出: data/intraday/*_intraday.csv（23个文件）
"""
import csv
import math
import os
import random
import sys
import time
from datetime import datetime, timedelta

import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
OUTPUT_DIR = os.path.join(DATA_DIR, "intraday")

TARGET_DATE = "2026-01-05"
PREV_DATE = "2025-12-31"

MORNING_START = (9, 30, 0)
MORNING_END = (11, 30, 0)
AFTERNOON_START = (13, 0, 0)
AFTERNOON_END = (15, 0, 0)

STOCK_LIST = [
    ("600519", "贵州茅台", "sh"),
    ("000858", "五粮液", "sz"),
    ("300750", "宁德时代", "sz"),
    ("002594", "比亚迪", "sz"),
    ("601318", "中国平安", "sh"),
    ("600036", "招商银行", "sh"),
    ("000333", "美的集团", "sz"),
    ("000651", "格力电器", "sz"),
    ("600276", "恒瑞医药", "sh"),
    ("000725", "京东方A", "sz"),
    ("002415", "海康威视", "sz"),
    ("300059", "东方财富", "sz"),
    ("601012", "隆基绿能", "sh"),
    ("600900", "长江电力", "sh"),
    ("002475", "立讯精密", "sz"),
    ("601899", "紫金矿业", "sh"),
    ("000063", "中兴通讯", "sz"),
    ("600809", "山西汾酒", "sh"),
    ("300124", "汇川技术", "sz"),
    ("002230", "科大讯飞", "sz"),
]

# 指数数据来自网络搜索（Sina kline API 指数支持有限，使用搜索到的真实数据）
INDEX_DATA = {
    "000001": {  # 上证指数 - V字形
        "name": "上证指数",
        "open": 3986.97,
        "close": 4023.42,
        "high": 4025.26,
        "low": 3983.58,
        "volume": 5969500,   # 万手 -> 统一量纲
        "amount": 1067334000000,  # 亿元 -> 元
    },
    "399001": {  # 深证成指
        "name": "深证成指",
        "open": 13633.63,
        "close": 13828.63,
        "high": 13828.97,
        "low": 13633.63,
        "volume": 8309650,
        "amount": 1479013000000,
    },
    "399006": {  # 创业板指
        "name": "创业板指",
        "open": 3229.93,
        "close": 3280.38,
        "high": 3282.56,
        "low": 3229.93,
        "volume": 2800000,
        "amount": 480000000000,
    },
}

SESSION = requests.Session()
SESSION.trust_env = False
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn",
})


def generate_second_timestamps():
    timestamps = []
    t = datetime(2000, 1, 1, *MORNING_START)
    end = datetime(2000, 1, 1, *MORNING_END)
    while t <= end:
        timestamps.append(t.strftime("%H:%M:%S"))
        t += timedelta(seconds=1)
    t = datetime(2000, 1, 1, *AFTERNOON_START)
    end = datetime(2000, 1, 1, *AFTERNOON_END)
    while t <= end:
        timestamps.append(t.strftime("%H:%M:%S"))
        t += timedelta(seconds=1)
    return timestamps


def box_muller():
    u1 = random.random()
    u2 = random.random()
    if u1 <= 0:
        u1 = 1e-10
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


def fetch_sina_daily_kline(code: str, market: str) -> list[dict]:
    symbol = f"{market}{code}"
    url = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData"
    params = {"symbol": symbol, "scale": "240", "ma": "no", "datalen": "200"}
    try:
        r = SESSION.get(url, params=params, timeout=20)
        if r.status_code == 200 and r.text.strip():
            return r.json()
    except Exception as e:
        print(f"  [WARN] 查询 {code} 失败: {e}")
    return []


def fetch_stock_data(code: str, market: str, name: str) -> tuple[dict | None, float]:
    """
    一次API调用同时获取目标日OHLCV和前收盘价。
    返回: (ohlcv_dict | None, prev_close: float)
    """
    data = fetch_sina_daily_kline(code, market)
    ohlcv = None
    prev_close = 0.0

    # 按日期排序（Sina返回的是倒序？先检查）
    if data:
        for d in data:
            if d["day"] == TARGET_DATE:
                o = float(d["open"])
                c = float(d["close"])
                h = float(d["high"])
                l = float(d["low"])
                v = int(float(d["volume"]))
                avg_price = (o + c + h + l) / 4
                amt = int(avg_price * v)
                ohlcv = {
                    "code": code,
                    "name": name,
                    "open": o,
                    "close": c,
                    "high": h,
                    "low": l,
                    "volume": v,
                    "amount": amt,
                }
            if d["day"] == PREV_DATE:
                prev_close = float(d["close"])

        if prev_close == 0.0 and data:
            for d in data:
                if d["day"] < TARGET_DATE:
                    prev_close = float(d["close"])

    return ohlcv, prev_close


def build_brownian_bridge(open_price, close_price, high_price, low_price, n_steps, volatility_scale=0.003):
    N = n_steps
    a = open_price
    b = close_price
    price_range = high_price - low_price
    step_vol = volatility_scale * price_range / math.sqrt(N) if N > 1 else 0

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

    if N >= 3 and prices[N - 2] == prices[N - 1]:
        for offset in (0.01, -0.01, 0.02, -0.02, 0.03, -0.03):
            new_val = round(prices[N - 2] + offset, 2)
            if low_price <= new_val <= high_price and new_val != prices[N - 3]:
                prices[N - 2] = new_val
                break

    return prices


def build_v_shape_curve(open_price, close_price, high_price, low_price, n_steps):
    """
    V字形曲线：开盘后逐步走低探底，午盘前后触底，午后持续反弹至收盘。
    上证指数 2026-01-05: O=3986.97, L=3983.58, H=4025.26, C=4023.42
    日内低点接近开盘价（微幅下探），随后一路走高。高点出现在收盘附近。
    """
    prices = [0.0] * n_steps

    # 三个阶段的比例
    trough_frac = 0.28       # 低点约在 10:15 前后（开盘后约45分钟）
    accelerate_frac = 0.55   # 加速反弹点约在 11:30 前后

    trough_idx = int(n_steps * trough_frac)
    accelerate_idx = int(n_steps * accelerate_frac)

    # 第一段：开盘 → 低点（震荡下行）
    seg1 = trough_idx
    for i in range(seg1):
        frac = i / max(seg1 - 1, 1)
        base = open_price + (low_price - open_price) * frac
        wave = math.sin(frac * math.pi * 2.5) * (high_price - low_price) * 0.015 * (1 - frac)
        noise = box_muller() * (high_price - low_price) * 0.003
        prices[i] = round(base + wave + noise, 2)

    # 第二段：低点 → 加速反弹点（缓慢回升，信心建立期）
    seg2 = accelerate_idx - seg1
    for i in range(seg2):
        frac = i / max(seg2 - 1, 1)
        base = low_price + (high_price - low_price) * 0.2 * frac
        wave = math.sin(frac * math.pi * 1.5) * (high_price - low_price) * 0.03 * (1 - frac * 0.5)
        noise = box_muller() * (high_price - low_price) * 0.005
        idx = seg1 + i
        prices[idx] = round(base + wave + noise, 2)

    # 第三段：加速反弹点 → 收盘（主升浪，接近高点）
    seg3 = n_steps - accelerate_idx
    start_price = prices[accelerate_idx - 1] if accelerate_idx > 0 else low_price
    for i in range(seg3):
        frac = i / max(seg3 - 1, 1)
        base = start_price + (close_price - start_price) * frac
        wave = math.sin(frac * math.pi * 3.0) * (high_price - low_price) * 0.025 * (1 - frac)
        noise = box_muller() * (high_price - low_price) * 0.004
        idx = accelerate_idx + i
        val = base + wave + noise
        if frac > 0.85:
            val += (close_price - val) * (frac - 0.85) * 6
        prices[idx] = round(val, 2)

    # 硬约束边界
    for i in range(n_steps):
        prices[i] = max(low_price - 2, min(high_price + 2, prices[i]))

    # 固定首尾
    prices[0] = round(open_price, 2)
    prices[-1] = round(close_price, 2)

    return prices


def distribute_volume(total_volume, prices, n_steps):
    weights = []
    for i in range(n_steps):
        pos = i / (n_steps - 1) if n_steps > 1 else 0.5
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


def write_intraday_csv(code, name, prices, volumes, prev_close, trade_date, timestamps):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, f"{code}_{name}_intraday.csv")
    n = len(timestamps)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "price", "change_amount", "change_pct", "volume", "amount"])
        for i in range(n):
            p = prices[i]
            change_amount = round(p - prev_close, 2)
            change_pct = round((p - prev_close) / prev_close * 100, 2)
            amt = int(round(volumes[i] * p))
            writer.writerow([
                f"{trade_date} {timestamps[i]}",
                f"{p:.2f}",
                f"{change_amount:.2f}",
                f"{change_pct:.2f}",
                str(volumes[i]),
                str(amt),
            ])
    return filepath


def main():
    seed = 42
    if len(sys.argv) > 2 and sys.argv[1] == "--seed":
        seed = int(sys.argv[2])
    random.seed(seed)

    timestamps = generate_second_timestamps()
    n_steps = len(timestamps)
    print(f"交易日秒数: {n_steps}")
    print(f"目标日期: {TARGET_DATE}\n")

    # ===== 第一部分：查询20支个股（含前收盘价） =====
    print("=" * 60)
    print("第一步：从新浪财经查询个股真实日线数据 + 前收盘价")
    print("=" * 60)

    stock_ohlcv = {}
    prev_close_map = {}
    for code, name, market in STOCK_LIST:
        result, pc = fetch_stock_data(code, market, name)
        if result:
            stock_ohlcv[code] = result
            prev_close_map[code] = pc if pc > 0 else result["open"]
            print(f"  OK  {code} {name}: prev={pc:.2f}  O={result['open']:.2f} C={result['close']:.2f} "
                  f"H={result['high']:.2f} L={result['low']:.2f} V={result['volume']}")
        else:
            print(f"  FAIL {code} {name}: 未查到 {TARGET_DATE} 数据")
        time.sleep(0.3)

    # 指数前收盘价 (来自web搜索)
    # 上证: 昨日收盘3968.84; 深证: 13525.02; 创业板: 约3229 (开盘=低=昨收)
    index_prev_close = {
        "000001": 3968.84,
        "399001": 13525.02,
        "399006": 3229.93,
    }

    # ===== 第二部分：生成秒级数据 =====
    print("\n" + "=" * 60)
    print("第二步：生成秒级日内模拟数据")
    print("=" * 60)

    # -- 2a. 生成20支个股（布朗桥）--
    for code, name, market in STOCK_LIST:
        if code not in stock_ohlcv:
            print(f"  SKIP {code} {name}: 无OHLCV数据")
            continue
        d = stock_ohlcv[code]
        pc = prev_close_map.get(code, d["open"])
        if pc == 0:
            pc = d["open"]

        daily_range_pct = (d["high"] - d["low"]) / d["open"] if d["open"] > 0 else 0.02
        vol_scale = max(0.05, min(0.25, daily_range_pct * 3.0))

        prices = build_brownian_bridge(d["open"], d["close"], d["high"], d["low"], n_steps, vol_scale)
        volumes = distribute_volume(d["volume"], prices, n_steps)
        filepath = write_intraday_csv(code, name, prices, volumes, pc, TARGET_DATE, timestamps)

        sim_h = max(prices)
        sim_l = min(prices)
        day_chg = (d["close"] - pc) / pc * 100
        print(f"  OK [stock] {code} {name:<6s}  "
              f"prev={pc:>10.2f}  O={d['open']:>10.2f} C={d['close']:>10.2f}  "
              f"H={d['high']:.2f}(sim:{sim_h:.2f}) L={d['low']:.2f}(sim:{sim_l:.2f})  "
              f"涨跌{day_chg:+.2f}%")

    # -- 2b. 生成指数（上证用V字形，其他用布朗桥）--
    for code in ["000001", "399001", "399006"]:
        d = INDEX_DATA[code]
        name = d["name"]
        pc = index_prev_close[code]

        if code == "000001":
            prices = build_v_shape_curve(d["open"], d["close"], d["high"], d["low"], n_steps)
            curve_type = "V-shape"
        else:
            daily_range_pct = (d["high"] - d["low"]) / d["open"] if d["open"] > 0 else 0.02
            vol_scale = max(0.05, min(0.25, daily_range_pct * 3.0))
            prices = build_brownian_bridge(d["open"], d["close"], d["high"], d["low"], n_steps, vol_scale)
            curve_type = "Brownian"

        volumes = distribute_volume(d["volume"], prices, n_steps)
        filepath = write_intraday_csv(code, name, prices, volumes, pc, TARGET_DATE, timestamps)

        sim_h = max(prices)
        sim_l = min(prices)
        print(f"  OK [index] {code} {name:<6s} [{curve_type}]  "
              f"prev={pc:>10.2f}  O={d['open']:>10.2f} C={d['close']:>10.2f}  "
              f"H={d['high']:.2f}(sim:{sim_h:.2f}) L={d['low']:.2f}(sim:{sim_l:.2f})")

    print(f"\n{'='*60}")
    print(f"完成！输出目录: {OUTPUT_DIR}")
    print(f"每文件 {n_steps} 秒数据")
    print(f"字段: timestamp, price, change_amount, change_pct, volume, amount")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
