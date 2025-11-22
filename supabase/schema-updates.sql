-- Schema updates for onboarding and roadmap features
-- Run this after the base schema.sql

-- Extend profiles table with onboarding data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_level TEXT DEFAULT 'beginner',
ADD COLUMN IF NOT EXISTS learning_goal TEXT,
ADD COLUMN IF NOT EXISTS roadmap_position TEXT DEFAULT 'hiragana-basics',
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.current_level IS 'User''s current Japanese level: beginner, N5, N4, N3, N2, N1';
COMMENT ON COLUMN public.profiles.learning_goal IS 'User''s learning goal/objective';
COMMENT ON COLUMN public.profiles.roadmap_position IS 'Current position in learning roadmap (e.g., hiragana-basics, vocab-foundation)';
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Whether user has completed onboarding';

