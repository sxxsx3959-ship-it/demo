-- ====================================================================
-- تحديث شامل لنظام كوبونات الخصم (حد الاستخدام الكلي + استخدام واحد لكل شخص/جهاز)
-- شغّل هذا الكود في Supabase SQL Editor (لن يحذف أي بيانات حالية)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INT NOT NULL CHECK (discount_value > 0),
  min_order INT NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  max_uses INT NOT NULL DEFAULT 0 CHECK (max_uses >= 0),
  used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_uses INT NOT NULL DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS used_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL,
  device_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_device ON public.coupon_redemptions (coupon_id, device_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_phone ON public.coupon_redemptions (coupon_id, customer_phone);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount INT NOT NULL DEFAULT 0;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow owner manage categories" ON public.categories;
DROP POLICY IF EXISTS "Allow owner manage dishes" ON public.dishes;
DROP POLICY IF EXISTS "Allow owner manage delivery_areas" ON public.delivery_areas;
DROP POLICY IF EXISTS "Allow owner manage restaurant_settings" ON public.restaurant_settings;
DROP POLICY IF EXISTS "Allow owner manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow public read and insert coupon_redemptions" ON public.coupon_redemptions;

CREATE POLICY "Allow owner manage categories" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow owner manage dishes" ON public.dishes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow owner manage delivery_areas" ON public.delivery_areas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow owner manage restaurant_settings" ON public.restaurant_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow owner manage coupons" ON public.coupons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and insert coupon_redemptions" ON public.coupon_redemptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- دالة ذرية (Atomic) للتحقق من الكوبون وخصم استخدامه ومنع التكرار لنفس الشخص أو الجهاز
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code TEXT, p_device_id TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_clean_code TEXT := UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_code, '')), '\s+', '', 'g'));
  v_clean_device TEXT := TRIM(COALESCE(p_device_id, ''));
  v_clean_phone TEXT := TRIM(COALESCE(p_phone, ''));
  v_next_used INT;
  v_next_active BOOLEAN;
BEGIN
  IF v_clean_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'يرجى إدخال كود الخصم.');
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE UPPER(code) = v_clean_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'كود الخصم غير موجود.');
  END IF;

  IF NOT v_coupon.active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'هذا الكوبون متوقف أو منتهي الصلاحية.');
  END IF;

  IF v_coupon.max_uses > 0 AND v_coupon.used_count >= v_coupon.max_uses THEN
    UPDATE public.coupons SET active = FALSE WHERE id = v_coupon.id;
    RETURN jsonb_build_object('ok', false, 'error', 'عذرًا، تم استنفاد العدد المسموح لهذا الكوبون.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id
      AND (
        (v_clean_device <> '' AND device_id = v_clean_device)
        OR (v_clean_phone <> '' AND customer_phone = v_clean_phone)
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لقد استخدمت هذا الكوبون مسبقًا ولا يمكن استخدامه أكثر من مرة.');
  END IF;

  INSERT INTO public.coupon_redemptions (coupon_id, coupon_code, device_id, customer_phone)
  VALUES (v_coupon.id, v_coupon.code, v_clean_device, v_clean_phone);

  v_next_used := v_coupon.used_count + 1;
  v_next_active := CASE
    WHEN v_coupon.max_uses > 0 AND v_next_used >= v_coupon.max_uses THEN FALSE
    ELSE v_coupon.active
  END;

  UPDATE public.coupons
  SET used_count = v_next_used,
      active = v_next_active
  WHERE id = v_coupon.id;

  RETURN jsonb_build_object('ok', true, 'used_count', v_next_used, 'active', v_next_active);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_coupon(TEXT, TEXT, TEXT) TO anon, authenticated;

INSERT INTO public.restaurant_settings (key, value) VALUES
('coupons_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categories, public.dishes, public.delivery_areas, public.restaurant_settings, public.coupons;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
