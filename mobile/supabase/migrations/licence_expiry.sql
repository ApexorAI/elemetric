-- Add licence expiry date to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS licence_expiry_date date;
