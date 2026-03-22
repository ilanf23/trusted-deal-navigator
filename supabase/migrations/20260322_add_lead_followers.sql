-- Lead followers: tracks which team members are following/subscribed to a lead
CREATE TABLE IF NOT EXISTS lead_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, team_member_id)
);

ALTER TABLE lead_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read follows"
  ON lead_followers FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert follows"
  ON lead_followers FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can delete follows"
  ON lead_followers FOR DELETE USING (true);
