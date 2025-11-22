import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Roadmap from './components/Roadmap'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Fetch user progress
  const { data: progressData, error: progressError } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const quizzesCompleted = progressData?.length || 0
  const totalScore = progressData?.reduce((sum, quiz) => sum + (quiz.quiz_score || 0), 0) || 0
  const averageScore = quizzesCompleted > 0 ? Math.round((totalScore / quizzesCompleted) * 10) / 10 : 0
  const latestQuiz = progressData?.[0]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Image
            src="/images/nihonAI_Logo.png"
            alt="NihonAI Tutor Logo"
            width={60}
            height={60}
            className="w-16 h-16 object-contain"
            priority
          />
          <div>
            <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
              Welcome back!
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Ready to continue your Japanese learning journey?
            </p>
          </div>
        </div>

        {/* Learning Roadmap */}
        <div className="mb-8">
          <Roadmap />
        </div>

        {/* Main Action Cards - Inspired by WaniKani */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Learning Course Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
                  Learning Course
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Structured lessons: Theory → Examples → Practice
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <span className="text-xl">📚</span>
              </div>
            </div>
            <Link
              href="/dashboard/course"
              className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
            >
              Start Course Session
              <span>→</span>
            </Link>
          </div>

          {/* Vocabulary Quiz Card (Legacy - keeping for now) */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow opacity-75">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
                  Vocabulary Quiz
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Quick practice (legacy)
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-xl">⚡</span>
              </div>
            </div>
            <Link
              href="/dashboard/quiz"
              className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Start Quiz
              <span>→</span>
            </Link>
          </div>

          {/* Progress Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
                  Progress
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Track your learning
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-black dark:text-zinc-50 mb-1">
                  {quizzesCompleted}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Quizzes completed
                </p>
              </div>
              {quizzesCompleted > 0 && (
                <>
                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="text-2xl font-bold text-black dark:text-zinc-50">
                      {averageScore}/5
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Average score
                    </p>
                  </div>
                  {latestQuiz && (
                    <div className="pt-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Latest: {latestQuiz.quiz_score}/5
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* AI Chat Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
                  AI Chat
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Practice conversations
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span className="text-xl">💬</span>
              </div>
            </div>
            <Link
              href="/dashboard/chat"
              className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
            >
              Start Chat
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Sign Out */}
        <div className="mt-8 flex justify-end">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

