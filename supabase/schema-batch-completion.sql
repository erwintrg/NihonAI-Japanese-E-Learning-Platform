-- Migration: Add batch completion tracking for Hiragana/Katakana learning sessions

-- Table to track completed learning batches
CREATE TABLE IF NOT EXISTS public.completed_batches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_type TEXT NOT NULL, -- 'hiragana', 'katakana', 'hiragana_dakuten', etc.
  batch_number INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  score INTEGER, -- Percentage score for the batch
  UNIQUE(user_id, batch_type, batch_number)
);

-- Enable Row Level Security
ALTER TABLE public.completed_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for completed_batches
CREATE POLICY "Users can view own completed batches"
  ON public.completed_batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own completed batches"
  ON public.completed_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own completed batches"
  ON public.completed_batches FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for better query performance
CREATE INDEX IF NOT EXISTS idx_completed_batches_user_id ON public.completed_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_completed_batches_type_number ON public.completed_batches(batch_type, batch_number);

