import fs from 'fs';
import path from 'path';

let redirectsCache = null;

function loadRedirects() {
  if (redirectsCache) {
    return redirectsCache;
  }

  const redirectsPath = path.join(process.cwd(), 'redirects.json');
  if (!fs.existsSync(redirectsPath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(redirectsPath, 'utf-8');
    redirectsCache = JSON.parse(data);
    return redirectsCache;
  } catch (error) {
    console.error('Failed to load redirects.json:', error.message);
    return {};
  }
}

export default function handler(req, res) {
  const { hotelNo } = req.query;

  // バリデーション: hotelNo は数字のみ
  if (!hotelNo || !/^\d+$/.test(hotelNo)) {
    return res.status(400).json({
      error: 'Invalid hotelNo. Must be a number.',
    });
  }

  // 対応表を読み込む
  const redirects = loadRedirects();
  const targetUrl = redirects[hotelNo];

  if (!targetUrl) {
    return res.status(404).json({
      error: 'Hotel not found.',
      message: '指定されたホテルIDが見つかりません。楽天トラベルからお探しください。',
      rakutenUrl: 'https://travel.rakuten.co.jp/',
    });
  }

  // キャッシュを設定
  res.setHeader('Cache-Control', 'public, max-age=3600');

  // 301 リダイレクト
  res.redirect(301, targetUrl);
}
