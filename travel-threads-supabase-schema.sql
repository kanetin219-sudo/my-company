-- Supabase Travel Threads Dashboard Schema
-- @trevel_miyazaki プロジェクト用
-- 実行手順: 1. Supabaseダッシュボード → SQL Editor で以下をコピペして実行

-- テーブル1: travel_hotels（ホテル情報マスタ）
CREATE TABLE travel_hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_name TEXT NOT NULL,
  region TEXT NOT NULL,
  catch_copy TEXT NOT NULL,
  merit_text TEXT NOT NULL,
  family_size INTEGER DEFAULT 4,
  original_price INTEGER NOT NULL,
  discount_price INTEGER NOT NULL,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- テーブル2: travel_coupons（クーポンリンク）
CREATE TABLE travel_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES travel_hotels(id) ON DELETE CASCADE,
  coupon_type TEXT CHECK (coupon_type IN ('limited', 'daily', 'regular')),
  full_url TEXT NOT NULL,
  short_url TEXT NOT NULL,
  display_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- テーブル3: travel_queue（投稿キュー）
CREATE TABLE travel_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES travel_hotels(id) ON DELETE CASCADE,
  thread_text_1 TEXT NOT NULL,
  thread_text_2 TEXT NOT NULL,
  image_url TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'posted', 'failed')) DEFAULT 'pending',
  posted_at TIMESTAMP WITH TIME ZONE,
  thread_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- テーブル4: travel_analytics（エンゲージメント分析）
CREATE TABLE travel_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_url TEXT NOT NULL UNIQUE,
  hotel_id UUID REFERENCES travel_hotels(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  reposts_count INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0,
  fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- インデックス（クエリ速度向上用）
CREATE INDEX idx_travel_queue_status ON travel_queue(status);
CREATE INDEX idx_travel_queue_scheduled_time ON travel_queue(scheduled_time);
CREATE INDEX idx_travel_queue_hotel_id ON travel_queue(hotel_id);
CREATE INDEX idx_travel_coupons_hotel_id ON travel_coupons(hotel_id);
CREATE INDEX idx_travel_analytics_hotel_id ON travel_analytics(hotel_id);

-- Row Level Security (RLS) 有効化
ALTER TABLE travel_hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_analytics ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー（初期設定: 認証ユーザーなら全操作可能）
-- ※本番環境では、より厳密なポリシーに変更してください

-- travel_hotels ポリシー
CREATE POLICY "Anyone can read travel_hotels" ON travel_hotels FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert travel_hotels" ON travel_hotels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update travel_hotels" ON travel_hotels FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete travel_hotels" ON travel_hotels FOR DELETE USING (auth.role() = 'authenticated');

-- travel_coupons ポリシー
CREATE POLICY "Anyone can read travel_coupons" ON travel_coupons FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert travel_coupons" ON travel_coupons FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update travel_coupons" ON travel_coupons FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete travel_coupons" ON travel_coupons FOR DELETE USING (auth.role() = 'authenticated');

-- travel_queue ポリシー
CREATE POLICY "Anyone can read travel_queue" ON travel_queue FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert travel_queue" ON travel_queue FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update travel_queue" ON travel_queue FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete travel_queue" ON travel_queue FOR DELETE USING (auth.role() = 'authenticated');

-- travel_analytics ポリシー
CREATE POLICY "Anyone can read travel_analytics" ON travel_analytics FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert travel_analytics" ON travel_analytics FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update travel_analytics" ON travel_analytics FOR UPDATE USING (auth.role() = 'authenticated');

-- Storage Bucket（スクリーンショット画像保存用）
-- ※Supabase ダッシュボード → Storage → New bucket で以下を作成してください
-- Bucket name: travel-screenshots
-- Public: true (公開設定)
-- File size limit: 10MB

-- Bucket RLS ポリシー（初期設定: 公開）
-- ※ダッシュボードから手動で設定するか、以下を実行
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('travel-screenshots', 'travel-screenshots', true);
