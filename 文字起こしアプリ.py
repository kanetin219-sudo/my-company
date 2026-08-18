import streamlit as st
import tempfile
import os
import subprocess
import shutil

st.set_page_config(
    page_title="✨ 動画文字起こしツール",
    page_icon="🎀",
    layout="centered"
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');
*, body, .main { font-family: 'Noto Sans JP', sans-serif !important; }
.stApp { background: linear-gradient(135deg, #fff0f6 0%, #f3e8ff 50%, #e8f4ff 100%); }
.block-container { max-width: 720px !important; padding-top: 2rem !important; }
.hero-card {
    background: linear-gradient(135deg, #ff6b9d, #c77dff, #a78bfa);
    border-radius: 24px; padding: 40px 30px 36px;
    text-align: center; margin-bottom: 28px;
    box-shadow: 0 8px 32px rgba(199,125,255,0.25);
}
.hero-title { font-size: 30px; font-weight: 900; color: white; margin: 0 0 8px; }
.hero-sub { font-size: 14px; color: rgba(255,255,255,0.88); margin: 0; line-height: 1.6; }
.badge-row { display: flex; justify-content: center; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.badge {
    background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.4);
    color: white; font-size: 12px; font-weight: 700;
    padding: 4px 14px; border-radius: 20px;
}
.result-box {
    background: white; border-radius: 18px; padding: 22px 24px;
    border: 1.5px solid #f0d9ff; font-size: 15px; line-height: 1.9;
    white-space: pre-wrap; color: #333;
    box-shadow: 0 4px 18px rgba(199,125,255,0.08);
}
.result-header {
    font-size: 18px; font-weight: 900;
    background: linear-gradient(135deg, #ff6b9d, #c77dff);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 14px;
}
.stTabs [data-baseweb="tab-list"] {
    background: rgba(255,255,255,0.6); border-radius: 16px;
    padding: 4px; gap: 4px; border: 1px solid rgba(199,125,255,0.2);
}
.stTabs [data-baseweb="tab"] {
    border-radius: 12px !important; font-weight: 700 !important;
    color: #9b59b6 !important; padding: 8px 20px !important;
}
.stTabs [aria-selected="true"] {
    background: linear-gradient(135deg, #ff6b9d, #c77dff) !important;
    color: white !important;
}
.stTextInput input {
    border-radius: 14px !important; border: 2px solid #e8d5f5 !important;
    padding: 12px 16px !important; font-size: 14px !important;
}
.stTextInput input:focus { border-color: #c77dff !important; }
[data-testid="stFileUploader"] {
    border: 2px dashed #e0a8f5 !important; border-radius: 18px !important;
}
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #ff6b9d, #c77dff) !important;
    color: white !important; border: none !important;
    border-radius: 16px !important; padding: 14px 28px !important;
    font-size: 16px !important; font-weight: 700 !important;
    box-shadow: 0 6px 20px rgba(199,125,255,0.35) !important;
}
.stButton > button[kind="primary"]:disabled {
    background: #e0d0ee !important; box-shadow: none !important;
}
.stDownloadButton > button {
    background: linear-gradient(135deg, #f093fb, #f5576c) !important;
    color: white !important; border: none !important;
    border-radius: 14px !important; font-weight: 700 !important;
}
hr { border-color: rgba(199,125,255,0.2) !important; margin: 22px 0 !important; }
.stCaption { color: #b39ddb !important; font-size: 12px !important; }
</style>
""", unsafe_allow_html=True)

# ─── ヘッダー ──────────────────────────────────────────────
st.markdown("""
<div class="hero-card">
  <div class="hero-title">🎀 動画文字起こしツール</div>
  <div class="hero-sub">URLを貼るか動画をアップするだけで<br>自動で文字起こしができます✨</div>
  <div class="badge-row">
    <span class="badge">📸 Instagram</span>
    <span class="badge">▶️ YouTube</span>
    <span class="badge">🎬 TikTok(MP4)</span>
    <span class="badge">📂 動画ファイル</span>
  </div>
</div>
""", unsafe_allow_html=True)

# ─── yt-dlpのパスを自動検出 ────────────────────────────────
def get_ytdlp():
    # システムPATH → pip install先の順で探す
    path = shutil.which("yt-dlp")
    if path:
        return path
    candidates = [
        os.path.expanduser("~/Library/Python/3.9/bin/yt-dlp"),
        os.path.expanduser("~/Library/Python/3.10/bin/yt-dlp"),
        os.path.expanduser("~/Library/Python/3.11/bin/yt-dlp"),
        "/usr/local/bin/yt-dlp",
        "/opt/homebrew/bin/yt-dlp",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return "yt-dlp"  # フォールバック（クラウド環境はPATHに入る）

YTDLP = get_ytdlp()

# ─── 入力タブ ──────────────────────────────────────────────
tab_url, tab_file = st.tabs(["🔗  URLを貼り付ける", "📂  動画ファイルをアップ"])

source_type = None
source_value = None

with tab_url:
    st.markdown('<p style="font-size:14px;color:#9b59b6;font-weight:700;margin-bottom:8px;">Instagram・YouTube などのURLをペースト 💜</p>', unsafe_allow_html=True)
    url_input = st.text_input("URL入力", placeholder="https://www.instagram.com/reel/xxxxx/", label_visibility="collapsed")
    st.caption("💡 TikTokはリンクNG（規制あり）。ssstik.io でMP4を保存してからアップしてね")
    if url_input:
        source_type = "url"
        source_value = url_input

with tab_file:
    st.markdown('<p style="font-size:14px;color:#9b59b6;font-weight:700;margin-bottom:8px;">MP4・MOVをドラッグ＆ドロップ 🎬</p>', unsafe_allow_html=True)
    uploaded = st.file_uploader("動画ファイル", type=["mp4","mov","avi","mkv","m4v","webm"], label_visibility="collapsed")
    if uploaded:
        source_type = "file"
        source_value = uploaded

# ─── 設定 ──────────────────────────────────────────────────
with st.expander("⚙️  精度・速度の設定"):
    model_choice = st.select_slider(
        "Whisperモデル",
        options=["tiny","base","small","medium"],
        value="small",
        help="右ほど精度◎・時間がかかります。smallがバランス最適！"
    )
    show_timestamps = st.checkbox("⏱️  タイムスタンプ付きで表示する", value=True)

st.markdown("<br>", unsafe_allow_html=True)

# ─── 実行ボタン ────────────────────────────────────────────
can_run = source_value is not None
run_btn = st.button("✨  文字起こしをはじめる", type="primary", disabled=not can_run, use_container_width=True)
if not can_run:
    st.markdown('<p style="text-align:center;color:#c9a8e0;font-size:13px;margin-top:8px;">👆 URLを貼るか動画をアップしてね！</p>', unsafe_allow_html=True)

# ─── 処理 ──────────────────────────────────────────────────
if run_btn and source_value:
    with st.status("🎀 文字起こし中... しばらく待ってね", expanded=True) as status:
        audio_path = None
        tmp_dir = tempfile.mkdtemp()

        if source_type == "url":
            st.write("📥 動画をダウンロード中...")
            audio_out = os.path.join(tmp_dir, "audio.%(ext)s")
            result = subprocess.run(
                [YTDLP, "-x", "--audio-format", "mp3", "--audio-quality", "0",
                 "-o", audio_out, "--no-playlist", source_value],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                st.error(f"ダウンロードに失敗しました 😢\n{result.stderr[-300:]}")
                st.stop()
            for f in os.listdir(tmp_dir):
                audio_path = os.path.join(tmp_dir, f)
                break

        elif source_type == "file":
            st.write("📂 ファイルを読み込み中...")
            suffix = os.path.splitext(uploaded.name)[-1]
            tmp_path = os.path.join(tmp_dir, f"video{suffix}")
            with open(tmp_path, "wb") as f:
                f.write(uploaded.read())
            audio_path = tmp_path

        if audio_path:
            st.write(f"🎙️ AI（Whisper / {model_choice}）が解析中...")
            import whisper
            model = whisper.load_model(model_choice)
            res = model.transcribe(audio_path, language="ja", verbose=False)
            full_text = res["text"].strip()
            segments_text = ""
            for seg in res["segments"]:
                s = int(seg["start"])
                m, sec = divmod(s, 60)
                segments_text += f"[{m:02d}:{sec:02d}] {seg['text'].strip()}\n"
            status.update(label="🎉 完了！", state="complete")

    st.markdown("---")
    st.markdown('<div class="result-header">📄 文字起こし結果</div>', unsafe_allow_html=True)

    if show_timestamps:
        r1, r2 = st.tabs(["📝 全文", "⏱️ タイムスタンプ付き"])
        with r1:
            st.markdown(f'<div class="result-box">{full_text}</div>', unsafe_allow_html=True)
        with r2:
            st.markdown(f'<div class="result-box">{segments_text}</div>', unsafe_allow_html=True)
    else:
        st.markdown(f'<div class="result-box">{full_text}</div>', unsafe_allow_html=True)

    st.markdown("---")
    st.markdown('<p style="font-size:14px;font-weight:700;color:#9b59b6;">💾 保存・コピー</p>', unsafe_allow_html=True)

    save_content = f"=== 全文 ===\n\n{full_text}"
    if show_timestamps:
        save_content += f"\n\n\n=== タイムスタンプ付き ===\n\n{segments_text}"

    col1, col2 = st.columns(2)
    with col1:
        st.download_button("💾  テキストをダウンロード", data=save_content.encode("utf-8"),
                          file_name="文字起こし.txt", mime="text/plain", use_container_width=True)
    with col2:
        st.text_area("コピー用", value=full_text, height=80, label_visibility="collapsed")
    st.caption("👆 右上のテキストエリアを全選択（⌘A）してコピーできるよ！")
