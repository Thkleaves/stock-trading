"""从本地日线 + 新生成的intraday CSV 生成 summary CSV (2025-12-31)"""
import csv
import os
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
STOCKS_DIR = os.path.join(DATA_DIR, "stocks")
INDICES_DIR = os.path.join(DATA_DIR, "indices")
INTRADAY_DIR = os.path.join(DATA_DIR, "intraday")

TARGET_DATE = "2025-12-31"
PREV_DATE = "2025-12-30"


def read_daily_ohlc(filepath, target_date):
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        target = None
        prev = None
        for row in reader:
            if row["date"] == target_date:
                target = row
            if row["date"] == PREV_DATE:
                prev = row
        if target is None:
            return None
        prev_close = float(prev["close"]) if prev else float(target["open"])
        return {
            "open": float(target["open"]),
            "close": float(target["close"]),
            "high": float(target["high"]),
            "low": float(target["low"]),
            "prev_close": prev_close,
        }


def get_sim_high_low(code, name):
    filepath = os.path.join(INTRADAY_DIR, f"{code}_{name}_intraday.csv")
    if not os.path.exists(filepath):
        print(f"  [WARN] 不存在: {filepath}")
        return 0, 0
    prices = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            prices.append(float(row["price"]))
    return max(prices), min(prices)


def main():
    rows = []

    stock_files = sorted([f for f in os.listdir(STOCKS_DIR) if f.endswith(".csv")])
    index_files = sorted([f for f in os.listdir(INDICES_DIR) if f.endswith(".csv")])

    for f in stock_files + index_files:
        if f.startswith("000001_"):
            src = INDICES_DIR
        elif f.startswith("399"):
            src = INDICES_DIR
        else:
            src = STOCKS_DIR

        code = f.split("_")[0]
        name = f.split("_")[1].replace(".csv", "")
        category = "index" if src == INDICES_DIR else "stock"

        ohlc = read_daily_ohlc(os.path.join(src, f), TARGET_DATE)
        if ohlc is None:
            print(f"  SKIP {code} {name}: {TARGET_DATE} 不在日线数据中")
            continue

        sim_h, sim_l = get_sim_high_low(code, name)
        pc = ohlc["prev_close"]
        chg_pct = round((ohlc["close"] - pc) / pc * 100, 2)
        file_path = f"intraday/{code}_{name}_intraday.csv"

        rows.append([code, name,
                     f"{ohlc['open']:.2f}", f"{ohlc['close']:.2f}",
                     f"{ohlc['high']:.2f}", f"{ohlc['low']:.2f}",
                     f"{chg_pct:.2f}", file_path, TARGET_DATE, "1s",
                     f"{sim_h:.2f}", f"{sim_l:.2f}"])

        print(f"  OK [{category}] {code} {name:<6s} "
              f"O={ohlc['open']:.2f} C={ohlc['close']:.2f} "
              f"H={ohlc['high']:.2f}(sim:{sim_h:.2f}) L={ohlc['low']:.2f}(sim:{sim_l:.2f}) "
              f"chg={chg_pct:+.2f}%")

    rows.sort(key=lambda r: (1 if r[0] in ("000001", "399001", "399006") else 0, r[0]))

    output_path = os.path.join(DATA_DIR, "intraday_summary.csv")
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["code", "name", "open", "close", "high", "low", "change_pct",
                         "file", "date", "resolution", "sim_high", "sim_low"])
        for row in rows:
            writer.writerow(row)

    print(f"\n完成！{len(rows)} 条记录 → {output_path}")


if __name__ == "__main__":
    main()