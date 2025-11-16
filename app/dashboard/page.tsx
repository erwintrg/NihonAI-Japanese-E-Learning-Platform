import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
            Welcome back, {user.email}!
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Ready to continue your Japanese learning journey?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
              Vocabulary Quiz
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Test your knowledge with AI-generated quizzes
            </p>
            <Link
              href="/dashboard/quiz"
              className="inline-block px-4 py-2 bg-black dark:bg-zinc-50 text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Start Quiz
            </Link>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
              Progress
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Track your learning progress
            </p>
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-bold text-black dark:text-zinc-50">
                  {quizzesCompleted}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Quizzes completed
                </p>
              </div>
              {quizzesCompleted > 0 && (
                <>
                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="text-xl font-semibold text-black dark:text-zinc-50">
                      {averageScore}/5
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Average score
                    </p>
                  </div>
                  {latestQuiz && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Latest: {latestQuiz.quiz_score}/5
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
              AI Chat
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Practice Japanese with AI conversations
            </p>
            <Link
              href="/dashboard/chat"
              className="inline-block px-4 py-2 bg-black dark:bg-zinc-50 text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Start Chat
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-4 py-2 text-red-600 dark:text-red-400 hover:underline"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

