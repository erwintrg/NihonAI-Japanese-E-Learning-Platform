# Setup Guide

## Environment Variables

Create a `.env.local` file in the `nihonai/` directory with the following:

```env
# Supabase Configuration
# Get these from your Supabase project settings: https://app.supabase.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI API Key
# Get this from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key
```

## First Time Setup

1. Install dependencies (already done):
```bash
npm install
```

2. Create `.env.local` file with your API keys (see above)

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Dependencies Installed

- ✅ `@supabase/supabase-js` - Supabase client
- ✅ `@supabase/ssr` - Supabase SSR helpers for Next.js
- ✅ `@supabase/auth-ui-react` - Pre-built auth UI components
- ✅ `@supabase/auth-ui-shared` - Shared auth UI utilities
- ✅ `tailwindcss` - Already configured (v4)

