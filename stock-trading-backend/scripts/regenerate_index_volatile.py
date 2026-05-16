"""
上证指数 — 约束随机游走 + 端点重归一化。
无布朗桥修正 → 路径自由探索 [low, high] → 产生频繁波折。
"""
import csv, math, os, random
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
TARGET_DATE, PREV_DATE = "2025-12-31", "2025-12-30"
CODE, NAME = "000001", "上证指数"
random.seed(999)


def gen_ts():
    ts = []
    t = datetime(2000, 1, 1, 9, 30)
    for _ in range(7201):
        ts.append(t.strftime("%H:%M:%S")); t += timedelta(seconds=1)
    t = datetime(2000, 1, 1, 13, 0)
    for _ in range(7201):
        ts.append(t.strftime("%H:%M:%S")); t += timedelta(seconds=1)
    return ts


def box_muller():
    return math.sqrt(-2 * math.log(max(random.random(), 1e-10))) * math.cos(2 * math.pi * random.random())


def constrained_random_walk(o, c, h, l, N, vol_rel, tail_fade=300):
    """
    返回 N 个价格，第一个 = o，最后一个 = c。
    [l, h] 内自由探索，末端渐近至 c。
    """
    rng = h - l
    step_std = vol_rel * rng

    prices = [o]
    prev_diff = 0.0
    for i in range(1, N - 1):
        noise = box_muller() * step_std

        if i > N - 1 - tail_fade:
            progress = (i - (N - 1 - tail_fade)) / tail_fade
            drift_to_close = (c - prices[-1]) * (progress * progress * 0.3 + 0.02)
        else:
            drift_to_close = 0.0

        mean_rev = -prev_diff * 0.40
        nxt = prices[-1] + noise + mean_rev + drift_to_close
        nxt = max(l, min(h, nxt))
        nxt = round(nxt, 2)
        prev_diff = nxt - prices[-1]
        prices.append(nxt)

    prices.append(round(c, 2))
    return prices


def dist_vol(total_vol, n):
    result = [math.cosh((i / max(n - 1, 1) - 0.5) * 2.5) for i in range(n)]
    tw = sum(result)
    result = [max(0, int(round(total_vol * w / tw))) for w in result]
    result = [v + random.randint(0, max(1, v // 4)) for v in result]
    diff = total_vol - sum(result)
    if diff:
        for i in range(min(abs(diff), n)):
            result[random.randint(0, n - 1)] = max(0, result[i] + (1 if diff > 0 else -1))
    return result


def load():
    with open(os.path.join(DATA_DIR, "indices", f"{CODE}_{NAME}.csv"), "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        target = prev = None
        for row in reader:
            if row["date"] == TARGET_DATE: target = row
            if row["date"] == PREV_DATE: prev = row
        pc = float(prev["close"]) if prev else float(target["open"])
        return (float(target["open"]), float(target["close"]),
                float(target["high"]), float(target["low"]),
                int(float(target["volume"])), int(float(target["amount"])), pc)


def analyze(prices, N, ref_h, ref_l):
    diffs = [prices[i] - prices[i-1] for i in range(1, N)]
    abs_diffs = [abs(d) for d in diffs]
    signs = sum(1 for i in range(1, len(diffs)) if diffs[i] * diffs[i-1] < 0)
    sim_h, sim_l = max(prices), min(prices)

    runs, cur = [], 1
    for i in range(2, len(diffs)):
        if diffs[i] * diffs[i-1] > 0: cur += 1
        else: runs.append(cur); cur = 1
    runs.append(cur)

    print(f"最高: {sim_h:.2f}  ({ref_h:.2f})  最低: {sim_l:.2f}  ({ref_l:.2f})")
    print(f"区间利用: {(sim_h-sim_l)/(ref_h-ref_l)*100:.1f}%")
    print(f"每秒波动: {sum(abs_diffs)/len(abs_diffs):.4f}  (东财:0.0109)")
    print(f"最大跳动: {max(abs_diffs):.2f}")
    print(f"换向: {signs} ({signs/N*100:.1f}%)  (东财:71.2%)")
    print(f"最长同向: {max(runs)}s  平均: {sum(runs)/len(runs):.1f}s  (东财:6s/1.4s)")
    print(f"前40s:", end="")
    for i in range(40):
        print(f" {prices[i]:.2f}", end="" if (i+1) % 10 else "\n")
    print()


def main():
    o, c, h, l, vol_total, amt_total, pc = load()
    print(f"O={o:.2f} C={c:.2f} H={h:.2f} L={l:.2f} pc={pc:.2f} rng={h-l:.2f}")

    ts = gen_ts()
    N = len(ts)

    # 东方财富相对噪声: std/range = 0.0149
    # vol_rel 控制随机游走每步相对波动
    vol_rel = 0.020

    prices = constrained_random_walk(o, c, h, l, N, vol_rel)
    analyze(prices, N, h, l)

    volumes = dist_vol(vol_total, N)

    with open(os.path.join(DATA_DIR, "intraday", f"{CODE}_{NAME}_intraday.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "price", "change_amount", "change_pct", "volume", "amount"])
        for i in range(N):
            p = prices[i]
            chg = round(p - pc, 2)
            pct = round((p - pc) / pc * 100, 2)
            amt = int(round(volumes[i] * p))
            w.writerow([f"{TARGET_DATE} {ts[i]}", f"{p:.2f}", f"{chg:.2f}", f"{pct:.2f}", str(volumes[i]), str(amt)])

    print(f"写入完成。")


if __name__ == "__main__":
    main()