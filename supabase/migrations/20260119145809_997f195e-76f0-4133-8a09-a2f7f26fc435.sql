
-- Drop the foreign key constraint to allow mock user_ids during development
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
