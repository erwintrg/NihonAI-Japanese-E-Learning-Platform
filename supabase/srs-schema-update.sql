-- SRS System Schema Update
-- This migration adds all required SRS fields to the user_vocabulary table

-- Add SRS fields to user_vocabulary table
ALTER TABLE public.user_vocabulary
  ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'new', -- 'new', 'learning', 'review', 'mastered'
  ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS correct_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incorrect_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ease_multiplier DECIMAL(5,2) DEFAULT 3.00,
  ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS times_lapsed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_leech BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leech_tagged_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0, -- Current learning step (0 = new, 1-3 = learning steps)
  ADD COLUMN IF NOT EXISTS learning_steps_completed JSONB DEFAULT '[]'::jsonb; -- Array of completed step timestamps

-- Update existing records to have default values
UPDATE public.user_vocabulary
SET 
  stage = COALESCE(stage, 'new'),
  ease_multiplier = COALESCE(ease_multiplier, 3.00),
  correct_count = COALESCE(correct_count, 0),
  incorrect_count = COALESCE(incorrect_count, 0),
  interval_days = COALESCE(interval_days, 0),
  times_lapsed = COALESCE(times_lapsed, 0),
  is_leech = COALESCE(is_leech, FALSE),
  current_step = COALESCE(current_step, 0),
  learning_steps_completed = COALESCE(learning_steps_completed, '[]'::jsonb)
WHERE stage IS NULL OR ease_multiplier IS NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_stage ON public.user_vocabulary(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_next_review_date ON public.user_vocabulary(user_id, next_review_date) WHERE next_review_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_is_leech ON public.user_vocabulary(user_id, is_leech) WHERE is_leech = TRUE;

-- Add check constraint for stage values
ALTER TABLE public.user_vocabulary
  ADD CONSTRAINT check_stage_values CHECK (stage IN ('new', 'learning', 'review', 'mastered'));

