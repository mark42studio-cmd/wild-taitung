-- ============================================================
-- 野台東 spots 資料表
-- 在 Supabase SQL Editor 執行此檔案建立資料表
-- ============================================================

CREATE TABLE IF NOT EXISTS public.spots (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  name          TEXT          NOT NULL,
  category      TEXT          NOT NULL,
  region        TEXT          NOT NULL DEFAULT '台東市區',
  description   TEXT,
  stay_duration INTEGER       DEFAULT 60,
  closed_days   INTEGER[]     DEFAULT '{}',
  vibe_tags     TEXT[]        DEFAULT '{}',
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  address       TEXT,
  image_url     TEXT,
  source_url    TEXT,
  affiliate_links JSONB,

  CONSTRAINT spots_name_key     UNIQUE (name),
  CONSTRAINT spots_category_chk CHECK (category IN ('景點','美食','秘境','住宿')),
  CONSTRAINT spots_region_chk   CHECK (region   IN ('台東市區','東海岸','縱谷線','南迴線','離島'))
);

ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;

-- 所有人可讀
CREATE POLICY "spots_read_all" ON public.spots
  FOR SELECT USING (true);

-- 僅 service_role 可寫（腳本使用 SUPABASE_SERVICE_KEY）
CREATE POLICY "spots_write_service" ON public.spots
  FOR ALL USING (auth.role() = 'service_role');

-- 查詢常用索引
CREATE INDEX IF NOT EXISTS spots_category_idx  ON public.spots (category);
CREATE INDEX IF NOT EXISTS spots_region_idx    ON public.spots (region);
CREATE INDEX IF NOT EXISTS spots_tags_idx      ON public.spots USING GIN (vibe_tags);
CREATE INDEX IF NOT EXISTS spots_latlon_idx    ON public.spots (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
