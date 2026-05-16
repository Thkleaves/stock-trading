"""查询2026-01-05真实日线数据"""
import akshare as ak
import pandas as pd
from datetime import datetime

TARGET_DATE = "2026-01-05"

STOCK_CODES = [
    "600519", "000858", "300750", "002594", "601318", "600036", "000333", "000651",
    "600276", "000725", "002415", "300059", "601012", "600900", "002475", "601899",
    "000063", "600809", "300124", "002230"
]

INDEX_CODES = {
    "000001": "sh000001",
    "399001": "sz399001", 
    "399006": "sz399006"
}

STOCK_NAMES = {
    "600519": "贵州茅台", "000858": "五粮液", "300750": "宁德时代", "002594": "比亚迪",
    "601318": "中国平安", "600036": "招商银行", "000333": "美的集团", "000651": "格力电器",
    "600276": "恒瑞医药", "000725": "京东方A", "002415": "海康威视", "300059": "东方财富",
    "601012": "隆基绿能", "600900": "长江电力", "002475": "立讯精密", "601899": "紫金矿业",
    "000063": "中兴通讯", "600809": "山西汾酒", "300124": "汇川技术", "002230": "科大讯飞"
}

INDEX_NAMES = {
    "000001": "上证指数", "399001": "深证成指", "399006": "创业板指"
}

results = []

# 查询个股
for code in STOCK_CODES:
    try:
        # 获取个股历史日线数据
        df = ak.stock_zh_a_hist(symbol=code, period="daily", start_date="20260101", end_date="20260110", adjust="qfq")
        if not df.empty:
            row = df[df['日期'] == TARGET_DATE]
            if not row.empty:
                r = row.iloc[0]
                results.append({
                    "code": code,
                    "name": STOCK_NAMES[code],
                    "type": "stock",
                    "date": TARGET_DATE,
                    "open": r['开盘'],
                    "close": r['收盘'],
                    "high": r['最高'],
                    "low": r['最低'],
                    "volume": int(r['成交量']),
                    "amount": int(r['成交额']),
                })
                print(f"OK {code} {STOCK_NAMES[code]}: O={r['开盘']} C={r['收盘']} H={r['最高']} L={r['最低']} V={int(r['成交量'])}")
            else:
                print(f"SKIP {code}: 日期 {TARGET_DATE} 无数据")
        else:
            print(f"SKIP {code}: 无数据返回")
    except Exception as e:
        print(f"ERR {code}: {e}")

# 查询指数
for code, ak_code in INDEX_CODES.items():
    try:
        df = ak.stock_zh_index_daily(symbol=ak_code)
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        row = df[df['date'] == TARGET_DATE]
        if not row.empty:
            r = row.iloc[0]
            results.append({
                "code": code,
                "name": INDEX_NAMES[code],
                "type": "index",
                "date": TARGET_DATE,
                "open": float(r['open']),
                "close": float(r['close']),
                "high": float(r['high']),
                "low": float(r['low']),
                "volume": int(r['volume']),
                "amount": int(r['amount']),
            })
            print(f"OK {code} {INDEX_NAMES[code]}: O={r['open']} C={r['close']} H={r['high']} L={r['low']}")
        else:
            print(f"SKIP {code}: 日期 {TARGET_DATE} 无数据")
    except Exception as e:
        print(f"ERR {code}: {e}")

# 输出结果
print(f"\n总计: {len(results)}/{len(STOCK_CODES) + len(INDEX_CODES)}")
df_result = pd.DataFrame(results)
print(df_result.to_string())
df_result.to_csv("data/real_ohlc_2026-01-05.csv", index=False, encoding="utf-8")
print("\n已保存到 data/real_ohlc_2026-01-05.csv")
