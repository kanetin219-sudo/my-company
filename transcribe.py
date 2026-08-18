#!/usr/bin/env python3
"""
動画・リール 文字起こしツール
対応プラットフォーム: Instagram / TikTok / YouTube / X(Twitter) / Facebook など
使い方:
  python3 transcribe.py https://www.instagram.com/reel/xxxxx/
  python3 transcribe.py https://www.tiktok.com/@xxx/video/xxxxx
  python3 transcribe.py https://www.youtube.com/watch?v=xxxxx
  python3 transcribe.py 動画ファイル.mp4
"""

import sys
import os
import subprocess
import tempfile
from pathlib import Path

def download_audio(url: str, tmpdir: str) -> str:
    """URLから音声をダウンロードする"""
    print(f"📥 動画を取得中: {url}")
    audio_path = os.path.join(tmpdir, "audio.mp3")
    ytdlp = "/Users/nakurashun/Library/Python/3.9/bin/yt-dlp"
    result = subprocess.run(
        [
            ytdlp,
            "-x", "--audio-format", "mp3",
            "--audio-quality", "0",
            "-o", audio_path,
            "--no-playlist",
            url
        ],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("❌ ダウンロードに失敗しました")
        print(result.stderr)
        sys.exit(1)
    # yt-dlpは拡張子を自動付与する場合があるので探す
    for f in Path(tmpdir).glob("audio*"):
        return str(f)
    return audio_path

def transcribe(audio_path: str, output_path: str):
    """Whisperで文字起こしする"""
    import whisper

    print("🎙️  文字起こし中（少し時間がかかるっちゃ）...")
    model = whisper.load_model("small")  # small=精度と速度のバランス◎
    result = model.transcribe(audio_path, language="ja", verbose=False)

    text = result["text"].strip()

    # タイムスタンプ付きテキストも生成
    segments_text = ""
    for seg in result["segments"]:
        start = int(seg["start"])
        m, s = divmod(start, 60)
        segments_text += f"[{m:02d}:{s:02d}] {seg['text'].strip()}\n"

    # 出力ファイルに保存
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("=== 文字起こし（全文） ===\n\n")
        f.write(text)
        f.write("\n\n\n=== タイムスタンプ付き ===\n\n")
        f.write(segments_text)

    print(f"\n✅ 完了！保存先: {output_path}")
    print("\n--- プレビュー（冒頭200文字） ---")
    print(text[:200] + ("..." if len(text) > 200 else ""))
    print("---------------------------------")

def main():
    if len(sys.argv) < 2:
        print("使い方: python3 transcribe.py <URLまたは動画ファイルパス>")
        sys.exit(1)

    source = sys.argv[1]
    is_url = source.startswith("http://") or source.startswith("https://")

    # 出力ファイル名を決定
    if is_url:
        # URLの末尾からファイル名を作る
        slug = source.rstrip("/").split("/")[-1][:30] or "transcription"
        output_path = f"文字起こし_{slug}.txt"
    else:
        base = Path(source).stem
        output_path = f"文字起こし_{base}.txt"

    with tempfile.TemporaryDirectory() as tmpdir:
        if is_url:
            audio_path = download_audio(source, tmpdir)
        else:
            if not os.path.exists(source):
                print(f"❌ ファイルが見つかりません: {source}")
                sys.exit(1)
            audio_path = source
            print(f"📂 ファイルを読み込み中: {source}")

        transcribe(audio_path, output_path)

if __name__ == "__main__":
    main()
