-- Create ai_memory table
CREATE TABLE IF NOT EXISTS public.ai_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fact TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

-- Create policies so users can only see and manage their own memories
CREATE POLICY "Users can view own memories"
    ON public.ai_memory FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
    ON public.ai_memory FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
    ON public.ai_memory FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
    ON public.ai_memory FOR DELETE
    USING (auth.uid() = user_id);

-- Create an index to speed up lookups by user_id
CREATE INDEX idx_ai_memory_user_id ON public.ai_memory(user_id);
