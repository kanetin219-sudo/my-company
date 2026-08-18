#!/usr/bin/env python3
"""
動画文字起こしツール
MP4・MOVなどの動画ファイルをWhisperで文字起こしするGUIアプリ
"""

import tkinter as tk
from tkinter import ttk, filedialog
import threading
import os
import sys

# ドラッグ&ドロップ対応（オプション）
try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    HAS_DND = True
except ImportError:
    HAS_DND = False

ACCENT   = "#6c63ff"
RED      = "#e94560"
GREEN    = "#2ecc71"
TEAL     = "#4ecdc4"
BG       = "#f5f6fa"
CARD     = "#ffffff"
TEXT     = "#1a1a2e"
MUTED    = "#888"

def transcribe_file(filepath, on_status, on_done, on_error):
    """バックグラウンドで文字起こし実行"""
    try:
        import whisper

        on_status("Whisperモデルを読み込み中...")
        model = whisper.load_model("small")

        on_status("音声を解析中...")
        result = model.transcribe(filepath, language="ja", verbose=False)

        full_text = result["text"].strip()

        segments = ""
        for seg in result["segments"]:
            s = int(seg["start"])
            m, sec = divmod(s, 60)
            segments += f"[{m:02d}:{sec:02d}] {seg['text'].strip()}\n"

        on_done(full_text, segments)

    except Exception as e:
        on_error(str(e))


