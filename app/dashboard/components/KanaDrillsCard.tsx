'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function KanaDrillsCard({ userId }: { userId: string }) {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function checkUnlock() {
      const { data: batches } = await supabase
        .from('completed_batches')
        .select('batch_number')
        .eq('user_id', userId)
        .eq('batch_type', 'hiragana')
        .eq('batch_number', 1)
      
      setIsUnlocked(batches && batches.length > 0)
      setLoading(false)
    }
    checkUnlock()
  }, [userId, supabase])

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
              Kana Drills
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Loading...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow opacity-60">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
              Kana Drills
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Complete your first Hiragana session to unlock
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-xl">🔤</span>
          </div>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg font-medium cursor-not-allowed"
        >
          Locked
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
            Kana Drills
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Practice kana characters until mastery
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="text-xl">🔤</span>
        </div>
      </div>
      <Link
        href="/dashboard/kana-drills"
        className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
      >
        Start Drill
        <span>→</span>
      </Link>
    </div>
  )
}

