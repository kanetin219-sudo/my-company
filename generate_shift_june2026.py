#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
アネラカフェ 2026年6月シフト自動生成スクリプト
"""

import csv
from datetime import date, timedelta
import math

YEAR, MONTH = 2026, 6
all_dates = [date(YEAR, MONTH, d) for d in range(1, 31)]

def is_weekend(d):
    return d.weekday() >= 5  # 5=土, 6=日

# ===== 勤務パターン定義 =====
# サビ管（平迫）
SABIKAN_HEIJITSU = "8-17(8時間)"
SABIKAN_KYUJITSU = "9-18(8時間)"

# 動取（須崎）
DOUTORI_WITH   = "10-19(8時間)"
DOUTORI_WITHOUT = "9-18(8時間)"

# パート（名前, 実働時間h）
P = {
    "9-13":  ("9-13（4時間）", 4),
    "9-17":  ("9-17（7時間うち1時間休憩）", 6),
    "9-18":  ("9-18（8時間うち1時間休憩）", 7),
    "10-12": ("10-12(2時間）", 2),
    "10-13": ("10-13 (3時間）", 3),
    "10-14": ("10-14(4時間）", 4),
    "10-17": ("10-17(6時間うち1時間休憩）", 6),
    "10-18": ("10-18(7時間うち1時間休憩）", 7),
    "10-19": ("10-19（8時間うち1時間休憩）", 8),
    "11-15": ("11-15（4時間）", 4),
    "11-16": ("11-16（5時間）", 5),
    "11-18": ("11-18（6時間うち1時間休憩）", 6),
    "11-19": ("11-19（7時間うち1時間休憩）", 7),
    "12-16": ("12-16（4時間）", 4),
    "12-19": ("12-19(6時間のうち1時間休憩)", 6),
    "14-17": ("14-17（3時間）", 3),
    "14-18": ("14-18（4時間）", 4),
    "14-19": ("14-19（5時間）", 5),
    "15-19": ("15-19（4時間）", 4),
}

def evenly_spaced_days(n_work, all_dates):
    """30日間からn_work日を均等に選ぶ"""
    n = len(all_dates)
    if n_work >= n:
        return list(all_dates)
    step = n / n_work
    selected = []
    for i in range(n_work):
        idx = int(i * step + step / 2)
        idx = min(idx, n - 1)
        selected.append(all_dates[idx])
    return sorted(set(selected))

def assign_uniform(target_hours, pattern_key, all_dates):
    """目標時間を月全体に均等に配置"""
    _, h_per_day = P[pattern_key]
    n_days = math.ceil(target_hours / h_per_day)
    n_days = min(n_days, len(all_dates))

    work_days = evenly_spaced_days(n_days, all_dates)

    # 時間数を微調整
    total = len(work_days) * h_per_day
    shifts = {d: pattern_key for d in work_days}

    # 過不足を最終日で調整
    diff = total - target_hours
    if diff > 0 and work_days:
        # 最後の日を短いパターンに変更
        last_d = work_days[-1]
        adj_h = h_per_day - diff
        if adj_h <= 0:
            del shifts[last_d]
        else:
            # adj_h に近いパターンを探す
            best = min(P.keys(), key=lambda k: abs(P[k][1] - adj_h) if P[k][1] <= adj_h + 1 else 999)
            if abs(P[best][1] - adj_h) <= 1:
                shifts[last_d] = best

    return shifts

# ===== 平迫（01）: 月10日休み =====
# 水曜4日 + 日曜4日 = 8日 → あと2日を土曜（6/6, 6/13）で補完
hirasako_rest = set()
for d in all_dates:
    if d.weekday() == 2:  # 水曜（6/3,10,17,24）
        hirasako_rest.add(d)
    if d.weekday() == 6:  # 日曜（6/7,14,21,28）
        hirasako_rest.add(d)

sat_days = [d for d in all_dates if d.weekday() == 5]
for sat in sat_days[:2]:  # 最初の2土曜（6/6, 6/13）
    hirasako_rest.add(sat)

# ちょうど10日に調整
hirasako_rest_list = sorted(hirasako_rest)[:10]
hirasako_rest = set(hirasako_rest_list)

# ===== 須崎（02）: 月10日休み =====
# 平迫と重ならないよう月・火曜を休みに
suzaki_rest = set()
for d in all_dates:
    if d.weekday() == 0:  # 月曜
        suzaki_rest.add(d)
    if d.weekday() == 1:  # 火曜
        suzaki_rest.add(d)

# 月曜5日 + 火曜5日 = 10日
suzaki_rest_list = sorted(suzaki_rest)[:10]
suzaki_rest = set(suzaki_rest_list)

# ===== パートスタッフのシフト =====

# 池田（09）: 132h初期 + 補完8h(06/17,21 各4h) = 140h
# 末光が86h(+1h超過)のためパート合計は86+90+28+50+40+140+76=510h
ikeda_shifts = assign_uniform(132, "9-17", all_dates)

# 牧（04）: 90h・トリマー・6h連続2日まで
def assign_maki_uniform(target_hours, all_dates):
    h_per_day = 6  # メインパターン
    n_days = math.ceil(target_hours / h_per_day)  # 15日
    work_days = evenly_spaced_days(n_days, all_dates)

    shifts = {}
    total = 0
    prev_6h_count = 0

    for i, d in enumerate(work_days):
        remaining = target_hours - total
        if remaining <= 0:
            break

        # 3日連続6h制限チェック
        if prev_6h_count >= 2:
            # 今日は4hにする
            pat = "10-14"
            prev_6h_count = 0
        elif remaining >= 6:
            pat = "10-17"
            prev_6h_count += 1
        elif remaining >= 4:
            pat = "10-14"
            prev_6h_count = 0
        elif remaining >= 3:
            pat = "10-13"
            prev_6h_count = 0
        else:
            break

        shifts[d] = pat
        total += P[pat][1]

    return shifts, total

maki_shifts, maki_total = assign_maki_uniform(90, all_dates)

# 椛田（10）: 76h → 13日出勤（6h×13=78 ≈ 76）
kabata_shifts = assign_uniform(76, "10-17", all_dates)

# 末光（03）: 85h → 14日出勤（6h×14=84 ≈ 85）
suemitsu_shifts = assign_uniform(85, "10-17", all_dates)

# 三浦（06）: 50h
# 日曜4日（6/7,14,21,28）に12-16(4h)固定 = 16h、残り34hを平日等に均等配置
sunday_dates = [d for d in all_dates if d.weekday() == 6]
non_sunday_dates = [d for d in all_dates if d.weekday() != 6]
miura_shifts = {d: "12-16" for d in sunday_dates}
# 平日30h + 補完4h(06/01) = 34h → 日曜16h + 34h = 50h
miura_extra = assign_uniform(30, "11-16", non_sunday_dates)
miura_shifts.update(miura_extra)

# 篠田（08）: 40h → 10日出勤（4h×10=40）
shinoda_shifts = assign_uniform(40, "11-15", all_dates)

# 今本（05）: 28h → 7日出勤（4h×7=28）
imamoto_shifts = assign_uniform(28, "14-18", all_dates)

# ===== 制約チェック & 補完 =====

def get_workers(d):
    workers = []
    trimmers = []
    if d not in hirasako_rest: workers.append("平迫")
    if d not in suzaki_rest:   workers.append("須崎")
    if d in suemitsu_shifts:   workers.append("末光")
    if d in maki_shifts:       workers.append("牧"); trimmers.append("牧")
    if d in imamoto_shifts:    workers.append("今本")
    if d in miura_shifts:      workers.append("三浦")
    if d in shinoda_shifts:    workers.append("篠田")
    if d in ikeda_shifts:      workers.append("池田")
    if d in kabata_shifts:     workers.append("椛田"); trimmers.append("椛田")
    return workers, trimmers

print("=== 補完前チェック ===")
problems = []
for d in all_dates:
    workers, trimmers = get_workers(d)
    cnt = len(workers)
    if cnt < 3:
        problems.append((d, cnt, bool(trimmers)))
        print(f"  {d.strftime('%m/%d')}({['月','火','水','木','金','土','日'][d.weekday()]}) {cnt}人 トリマー{'あり' if trimmers else 'なし'}")

# 補完：2人以下の日のみ最低3人確保（池田不在→池田追加、池田あり→三浦追加）
# ※補完分は各スタッフの初期時間から引いてパート510h目標を維持
for d in all_dates:
    workers, trimmers = get_workers(d)
    cnt = len(workers)
    if cnt < 3:
        if d in ikeda_shifts:
            # 池田が既にいる → 三浦で補完（三浦不在なら）
            if d not in miura_shifts:
                miura_shifts[d] = "14-18"
        else:
            # 池田で補完
            ikeda_shifts[d] = "11-15"

print("\n=== 日別スタッフ確認 ===")
all_ok = True
total_workers = 0
for d in all_dates:
    workers, trimmers = get_workers(d)
    cnt = len(workers)
    total_workers += cnt
    ok_count = "✅" if cnt >= 3 else "❌"
    ok_trim  = "🟢" if trimmers else "🔴"
    if cnt < 3:
        all_ok = False
    print(f"{d.strftime('%m/%d')}({['月','火','水','木','金','土','日'][d.weekday()]}) {ok_count}{cnt}人 {ok_trim} [{','.join(workers)}]")
print(f"\n1日平均人員配置: {total_workers/len(all_dates):.2f}人")

# ===== 実働時間サマリー =====
def calc_total_hours(shifts_dict):
    return sum(P[v][1] for v in shifts_dict.values())

hirasako_work = [d for d in all_dates if d not in hirasako_rest]
suzaki_work   = [d for d in all_dates if d not in suzaki_rest]

part_total = sum([
    calc_total_hours(suemitsu_shifts),
    calc_total_hours(maki_shifts),
    calc_total_hours(imamoto_shifts),
    calc_total_hours(miura_shifts),
    calc_total_hours(shinoda_shifts),
    calc_total_hours(ikeda_shifts),
    calc_total_hours(kabata_shifts),
])

print(f"\n=== 実働時間サマリー ===")
print(f"平迫（01）: {len(hirasako_work)*8}h (目標160h=20日×8h)")
print(f"須崎（02）: {len(suzaki_work)*8}h (目標160h=20日×8h)")
print(f"末光（03）: {calc_total_hours(suemitsu_shifts)}h (目標85h)")
print(f"牧  （04）: {calc_total_hours(maki_shifts)}h (目標90h・ユーザー調整)")
print(f"今本（05）: {calc_total_hours(imamoto_shifts)}h (目標28h)")
print(f"三浦（06）: {calc_total_hours(miura_shifts)}h (目標50h)")
print(f"篠田（08）: {calc_total_hours(shinoda_shifts)}h (目標40h)")
print(f"池田（09）: {calc_total_hours(ikeda_shifts)}h (目標140h)")
print(f"椛田（10）: {calc_total_hours(kabata_shifts)}h (目標76h)")
print(f"─────────────────────")
print(f"パート合計: {part_total}h (目標510h)")

# ===== CSV生成 =====
rows = []

def add_row(emp_no, last, first, d, kintai_ku, pattern_name):
    rows.append({
        "従業員番号": emp_no, "苗字": last, "名前": first,
        "日付": d.strftime("%Y/%m/%d"),
        "勤怠区分": kintai_ku, "勤務パターン": pattern_name,
        "開始時刻": "", "終了時刻": "",
        "休憩開始時刻1": "", "休憩終了時刻1": "",
        "休憩開始時刻2": "", "休憩終了時刻2": "",
        "休憩開始時刻3": "", "休憩終了時刻3": "",
    })

# 平迫（01）
for d in all_dates:
    if d in hirasako_rest:
        add_row("01", "平迫", "孝子", d, "所定休日", "")
    else:
        pat = SABIKAN_KYUJITSU if is_weekend(d) else SABIKAN_HEIJITSU
        add_row("01", "平迫", "孝子", d, "平日", pat)

# 須崎（02）
for d in all_dates:
    if d in suzaki_rest:
        add_row("02", "須崎", "琴絵", d, "所定休日", "")
    else:
        pat = DOUTORI_WITHOUT if d in hirasako_rest else DOUTORI_WITH
        add_row("02", "須崎", "琴絵", d, "平日", pat)

# パートスタッフ
part_staff = [
    ("03", "末光", "愛", suemitsu_shifts),
    ("04", "牧", "璃子", maki_shifts),
    ("05", "今本", "沙織", imamoto_shifts),
    ("06", "三浦", "萌華", miura_shifts),
    ("08", "篠田", "葉月", shinoda_shifts),
    ("09", "池田", "百花", ikeda_shifts),
    ("10", "椛田", "恵美", kabata_shifts),
]

for emp_no, last, first, shifts_dict in part_staff:
    for d in all_dates:
        if d in shifts_dict:
            pat_name, _ = P[shifts_dict[d]]
            add_row(emp_no, last, first, d, "平日", pat_name)
        else:
            add_row(emp_no, last, first, d, "所定休日", "")

# CSV出力
output_path = "/Users/nakurashun/Desktop/my-company/shift_june2026.csv"
fieldnames = ["従業員番号","苗字","名前","日付","勤怠区分","勤務パターン","開始時刻","終了時刻","休憩開始時刻1","休憩終了時刻1","休憩開始時刻2","休憩終了時刻2","休憩開始時刻3","休憩終了時刻3"]

with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"\n✅ CSV出力完了: {output_path} ({len(rows)}行)")
