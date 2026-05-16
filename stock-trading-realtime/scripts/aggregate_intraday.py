"""
将20支股票和3个指数的秒级日内CSV聚合成单一宽表CSV。

输入: stock-trading-backend/data/intraday/ 下的23个单独CSV文件
输出: stock-trading-realtime/data/intraday_aggregated.csv

宽表格式: 每行一个时间戳，列依次为 timestamp, {code1}, {code2}, ..., {code23}
缺失秒级数据点使用前向填充（forward-fill）。

用法: python scripts/aggregate_intraday.py
"""
import csv
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DATA = os.path.join(SCRIPT_DIR, "..", "..", "stock-trading-backend", "data", "intraday")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "intraday_aggregated.csv")

TRADE_DATE = "2025-12-31"

STOCK_CODES = [
    "600519", "000858", "300750", "002594", "601318", "600036",
    "000333", "000651", "600276", "000725", "002415", "300059",
    "601012", "600900", "002475", "601899", "000063", "600809",
    "300124", "002230",
]

INDEX_CODES = ["000001", "399001", "399006"]

ALL_CODES = STOCK_CODES + INDEX_CODES

CODE_NAMES = {
    "600519": "贵州茅台", "000858": "五粮液", "300750": "宁德时代",
    "002594": "比亚迪", "601318": "中国平安", "600036": "招商银行",
    "000333": "美的集团", "000651": "格力电器", "600276": "恒瑞医药",
    "000725": "京东方A", "002415": "海康威视", "300059": "东方财富",
    "601012": "隆基绿能", "600900": "长江电力", "002475": "立讯精密",
    "601899": "紫金矿业", "000063": "中兴通讯", "600809": "山西汾酒",
    "300124": "汇川技术", "002230": "科大讯飞",
    "000001": "上证指数", "399001": "深证成指", "399006": "创业板指",
}


def find_intraday_file(code: str) -> str | None:
    name = CODE_NAMES.get(code, code)
    candidates = [
        os.path.join(BACKEND_DATA, f"{code}_{name}_intraday.csv"),
        os.path.join(BACKEND_DATA, f"{code}_{name.replace(' ', '')}_intraday.csv"),
        os.path.join(BACKEND_DATA, f"{code}_intraday.csv"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c

    for fname in os.listdir(BACKEND_DATA):
        if fname.startswith(code) and fname.endswith(".csv"):
            return os.path.join(BACKEND_DATA, fname)
    return None


def read_prices(filepath: str) -> dict[str, float]:
    """读取CSV，返回 timestamp -> price 映射（只取时间部分 HH:MM:SS）"""
    prices: dict[str, float] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ts = row["timestamp"].strip()
            if " " in ts:
                ts = ts.split(" ")[1]
            price = float(row["price"])
            prices[ts] = price
    return prices


def forward_fill(prices: dict[str, float], all_timestamps: list[str]) -> list[float]:
    """按时间戳序列前向填充价格"""
    result: list[float] = []
    last_price = 0.0
    for ts in all_timestamps:
        if ts in prices:
            last_price = prices[ts]
        result.append(last_price)
    return result


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"读取 {BACKEND_DATA} 下的日内CSV文件...")
    code_prices: dict[str, dict[str, float]] = {}
    for code in ALL_CODES:
        filepath = find_intraday_file(code)
        if filepath is None:
            print(f"  X {code} {CODE_NAMES.get(code, '')}: 找不到文件，跳过")
            continue
        code_prices[code] = read_prices(filepath)
        print(f"  OK {code} {CODE_NAMES.get(code, '')}: {len(code_prices[code])} 条记录")

    all_timestamps: set[str] = set()
    for prices in code_prices.values():
        all_timestamps.update(prices.keys())
    sorted_ts = sorted(all_timestamps)

    print(f"\n总计 {len(sorted_ts)} 个唯一时间戳，"
          f"从 {sorted_ts[0]} 到 {sorted_ts[-1]}")

    filled: dict[str, list[float]] = {}
    for code in ALL_CODES:
        if code in code_prices:
            filled[code] = forward_fill(code_prices[code], sorted_ts)

    header = ["timestamp"] + ALL_CODES
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for i, ts in enumerate(sorted_ts):
            row = [f"{TRADE_DATE} {ts}"]
            for code in ALL_CODES:
                row.append(f"{filled[code][i]:.2f}")
            writer.writerow(row)

    print(f"\n聚合完成！输出: {OUTPUT_FILE}")
    print(f"共 {len(sorted_ts)} 行, {len(header)} 列")


if __name__ == "__main__":
    main()
