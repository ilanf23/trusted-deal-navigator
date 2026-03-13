-- AI Agent Changes: tracks every AI mutation with full reversibility
CREATE TABLE IF NOT EXISTS ai_agent_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  mode TEXT NOT NULL CHECK (mode IN ('assist', 'agent')),
  prompt_summary TEXT,
  total_changes INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'partially_undone', 'fully_undone')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_agent_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  team_member_id UUID REFERENCES team_members(id),
  mode TEXT NOT NULL CHECK (mode IN ('assist', 'agent')),
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  old_values JSONB,
  new_values JSONB NOT NULL,
  description TEXT NOT NULL,
  ai_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'undone', 'redone', 'failed')),
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES auth.users(id),
  batch_id UUID REFERENCES ai_agent_batches(id) ON DELETE SET NULL,
  batch_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT DEFAULT 'gpt-4o-mini'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_agent_changes_user ON ai_agent_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_changes_batch ON ai_agent_changes(batch_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_changes_created ON ai_agent_changes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_changes_status ON ai_agent_changes(status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_batches_user ON ai_agent_batches(user_id);

-- Add mode column to ai_conversations
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'chat';

-- Add message_type and metadata to ai_conversation_messages
ALTER TABLE ai_conversation_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE ai_conversation_messages ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Enable RLS
ALTER TABLE ai_agent_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can see their own changes, owners can see all
CREATE POLICY "Users can view own ai changes" ON ai_agent_changes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all ai changes" ON ai_agent_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role can manage ai changes" ON ai_agent_changes
  FOR ALL USING (true);

CREATE POLICY "Users can view own ai batches" ON ai_agent_batches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all ai batches" ON ai_agent_batches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role can manage ai batches" ON ai_agent_batches
  FOR ALL USING (true);
