-- إنشاء bucket للصور
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs', 
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- المستخدم يرفع صوره فقط
DROP POLICY IF EXISTS "Users can upload own proofs" ON storage.objects;
CREATE POLICY "Users can upload own proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- المستخدم يرى صوره فقط
DROP POLICY IF EXISTS "Users can view own proofs" ON storage.objects;
CREATE POLICY "Users can view own proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins يرون جميع الصور
DROP POLICY IF EXISTS "Admins can view all proofs" ON storage.objects;
CREATE POLICY "Admins can view all proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs' AND
  public.get_auth_role() IN ('super_admin', 'sub_admin')
);
