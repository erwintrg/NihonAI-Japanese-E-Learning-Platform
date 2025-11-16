-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (Supabase Auth automatically creates auth.users)
-- We'll create a profiles table to store additional user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Progress table to track quiz scores and learning progress
CREATE TABLE IF NOT EXISTS public.progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quiz_score INTEGER DEFAULT 0,
  quiz_type TEXT, -- e.g., 'vocab', 'grammar', 'listening'
  vocabulary_items JSONB, -- Store vocabulary items tested in this quiz
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- User vocabulary tracking (for SRS system)
CREATE TABLE IF NOT EXISTS public.user_vocabulary (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vocabulary_id TEXT NOT NULL, -- Reference to vocabulary item from our JSON data
  difficulty_rating TEXT, -- 'easy', 'medium', 'hard'
  times_reviewed INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  next_review_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, vocabulary_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for progress
CREATE POLICY "Users can view own progress"
  ON public.progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_vocabulary
CREATE POLICY "Users can view own vocabulary"
  ON public.user_vocabulary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary"
  ON public.user_vocabulary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocabulary"
  ON public.user_vocabulary FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON public.progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_created_at ON public.progress(created_at);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_user_id ON public.user_vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_next_review ON public.user_vocabulary(next_review_at);

