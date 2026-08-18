"""
マネーフォワード クラウド会計 OAuth認証スクリプト
アクセストークンを取得してmf_token.jsonに保存する
"""
import webbrowser
import urllib.parse
import json
import os
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
from dotenv import dotenv_values

# 認証情報の読み込み
env = dotenv_values(os.path.join(os.path.dirname(__file__), '.env'))
CLIENT_ID     = env.get('MF_CLIENT_ID')
CLIENT_SECRET = env.get('MF_CLIENT_SECRET')
REDIRECT_URI  = env.get('MF_REDIRECT_URI', 'http://localhost:8080/callback')

AUTH_URL  = 'https://api.biz.moneyforward.com/authorize'
TOKEN_URL = 'https://api.biz.moneyforward.com/token'
SCOPE     = 'mfc'

auth_code = None


class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if 'code' in params:
            auth_code = params['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write('<html><body><h2>✅ 認証成功！ターミナルに戻ってくれっちゃ</h2></body></html>'.encode('utf-8'))
        elif 'error' in params:
            error = params.get('error', ['unknown'])[0]
            self.send_response(400)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(f'<html><body><h2>❌ エラー: {error}</h2></body></html>'.encode('utf-8'))
        else:
            self.send_response(200)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # ログ抑制


def main():
    global auth_code

    # 認証URLの生成
    params = {
        'client_id':     CLIENT_ID,
        'redirect_uri':  REDIRECT_URI,
        'response_type': 'code',
        'scope':         SCOPE,
    }
    auth_url = AUTH_URL + '?' + urllib.parse.urlencode(params)

    print('=' * 60)
    print('マネーフォワード クラウド会計 認証')
    print('=' * 60)
    print(f'\nブラウザが開くっちゃ → MFにログインして許可してくれっちゃ\n')
    print(f'もし開かない場合は手動でこのURLにアクセスっちゃ:')
    print(f'{auth_url}\n')

    # ローカルサーバーを先に起動
    server = HTTPServer(('localhost', 8080), CallbackHandler)

    webbrowser.open(auth_url)

    # コールバック待受
    print('コールバック待機中... (ブラウザで認証してくれっちゃ)')
    server.handle_request()

    if not auth_code:
        print('❌ 認証コードが取得できなかったっちゃ')
        return

    # アクセストークンの取得
    print('\nアクセストークンを取得中っちゃ...')
    resp = requests.post(TOKEN_URL, data={
        'grant_type':    'authorization_code',
        'client_id':     CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'code':          auth_code,
        'redirect_uri':  REDIRECT_URI,
    })

    if resp.status_code == 200:
        token_data = resp.json()
        token_file = os.path.join(os.path.dirname(__file__), 'mf_token.json')
        with open(token_file, 'w') as f:
            json.dump(token_data, f, ensure_ascii=False, indent=2)
        print(f'✅ アクセストークン取得成功っちゃ！')
        print(f'保存先: {token_file}')
        print(f'有効期限: {token_data.get("expires_in", "不明")}秒')
    else:
        print(f'❌ エラー: {resp.status_code}')
        print(resp.text)
        print('\n→ スコープ "accounting" が登録されていない可能性があるっちゃ')
        print('  MFアプリポータルでスコープ設定を確認してくれっちゃ')


if __name__ == '__main__':
    main()
