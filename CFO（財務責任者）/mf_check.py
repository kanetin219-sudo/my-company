"""
MF クラウド会計 仕訳チェックスクリプト
税理士指摘事項 ⑱㉑㉒㉓㉔ 対応用
"""
import json
import os
import sys
import requests
from collections import defaultdict

BASE_DIR = os.path.dirname(__file__)
TOKEN_FILE = os.path.join(BASE_DIR, 'mf_token.json')
API_BASE = 'https://api.biz.moneyforward.com'

# 第2期 対象期間（要確認）
FISCAL_START = '2025-04-01'
FISCAL_END   = '2026-03-31'

# ㉒ ツール判定キーワード（摘要欄に含まれていたらシステム利用料に変更対象）
TOOL_KEYWORDS = [
    'chatgpt', 'openai', 'claude', 'notion', 'slack', 'canva', 'figma',
    'zoom', 'adobe', 'dropbox', 'github', 'stripe', 'google', 'microsoft',
    'shopify', 'mailchimp', 'chatwork', 'line works', 'freee', 'kintone',
    'システム', 'ツール', 'サブスク', 'subscription', 'saas',
]


def load_token():
    if not os.path.exists(TOKEN_FILE):
        print('❌ mf_token.json が見つからないっちゃ！')
        print('  先に: python mf_auth.py を実行してくれっちゃ')
        sys.exit(1)
    with open(TOKEN_FILE) as f:
        data = json.load(f)
    return data['access_token']


def api_get(path, token, params=None):
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
    }
    r = requests.get(f'{API_BASE}{path}', headers=headers, params=params or {})
    if r.status_code == 401:
        print('❌ トークン期限切れっちゃ！再度 python mf_auth.py を実行してくれっちゃ')
        sys.exit(1)
    if not r.ok:
        print(f'❌ APIエラー {r.status_code}: {r.text[:300]}')
        r.raise_for_status()
    return r.json()


def get_company_id(token):
    data = api_get('/api/v3/companies', token)
    # レスポンス構造をダンプして確認
    companies = data.get('companies', [])
    if not companies:
        print('APIレスポンス（デバッグ）:')
        print(json.dumps(data, ensure_ascii=False, indent=2)[:1000])
        print('\n❌ 会社情報が取得できないっちゃ')
        sys.exit(1)
    c = companies[0]
    company_id = c.get('id') or c.get('company_id')
    print(f'✅ 会社: {c.get("name", "不明")}  (ID: {company_id})')
    return company_id


def get_all_journals(company_id, token):
    all_journals = []
    page = 1
    while True:
        data = api_get(
            f'/api/v3/companies/{company_id}/journals',
            token,
            params={
                'start_issue_date': FISCAL_START,
                'end_issue_date':   FISCAL_END,
                'page':             page,
                'per_page':         100,
            }
        )
        journals = data.get('journals', [])
        all_journals.extend(journals)
        meta = data.get('meta', {})
        if not meta.get('next_page') or not journals:
            break
        page += 1
        print(f'  取得中... {len(all_journals)}件', end='\r')
    return all_journals


def expand_entries(journals):
    """借方・貸方をフラットに展開"""
    rows = []
    for j in journals:
        date = j.get('issue_date') or j.get('date', '')
        journal_id = j.get('id', '')
        for side in ['debit_entries', 'credit_entries']:
            for e in j.get(side, []):
                rows.append({
                    'journal_id':  journal_id,
                    'date':        date,
                    'account':     e.get('account_item_name', ''),
                    'sub_account': e.get('sub_account_item_name') or '',
                    'amount':      e.get('amount', 0),
                    'description': (e.get('description') or e.get('memo') or '').strip(),
                    'side':        side,
                })
    return rows


