-- Add SWIFT/BIC Code column to both payment settings tables
ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS bank_swift TEXT;

ALTER TABLE sub_admin_payment_settings
  ADD COLUMN IF NOT EXISTS bank_swift TEXT;
