-- Migration: Market Access Control columns
-- Safe, non-destructive ALTER TABLE statements

-- Add allowed_markets column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS allowed_markets TEXT[] DEFAULT ARRAY['crypto','forex','commodities'];

-- Add subscription_price column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_price NUMERIC DEFAULT 300;

-- Backfill existing sub_admins with default markets
UPDATE profiles
  SET allowed_markets = ARRAY['crypto','forex','commodities']
  WHERE role = 'sub_admin' AND allowed_markets IS NULL;