class App:
    def __init__(self):
        Root = TkinterDnD.Tk if HAS_DND else tk.Tk
        self.root = Root()
        self.root.title("🎙️ 動画文字起こしツール")
        self.root.geometry("680x620")
        self.root.resizable(True, True)
        self.root.configure(bg=BG)

        self.filepath = ""
        self.result_full = ""
        self.result_segments = ""

        self._build()

    # ─── UI構築 ───────────────────────────────────────────
    def _build(self):
        # ヘッダー
        hdr = tk.Frame(self.root, bg=ACCENT)
        hdr.pack(fill="x")
        tk.Label(hdr, text="🎙️  動画文字起こしツール",
                 font=("Hiragino Kaku Gothic ProN", 16, "bold"),
                 bg=ACCENT, fg="white", pady=14).pack()

        # ── ドロップゾーン ──
        dz_outer = tk.Frame(self.root, bg=BG)
        dz_outer.pack(fill="x", padx=28, pady=18)

        self.drop_frame = tk.Frame(
            dz_outer, bg="#eef0fb",
            highlightbackground=ACCENT, highlightthickness=2,
            cursor="hand2"
        )
        self.drop_frame.pack(fill="x")

        self.drop_lbl = tk.Label(
            self.drop_frame,
            text="📂  動画ファイルをドラッグ＆ドロップ",
            font=("Hiragino Kaku Gothic ProN", 13),
            bg="#eef0fb", fg=ACCENT, pady=22
        )
        self.drop_lbl.pack()

        # ドラッグ&ドロップ登録
        if HAS_DND:
            for w in (self.drop_frame, self.drop_lbl):
                w.drop_target_register(DND_FILES)
                w.dnd_bind("<<Drop>>", self._on_drop)

        # クリックでも選択できる
        self.drop_frame.bind("<Button-1>", lambda e: self._pick_file())
        self.drop_lbl.bind("<Button-1>", lambda e: self._pick_file())

        # ── ファイル名表示 ──
        self.fname_var = tk.StringVar(value="ファイルが選択されていません")
        tk.Label(self.root, textvariable=self.fname_var,
                 font=("Hiragino Kaku Gothic ProN", 10),
                 bg=BG, fg=MUTED, wraplength=600).pack(pady=(0, 6))

        # ── ボタン ──
        btn_row = tk.Frame(self.root, bg=BG)
        btn_row.pack(pady=4)

        self._btn(btn_row, "📂 ファイルを選択", ACCENT, self._pick_file).pack(side="left", padx=6)

        self.go_btn = self._btn(btn_row, "▶  文字起こし開始", RED, self._start, state="disabled")
        self.go_btn.pack(side="left", padx=6)

        # ── ステータス ──
        self.status_var = tk.StringVar(value="ファイルを選択してください")
        self.status_lbl = tk.Label(self.root, textvariable=self.status_var,
                                   font=("Hiragino Kaku Gothic ProN", 11),
                                   bg=BG, fg="#555")
        self.status_lbl.pack(pady=(8, 2))

        # プログレスバー
        self.progress = ttk.Progressbar(self.root, mode="indeterminate", length=360)
        self.progress.pack(pady=(2, 10))

        # ── テキスト出力エリア ──
        out_frame = tk.Frame(self.root, bg=BG)
        out_frame.pack(fill="both", expand=True, padx=28, pady=(0, 8))

        self.out_text = tk.Text(
            out_frame,
            font=("Hiragino Kaku Gothic ProN", 11),
            bg=CARD, fg=TEXT,
            relief="flat", wrap="word",
            state="disabled", padx=12, pady=10
        )
        sb = ttk.Scrollbar(out_frame, command=self.out_text.yview)
        self.out_text.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self.out_text.pack(fill="both", expand=True)

        # ── 保存・コピーボタン ──
        act_row = tk.Frame(self.root, bg=BG)
        act_row.pack(pady=(4, 18))

        self.copy_btn = self._btn(act_row, "📋 コピー", TEAL, self._copy, state="disabled")
        self.copy_btn.pack(side="left", padx=6)

        self.save_btn = self._btn(act_row, "💾 テキストを保存", GREEN, self._save, state="disabled")
        self.save_btn.pack(side="left", padx=6)

    def _btn(self, parent, label, color, cmd, state="normal"):
        return tk.Button(
            parent, text=label,
            font=("Hiragino Kaku Gothic ProN", 11, "bold"),
            bg=color, fg="white", activebackground=color,
            relief="flat", padx=18, pady=8,
            cursor="hand2", state=state,
            command=cmd
        )

    # ─── ファイル選択 ──────────────────────────────────────
    def _on_drop(self, event):
        path = event.data.strip("{}")
        self._set_file(path)

    def _pick_file(self):
        path = filedialog.askopenfilename(
            title="動画ファイルを選択",
            filetypes=[("動画ファイル", "*.mp4 *.mov *.avi *.mkv *.m4v *.webm"), ("すべて", "*.*")]
        )
        if path:
            self._set_file(path)

    def _set_file(self, path):
        self.filepath = path
        self.fname_var.set(f"📄  {os.path.basename(path)}")
        self.go_btn.config(state="normal")
        self.status_var.set("✅  ファイルが選択されました。「文字起こし開始」を押してください")

    # ─── 文字起こし実行 ────────────────────────────────────
    def _start(self):
        if not self.filepath:
            return
        self.go_btn.config(state="disabled")
        self.copy_btn.config(state="disabled")
        self.save_btn.config(state="disabled")
        self._clear_output()
        self.progress.start(10)

        threading.Thread(
            target=transcribe_file,
            args=(self.filepath, self._set_status, self._on_done, self._on_error),
            daemon=True
        ).start()

    def _set_status(self, msg):
        self.root.after(0, lambda: self.status_var.set(f"🎙️  {msg}"))

    def _on_done(self, full_text, segments):
        def _update():
            self.progress.stop()
            self.result_full = full_text
            self.result_segments = segments
            self.status_var.set("✅  文字起こし完了！")
            self._set_output(full_text)
            self.go_btn.config(state="normal")
            self.copy_btn.config(state="normal")
            self.save_btn.config(state="normal")
        self.root.after(0, _update)

    def _on_error(self, msg):
        def _update():
            self.progress.stop()
            self.status_var.set(f"❌  エラー: {msg}")
            self.go_btn.config(state="normal")
        self.root.after(0, _update)

    # ─── テキスト操作 ──────────────────────────────────────
    def _clear_output(self):
        self.out_text.config(state="normal")
        self.out_text.delete(1.0, "end")
        self.out_text.config(state="disabled")

    def _set_output(self, text):
        self.out_text.config(state="normal")
        self.out_text.delete(1.0, "end")
        self.out_text.insert("end", text)
        self.out_text.config(state="disabled")

    def _copy(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.result_full)
        self.status_var.set("📋  テキストをコピーしました！")

    def _save(self):
        base = os.path.splitext(os.path.basename(self.filepath))[0]
        path = filedialog.asksaveasfilename(
            title="保存先を選択",
            defaultextension=".txt",
            initialfile=f"文字起こし_{base}.txt",
            filetypes=[("テキストファイル", "*.txt")]
        )
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            f.write("=== 文字起こし（全文） ===\n\n")
            f.write(self.result_full)
            f.write("\n\n\n=== タイムスタンプ付き ===\n\n")
            f.write(self.result_segments)
        self.status_var.set(f"💾  保存しました: {os.path.basename(path)}")

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    App().run()
