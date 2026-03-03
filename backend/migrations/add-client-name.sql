-- Add first_name and last_name to client (run if your DB was created before this change)
ALTER TABLE client ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE client ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
