import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Roadmap from './components/Roadmap'
import { Suspense } from 'react'
import CourseLink from './components/CourseLink'
import KanaDrillsCard from './components/KanaDrillsCard'
import LearningCourseContent from './components/LearningCourseContent'
import SRSStats from './components/SRSStats'

// Disable caching for this page to ensure fresh data
export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnBatch?: string; type?: string }>
}) {
  // Await searchParams in Next.js 16
  const params = await searchParams
  const returnBatch = params?.returnBatch
  const returnType = params?.type
  
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
            Welcome back!
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Ready to continue your Japanese learning journey?
          </p>
        </div>

        {/* Learning Roadmap - Full Width Horizontal Section */}
        <div className="mb-8">
          <Roadmap />
        </div>

        {/* Core Functionalities - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Learning Course Card */}
          <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 rounded-2xl shadow-xl p-8 border-2 border-pink-200 dark:border-pink-800/50 hover:shadow-2xl hover:border-pink-300 dark:hover:border-pink-700 transition-all relative overflow-hidden">
            {/* Banner Image Area - Placeholder for future banner */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
              <div className="w-full h-full bg-pink-500 rounded-bl-full"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-pink-900 dark:text-pink-100 mb-2">
                    Learning Course
                  </h2>
                  <p className="text-base text-pink-700 dark:text-pink-300">
                    Structured lessons: Theory → Examples → Practice
                  </p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-pink-500 dark:bg-pink-600 flex items-center justify-center shadow-lg ml-4">
                  <span className="text-2xl">📚</span>
                </div>
              </div>
              
              {/* Learning Course Content */}
              <Suspense fallback={
                <div className="mb-6 h-32 bg-gradient-to-r from-pink-400/20 to-rose-400/20 dark:from-pink-600/20 dark:to-rose-600/20 rounded-xl border border-pink-200/50 dark:border-pink-800/50 flex items-center justify-center">
                  <span className="text-sm text-pink-600 dark:text-pink-400">Loading...</span>
                </div>
              }>
                <LearningCourseContent returnBatch={returnBatch} returnType={returnType} />
              </Suspense>
              
              <Suspense fallback={
                <div className="inline-flex items-center gap-2 w-full justify-center px-6 py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-semibold text-base transition-colors shadow-lg">
                  Start Course Session
                  <span>→</span>
                </div>
              }>
                <CourseLink returnBatch={returnBatch} returnType={returnType} />
              </Suspense>
            </div>
          </div>

          {/* SRS System Card */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-2xl shadow-xl p-8 border-2 border-orange-200 dark:border-orange-800/50 hover:shadow-2xl hover:border-orange-300 dark:hover:border-orange-700 transition-all relative overflow-hidden opacity-60">
            {/* Banner Image Area - Placeholder for future banner */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
              <div className="w-full h-full bg-orange-500 rounded-bl-full"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-2">
                    Spaced Repetition
                  </h2>
                  <p className="text-base text-orange-700 dark:text-orange-300">
                    Review and reinforce vocabulary (Coming soon)
                  </p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-orange-500 dark:bg-orange-600 flex items-center justify-center shadow-lg ml-4">
                  <span className="text-2xl">🔄</span>
                </div>
              </div>
              
              {/* SRS Stats */}
              <Suspense fallback={
                <div className="mb-6 h-32 bg-gradient-to-r from-orange-400/20 to-amber-400/20 dark:from-orange-600/20 dark:to-amber-600/20 rounded-xl border border-orange-200/50 dark:border-orange-800/50 flex items-center justify-center">
                  <span className="text-sm text-orange-600 dark:text-orange-400">Loading...</span>
                </div>
              }>
                <SRSStats />
              </Suspense>
              
              <button
                disabled
                className="inline-flex items-center gap-2 w-full justify-center px-6 py-4 bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-xl font-semibold text-base cursor-not-allowed shadow-lg"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Functionalities - Three Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* AI Chat Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow opacity-60">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
                  AI Chat
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Practice conversations (Coming soon)
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span className="text-xl">💬</span>
              </div>
            </div>
            <button
              disabled
              className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg font-medium cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>

          {/* Grammar Library Card (Placeholder for future) */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow opacity-60">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
                  Grammar Library
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Reference grammar patterns (Coming soon)
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <span className="text-xl">📖</span>
              </div>
            </div>
            <button
              disabled
              className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg font-medium cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>

          {/* Kana Drills Card */}
          <KanaDrillsCard userId={user.id} />
        </div>

        {/* Analytics Section - Full Width Below */}
        <div className="mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
                  Analytics
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Track your learning progress
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div>
                    <div className="text-3xl font-bold text-black dark:text-zinc-50 mb-1">
                      {averageScore}/5
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Average score
                    </p>
                  </div>
                  {latestQuiz && (
                    <div>
                      <div className="text-3xl font-bold text-black dark:text-zinc-50 mb-1">
                        {latestQuiz.quiz_score}/5
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Latest score
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

