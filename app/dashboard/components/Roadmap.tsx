'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type RoadmapSegment = {
  id: string
  title: string
  description: string
  status: 'completed' | 'current' | 'locked'
  unlocksAt?: string // What unlocks this segment
}

export default function Roadmap() {
  const supabase = createClient()
  const [userPosition, setUserPosition] = useState<string>('hiragana-basics')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserPosition()
  }, [])

  const fetchUserPosition = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('roadmap_position')
        .eq('id', user.id)
        .single()

      if (data?.roadmap_position) {
        setUserPosition(data.roadmap_position)
      }
    } catch (error) {
      console.error('Error fetching roadmap position:', error)
    } finally {
      setLoading(false)
    }
  }

  // Define roadmap segments in order
  const segmentOrder = ['hiragana-basics', 'vocab-foundation', 'basic-grammar', 'listening-practice']
  const currentIndex = segmentOrder.indexOf(userPosition)
  
  // Define roadmap segments
  const roadmapSegments: RoadmapSegment[] = [
    {
      id: 'hiragana-basics',
      title: 'Hiragana Basics',
      description: 'Learn the hiragana writing system',
      status: userPosition === 'hiragana-basics' ? 'current' : currentIndex > 0 ? 'completed' : 'locked',
    },
    {
      id: 'vocab-foundation',
      title: 'Vocabulary Foundation',
      description: 'Build your first 100 words',
      status: userPosition === 'vocab-foundation' ? 'current' : currentIndex > 1 ? 'completed' : currentIndex === 0 ? 'locked' : 'locked',
      unlocksAt: 'Complete Hiragana Basics with 80%+',
    },
    {
      id: 'basic-grammar',
      title: 'Basic Grammar',
      description: 'Essential sentence patterns',
      status: userPosition === 'basic-grammar' ? 'current' : currentIndex > 2 ? 'completed' : currentIndex < 2 ? 'locked' : 'locked',
      unlocksAt: 'Complete Vocabulary Foundation with 80%+',
    },
    {
      id: 'listening-practice',
      title: 'Listening Practice',
      description: 'Improve your comprehension',
      status: userPosition === 'listening-practice' ? 'current' : currentIndex > 3 ? 'completed' : 'locked',
      unlocksAt: 'Complete Basic Grammar with 80%+',
    },
  ]

  // Calculate progress line color - pink up to current/completed items
  const getProgressLineHeight = () => {
    const currentItemIndex = roadmapSegments.findIndex(s => s.status === 'current' || s.status === 'completed')
    if (currentItemIndex === -1) return 0
    // Calculate height: (currentItemIndex + 1) items * (icon height + spacing)
    // Each item: icon (3rem) + spacing (1rem) = 4rem per item
    return `${(currentItemIndex + 1) * 4}rem`
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
        <div className="text-center text-zinc-600 dark:text-zinc-400">Loading roadmap...</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
      <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
        Your Learning Roadmap
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Follow your personalized path to Japanese mastery
      </p>

      <div className="relative">
        {/* Single vertical line from first to last icon center */}
        <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
        
        {/* Colored progress line */}
        <div 
          className="absolute left-6 top-6 w-0.5 bg-pink-500"
          style={{ height: getProgressLineHeight() }}
        />

        <div className="space-y-4 relative">
          {roadmapSegments.map((segment, index) => {
            const isCurrent = segment.status === 'current'
            const isCompleted = segment.status === 'completed'
            const isLocked = segment.status === 'locked'

            return (
              <div key={segment.id} className="relative flex items-start">
                {/* Icon - positioned to align with vertical line */}
                <div className="flex-shrink-0 w-14 flex items-center justify-center relative z-10">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                      isCurrent
                        ? 'bg-pink-500 text-white'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {isCurrent ? (
                      <span className="text-xl">📍</span>
                    ) : isCompleted ? (
                      <span className="text-xl">✓</span>
                    ) : (
                      <span className="text-xl">🔒</span>
                    )}
                  </div>
                </div>

                {/* Content card */}
                <div className="flex-1 ml-4 relative z-10">
                  <div
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isCurrent
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                        : isCompleted
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
                        {segment.title}
                      </h3>
                      {isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-pink-500 text-white rounded-full">
                          You are here
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                      {segment.description}
                    </p>
                    {isLocked && segment.unlocksAt && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Unlocks: {segment.unlocksAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Next Goal Highlight */}
      {roadmapSegments.find((s) => s.status === 'current') && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
            Next Goal:
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {roadmapSegments.find((s) => s.status === 'current')?.description}
          </p>
        </div>
      )}
    </div>
  )
}
