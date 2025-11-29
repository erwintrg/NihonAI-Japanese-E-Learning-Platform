'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SRS_SETTINGS } from '@/lib/srs'

export default function SRSStats() {
  const [stats, setStats] = useState<{ newCards: number; reviews: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function getSRSStats() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      try {
        // Fetch all user vocabulary cards
        const { data: cards, error } = await supabase
          .from('user_vocabulary')
          .select('stage, next_review_date')
          .eq('user_id', user.id)

        if (error) {
          console.error('Error fetching SRS stats:', error)
          setStats({ newCards: 0, reviews: 0 })
          setLoading(false)
          return
        }

        const now = new Date()
        
        // Count new cards (not yet started)
        const newCards = cards?.filter(card => card.stage === 'new').length || 0
        
        // Count cards due for review (learning or review stage, and due)
        const reviews = cards?.filter(card => {
          if (card.stage === 'new' || card.stage === 'mastered') return false
          if (!card.next_review_date) return true
          return new Date(card.next_review_date) <= now
        }).length || 0

        setStats({
          newCards: Math.min(newCards, DEFAULT_SRS_SETTINGS.newCardsPerDay),
          reviews: Math.min(reviews, DEFAULT_SRS_SETTINGS.maxReviewsPerDay),
        })
      } catch (error) {
        console.error('Error calculating SRS stats:', error)
        setStats({ newCards: 0, reviews: 0 })
      } finally {
        setLoading(false)
      }
    }

    getSRSStats()
  }, [supabase])

  if (loading) {
    return (
      <div className="mb-6 h-32 bg-gradient-to-r from-orange-400/20 to-amber-400/20 dark:from-orange-600/20 dark:to-amber-600/20 rounded-xl border border-orange-200/50 dark:border-orange-800/50 flex items-center justify-center">
        <span className="text-sm text-orange-600 dark:text-orange-400">Loading...</span>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="mb-6 bg-white/60 dark:bg-zinc-900/60 rounded-xl border border-orange-200/50 dark:border-orange-800/50 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100 mb-1">
            {stats.newCards}
          </div>
          <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
            New Cards
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100 mb-1">
            {stats.reviews}
          </div>
          <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
            Reviews
          </p>
        </div>
      </div>
      {stats.newCards === 0 && stats.reviews === 0 && (
        <p className="text-xs text-orange-600 dark:text-orange-400 text-center mt-3 opacity-75">
          No cards available yet
        </p>
      )}
    </div>
  )
}

