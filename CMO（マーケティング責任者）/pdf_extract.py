import pdfplumber
import os
from pathlib import Path

PDF_ROOT = Path("/Users/nakurashun/Desktop/my-company/CMO（マーケティング責任者）/戦略/PDF")
OUTPUT_FILE = Path("/Users/nakurashun/Desktop/my-company/CMO（マーケティング責任者）/戦略/全ナレッジ_GPTs用.txt")

def extract_pdf(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            texts = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    texts.append(text)
            return "\n".join(texts)
    except Exception as e:
        return f"[読み込みエラー: {e}]"

def main():
    pdf_files = sorted(PDF_ROOT.rglob("*.pdf"))
    total = len(pdf_files)
    print(f"対象PDFファイル数: {total}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        out.write("# CMO全ナレッジ｜GPTs用テキスト\n\n")

        current_folder = None
        for i, pdf_path in enumerate(pdf_files, 1):
            folder = pdf_path.parent.name
            if folder != current_folder:
                current_folder = folder
                out.write(f"\n\n{'='*60}\n## {folder}\n{'='*60}\n\n")

            print(f"[{i}/{total}] {pdf_path.name}")
            out.write(f"\n### {pdf_path.name}\n\n")
            text = extract_pdf(pdf_path)
            if text.strip():
                out.write(text)
            else:
                out.write("[テキストなし（画像PDFの可能性）]")
            out.write("\n\n---\n")

    size_mb = OUTPUT_FILE.stat().st_size / 1024 / 1024
    print(f"\n完了！出力ファイル: {OUTPUT_FILE}")
    print(f"ファイルサイズ: {size_mb:.1f} MB")

if __name__ == "__main__":
    main()