def main():
    token = load_token()
    print(f'=== MF 仕訳チェック ({FISCAL_START} 〜 {FISCAL_END}) ===\n')

    company_id = get_company_id(token)

    print('\n仕訳を全件取得中っちゃ...')
    journals = get_all_journals(company_id, token)
    print(f'取得完了: {len(journals)}件\n')

    entries = expand_entries(journals)

    print('=' * 65)

    # ──────────────────────────────────────────────
    # ㉑ 通信費 補助科目なし
    # ──────────────────────────────────────────────
    print('\n## ㉑ 通信費 ── 補助科目なし')
    items_21 = [e for e in entries
                if e['account'] == '通信費' and not e['sub_account']]
    if items_21:
        for e in sorted(items_21, key=lambda x: x['date']):
            print(f"  {e['date']}  {e['amount']:>10,}円  摘要:{e['description'][:25] or '（なし）'}")
        print(f"  ⚠ {len(items_21)}件 要修正")
    else:
        print('  ✅ 問題なし')

    # ──────────────────────────────────────────────
    # ㉒ システム利用料 科目チェック（ツール系）
    # ──────────────────────────────────────────────
    print('\n## ㉒ システム利用料 ── 科目が違う可能性のある仕訳')
    items_22 = [e for e in entries
                if any(kw in e['description'].lower() for kw in TOOL_KEYWORDS)
                and e['account'] not in ('システム利用料',)
                and e['side'] == 'debit_entries']
    if items_22:
        for e in sorted(items_22, key=lambda x: x['date']):
            print(f"  {e['date']}  {e['account']:15}  {e['amount']:>10,}円  摘要:{e['description'][:25]}")
        print(f"  ⚠ {len(items_22)}件 要確認")
    else:
        print('  ✅ キーワードヒットなし（摘要が空白の場合は漏れあり）')

    # ──────────────────────────────────────────────
    # ㉓ 備品・消耗品費 摘要なし
    # ──────────────────────────────────────────────
    print('\n## ㉓ 備品・消耗品費 ── 摘要なし')
    items_23 = [e for e in entries
                if e['account'] == '備品・消耗品費'
                and not e['description']
                and e['side'] == 'debit_entries']
    if items_23:
        for e in sorted(items_23, key=lambda x: x['date']):
            print(f"  {e['date']}  {e['amount']:>10,}円")
        print(f"  ⚠ {len(items_23)}件 要修正")
    else:
        print('  ✅ 問題なし')

    # ──────────────────────────────────────────────
    # ㉔ 備品・消耗品費 100,000円以上
    # ──────────────────────────────────────────────
    print('\n## ㉔ 備品・消耗品費 ── 100,000円以上（請求書確認要）')
    items_24 = [e for e in entries
                if e['account'] == '備品・消耗品費'
                and e['amount'] >= 100_000
                and e['side'] == 'debit_entries']
    if items_24:
        for e in sorted(items_24, key=lambda x: -x['amount']):
            print(f"  {e['date']}  {e['amount']:>10,}円  摘要:{e['description'][:30] or '（なし）'}")
        print(f"  ⚠ {len(items_24)}件 → 請求書を税理士に共有")
    else:
        print('  該当なし ✅')

    # ──────────────────────────────────────────────
    # ⑱ 補助科目なし 全勘定科目サマリ
    # ──────────────────────────────────────────────
    print('\n## ⑱ 補助科目なし ── 全勘定科目サマリ (件数上位)')
    no_sub = [e for e in entries if not e['sub_account'] and e['side'] == 'debit_entries']
    by_acct = defaultdict(int)
    for e in no_sub:
        by_acct[e['account']] += 1
    for acct, cnt in sorted(by_acct.items(), key=lambda x: -x[1])[:20]:
        print(f"  {acct:<20} {cnt}件")
    print(f"  合計: {len(no_sub)}件")

    # ──────────────────────────────────────────────
    # 結果をJSONに保存
    # ──────────────────────────────────────────────
    result = {
        '㉑_通信費_補助科目なし':         items_21,
        '㉒_システム利用料_科目違い候補':  items_22,
        '㉓_備品消耗品費_摘要なし':        items_23,
        '㉔_備品消耗品費_100k以上':        items_24,
        '⑱_補助科目なし_全件':            no_sub,
    }
    out_path = os.path.join(BASE_DIR, 'mf_check_result.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f'\n✅ 詳細を保存っちゃ: {out_path}')
    print('=== チェック完了っちゃ！===')


if __name__ == '__main__':
    main()
