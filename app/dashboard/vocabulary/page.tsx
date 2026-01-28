import Link from 'next/link'

export default function VocabularyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-2">
            Vocabulary Library
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            This feature is coming soon! You'll be able to browse and search through vocabulary words, view definitions, examples, and track your learning progress.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
