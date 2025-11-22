# NihonAI Tutor

**AI-powered Japanese language learning app** - Learn Japanese with personalized AI lessons, adaptive quizzes, and progress tracking.

## 🎯 Product Vision

A web app where users get personalized Japanese lessons to help them master the language efficiently.

## ✨ Features

### MVP (Current)
- 🔐 Authentication (Email/Google OAuth via Supabase)
- 🤖 AI-powered quiz chat (5 questions per session)
- 📊 Basic progress tracking
- 📱 Mobile-friendly UI

### Planned
- Adaptive learning (track wrong answers, repeat difficult items)
- Vocab flashcards (Anki-style)
- Premium tier:
  - Custom anime dialogues
  - Voice feedback

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (Auth & Database)
- **AI**: OpenAI API
- **Hosting**: Vercel

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/pollarity/nihonAI.git
cd nihonAI/nihonai
```

2. Install dependencies:
```bash
npm install
```

3. Set up Supabase:
   - Create a project at [supabase.com](https://app.supabase.com)
   - Go to Project Settings → API
   - Copy your Project URL and anon/public key

4. Set up environment variables:
   Create a `.env.local` file in the root directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Set up database schema:
   - Go to Supabase Dashboard → SQL Editor
   - Run the SQL from `supabase/schema.sql`
   - Then run `supabase/schema-updates.sql` to add onboarding and roadmap fields

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
nihonai/
├── app/              # Next.js app directory
│   ├── (auth)/      # Authentication routes
│   ├── (dashboard)/ # Dashboard routes
│   └── ...
├── lib/              # Utility functions
├── components/       # React components
└── public/           # Static assets
```

## 🗺️ Roadmap

- **Week 1**: MVP with auth and basic AI quiz
- **Week 2**: Polish UI, add adaptive logic
- **Week 3**: Launch preparation, premium tier setup

## 📝 License

Private project - All rights reserved

---

**Built with ❤️ for Japanese language learners**
