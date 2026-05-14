"""
基于20支股票秒级日内数据合成三大指数（上证指数/深证成指/创业板指）秒级数据

- 上证指数：沪市主板 600/601 开头股票加权合成
- 深证成指：深市主板 000/002 开头股票加权合成
- 创业板指：创业板 300 开头股票加权合成

权重：以各成分股当日总成交额（amount）为权重，模拟市值加权。

用法: python scripts/synthesize_indices.py
输出: data/intraday/ 下的三个指数 intraday CSV（与股票秒级数据同目录）
"""
import csv
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
STOCKS_DIR = os.path.join(DATA_DIR, "stocks")
INDICES_DIR = os.path.join(DATA_DIR, "indices")
INTRADAY_DIR = os.path.join(DATA_DIR, "intraday")
OUTPUT_DIR = INTRADAY_DIR

TRADE_DATE = "2026-01-02"

INDEX_DEFS = [
    {"code": "000001", "name": "上证指数", "prefixes": ("600", "601"), "desc": "沪市主板"},
    {"code": "399001", "name": "深证成指", "prefixes": ("000", "002"), "desc": "深市主板"},
    {"code": "399006", "name": "创业板指", "prefixes": ("300",), "desc": "创业板"},
]


def read_daily_row(filepath: str, target_date: str) -> dict | None:
    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["date"] == target_date:
                return row
    return None


def find_prev_close(filepath: str, target_date: str) -> float | None:
    """在日线CSV中找到目标日期前一交易日的收盘价"""
    with open(filepath, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for i, row in enumerate(rows):
        if row["date"] == target_date and i > 0:
            return float(rows[i - 1]["close"])
    return None


def read_intraday_rows(filepath: str) -> list[dict]:
    with open(filepath, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    stock_files = sorted(f for f in os.listdir(STOCKS_DIR) if f.endswith(".csv"))

    stocks = []
    for fname in stock_files:
        basename = fname.replace(".csv", "")
        parts = basename.split("_", 1)
        code = parts[0]
        name = parts[1] if len(parts) > 1 else code

        daily = read_daily_row(os.path.join(STOCKS_DIR, fname), TRADE_DATE)
        if daily is None:
            print(f"  跳过 {code} {name}: 日线无 {TRADE_DATE} 数据")
            continue

        intraday_path = os.path.join(INTRADAY_DIR, f"{code}_{name}_intraday.csv")
        if not os.path.exists(intraday_path):
            print(f"  跳过 {code} {name}: 无秒级数据文件")
            continue

        rows = read_intraday_rows(intraday_path)
        stocks.append({
            "code": code,
            "name": name,
            "open": float(daily["open"]),
            "day_amount": float(daily["amount"]),
            "rows": rows,
        })

    print(f"已加载 {len(stocks)} 支股票的秒级数据\n")

    for idx_def in INDEX_DEFS:
        code = idx_def["code"]
        name = idx_def["name"]
        prefixes = idx_def["prefixes"]

        constituents = [s for s in stocks if s["code"].startswith(prefixes)]
        if not constituents:
            print(f"  {code} {name}: 无成分股，跳过")
            continue

        index_daily_path = os.path.join(INDICES_DIR, f"{code}_{name}.csv")
        index_daily = read_daily_row(index_daily_path, TRADE_DATE)
        if index_daily is None:
            print(f"  {code} {name}: 日线无 {TRADE_DATE} 数据，跳过")
            continue

        index_open = float(index_daily["open"])
        index_prev_close = find_prev_close(index_daily_path, TRADE_DATE)
        if index_prev_close is None:
            index_prev_close = index_open

        total_weight = sum(s["day_amount"] for s in constituents)
        weights = {s["code"]: s["day_amount"] / total_weight for s in constituents}

        num_ticks = len(constituents[0]["rows"])

        output_path = os.path.join(OUTPUT_DIR, f"{code}_{name}_intraday.csv")
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "price", "change_amount", "change_pct", "volume", "amount"])
            for i in range(num_ticks):
                weighted_return = 0.0
                total_vol = 0
                total_amt = 0
                for s in constituents:
                    row = s["rows"][i]
                    p = float(row["price"])
                    ret = (p - s["open"]) / s["open"]
                    weighted_return += weights[s["code"]] * ret
                    total_vol += int(row["volume"])
                    total_amt += int(row["amount"])

                idx_price = round(index_open * (1.0 + weighted_return), 2)
                change_amount = round(idx_price - index_prev_close, 2)
                change_pct = round((idx_price - index_prev_close) / index_prev_close * 100, 2)

                writer.writerow([
                    constituents[0]["rows"][i]["timestamp"],
                    f"{idx_price:.2f}",
                    f"{change_amount:.2f}",
                    f"{change_pct:.2f}",
                    str(total_vol),
                    str(total_amt),
                ])

        sim_close = round(index_open * (1.0 + sum(
            weights[s["code"]] * (float(s["rows"][-1]["price"]) - s["open"]) / s["open"]
            for s in constituents
        )), 2)
        day_chg = round((sim_close - index_prev_close) / index_prev_close * 100, 2)
        print(f"  OK {code} {name:<6s} [{idx_def['desc']}]  "
              f"成分股={len(constituents)}  前收={index_prev_close:.2f}  "
              f"O={index_open:.2f}  C_sim={sim_close:.2f}  "
              f"日涨跌{day_chg:+.2f}%")

    print(f"\n{'='*60}")
    print(f"全部完成！输出目录: {OUTPUT_DIR}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
