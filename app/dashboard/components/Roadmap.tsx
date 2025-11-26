'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  getTotalHiraganaBatches,
  getTotalHiraganaDakutenBatches,
  getTotalHiraganaHandakutenBatches,
  getTotalHiraganaComboBatches,
  getTotalKatakanaBatches,
  getTotalKatakanaDakutenBatches,
  getTotalKatakanaHandakutenBatches,
  getTotalKatakanaComboBatches
} from '@/lib/kana'

type RoadmapSegment = {
  id: string
  title: string
  description: string
  status: 'completed' | 'current' | 'locked'
  unlocksAt?: string
  type?: 'hiragana' | 'hiragana_dakuten' | 'hiragana_handakuten' | 'hiragana_combo' | 'katakana' | 'katakana_dakuten' | 'katakana_handakuten' | 'katakana_combo' | 'vocabulary_top100' | 'grammar' | 'phrases' | 'vocabulary' | 'output'
  batchCount?: number
  completedBatches?: number
}

export default function Roadmap() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [completedBatches, setCompletedBatches] = useState<Record<string, Set<number>>>({
    hiragana: new Set(),
    hiragana_dakuten: new Set(),
    hiragana_handakuten: new Set(),
    hiragana_combo: new Set(),
    katakana: new Set(),
    katakana_dakuten: new Set(),
    katakana_handakuten: new Set(),
    katakana_combo: new Set(),
    vocabulary_top100: new Set(),
    // Future course types will be added dynamically
  })

  useEffect(() => {
    fetchCompletedBatches()
  }, [])

  const fetchCompletedBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch all completed batches for all course types
      const { data, error } = await supabase
        .from('completed_batches')
        .select('batch_type, batch_number')
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching completed batches:', error)
      } else if (data) {
        // Initialize with known types, but allow dynamic addition of future types
        const batches: Record<string, Set<number>> = {
          hiragana: new Set(),
          hiragana_dakuten: new Set(),
          hiragana_handakuten: new Set(),
          hiragana_combo: new Set(),
          katakana: new Set(),
          katakana_dakuten: new Set(),
          katakana_handakuten: new Set(),
          katakana_combo: new Set(),
          vocabulary_top100: new Set(),
        }
        
        // Dynamically organize batches by type
        data.forEach(batch => {
          const batchType = batch.batch_type as string
          if (!batches[batchType]) {
            batches[batchType] = new Set()
          }
          batches[batchType].add(batch.batch_number)
        })
        
        setCompletedBatches(batches)
      }
    } catch (error) {
      console.error('Error fetching completed batches:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to get total batches for any course type
  const getTotalBatchesForType = (type: string): number => {
    switch (type) {
      case 'hiragana':
        return getTotalHiraganaBatches()
      case 'hiragana_dakuten':
        return getTotalHiraganaDakutenBatches()
      case 'hiragana_handakuten':
        return getTotalHiraganaHandakutenBatches()
      case 'hiragana_combo':
        return getTotalHiraganaComboBatches()
      case 'katakana':
        return getTotalKatakanaBatches()
      case 'katakana_dakuten':
        return getTotalKatakanaDakutenBatches()
      case 'katakana_handakuten':
        return getTotalKatakanaHandakutenBatches()
      case 'katakana_combo':
        return getTotalKatakanaComboBatches()
      case 'vocabulary_top100':
        return 20 // 20 sessions for Top 100 Vocabulary (5 per session)
      // Future course types will be added here
      default:
        return 0
    }
  }

  // Determine status for each segment
  const getSegmentStatus = (type: string, totalBatches: number, requiresPrevious?: string): 'completed' | 'current' | 'locked' => {
    const completed = completedBatches[type as keyof typeof completedBatches] || new Set()
    const completedCount = completed.size
    
    // Check if previous requirement is met
    if (requiresPrevious) {
      const prevCompleted = completedBatches[requiresPrevious as keyof typeof completedBatches] || new Set()
      const prevTotal = getTotalBatchesForType(requiresPrevious)
      
      // Need to complete ALL batches of previous type to unlock the next type
      if (prevCompleted.size < prevTotal) {
        return 'locked'
      }
    }
    
    if (completedCount === 0) {
      // If no batches completed, check if it's unlocked (previous type completed)
      if (requiresPrevious) {
        const prevCompleted = completedBatches[requiresPrevious as keyof typeof completedBatches] || new Set()
        const prevTotal = getTotalBatchesForType(requiresPrevious)
        
        // If previous type is fully completed, this type is unlocked (current, not locked)
        if (prevCompleted.size >= prevTotal) {
          return 'current'
        }
      }
      return 'locked'
    } else if (completedCount >= totalBatches) {
      return 'completed'
    } else {
      return 'current'
    }
  }

  // Define all roadmap segments (beginner roadmap + post-top-100 pattern)
  const hiraganaTotal = getTotalHiraganaBatches()
  const dakutenTotal = getTotalHiraganaDakutenBatches()
  const handakutenTotal = getTotalHiraganaHandakutenBatches()
  const combosTotal = getTotalHiraganaComboBatches()
  const katakanaTotal = getTotalKatakanaBatches()
  const katakanaDakutenTotal = getTotalKatakanaDakutenBatches()
  const katakanaHandakutenTotal = getTotalKatakanaHandakutenBatches()
  const katakanaCombosTotal = getTotalKatakanaComboBatches()
  const vocabularyTop100Total = 20
  
  const hiraganaCompleted = completedBatches.hiragana.size
  const dakutenCompleted = completedBatches.hiragana_dakuten.size
  const handakutenCompleted = completedBatches.hiragana_handakuten.size
  const combosCompleted = completedBatches.hiragana_combo.size
  const katakanaCompleted = completedBatches.katakana.size
  const katakanaDakutenCompleted = completedBatches.katakana_dakuten.size
  const katakanaHandakutenCompleted = completedBatches.katakana_handakuten.size
  const katakanaCombosCompleted = completedBatches.katakana_combo.size
  const vocabularyTop100Completed = completedBatches.vocabulary_top100.size

  const allRoadmapSegments: RoadmapSegment[] = [
    // Beginner Roadmap (one-time only)
    {
      id: 'hiragana-basics',
      title: 'Hiragana Basics',
      description: `Learn the 46 basic Hiragana characters (${hiraganaCompleted}/${hiraganaTotal} batches completed)`,
      status: getSegmentStatus('hiragana', hiraganaTotal),
      type: 'hiragana',
      batchCount: hiraganaTotal,
      completedBatches: hiraganaCompleted,
    },
    {
      id: 'hiragana-dakuten',
      title: 'Hiragana Dakuten',
      description: `Learn voiced sounds with dakuten marks (゛) (${dakutenCompleted}/${dakutenTotal} batches completed)`,
      status: getSegmentStatus('hiragana_dakuten', dakutenTotal, 'hiragana'),
      type: 'hiragana_dakuten',
      batchCount: dakutenTotal,
      completedBatches: dakutenCompleted,
      unlocksAt: 'Complete all Hiragana Basics batches',
    },
    {
      id: 'hiragana-handakuten',
      title: 'Hiragana Handakuten',
      description: `Learn semi-voiced sounds with handakuten marks (゜) (${handakutenCompleted}/${handakutenTotal} batches completed)`,
      status: getSegmentStatus('hiragana_handakuten', handakutenTotal, 'hiragana_dakuten'),
      type: 'hiragana_handakuten',
      batchCount: handakutenTotal,
      completedBatches: handakutenCompleted,
      unlocksAt: 'Complete all Hiragana Dakuten batches',
    },
    {
      id: 'hiragana-combos',
      title: 'Hiragana Combinations',
      description: `Learn kana combinations (きゃ, きゅ, きょ, etc.) (${combosCompleted}/${combosTotal} batches completed)`,
      status: getSegmentStatus('hiragana_combo', combosTotal, 'hiragana_handakuten'),
      type: 'hiragana_combo',
      batchCount: combosTotal,
      completedBatches: combosCompleted,
      unlocksAt: 'Complete all Hiragana Handakuten batches',
    },
    {
      id: 'katakana-basics',
      title: 'Katakana Basics',
      description: `Learn the 46 basic Katakana characters (${katakanaCompleted}/${katakanaTotal} batches completed)`,
      status: getSegmentStatus('katakana', katakanaTotal, 'hiragana_combo'),
      type: 'katakana',
      batchCount: katakanaTotal,
      completedBatches: katakanaCompleted,
      unlocksAt: 'Complete all Hiragana Combinations batches',
    },
    {
      id: 'katakana-dakuten',
      title: 'Katakana Dakuten',
      description: `Learn voiced sounds with dakuten marks (゛) (${katakanaDakutenCompleted}/${katakanaDakutenTotal} batches completed)`,
      status: getSegmentStatus('katakana_dakuten', katakanaDakutenTotal, 'katakana'),
      type: 'katakana_dakuten',
      batchCount: katakanaDakutenTotal,
      completedBatches: katakanaDakutenCompleted,
      unlocksAt: 'Complete all Katakana Basics batches',
    },
    {
      id: 'katakana-handakuten',
      title: 'Katakana Handakuten',
      description: `Learn semi-voiced sounds with handakuten marks (゜) (${katakanaHandakutenCompleted}/${katakanaHandakutenTotal} batches completed)`,
      status: getSegmentStatus('katakana_handakuten', katakanaHandakutenTotal, 'katakana_dakuten'),
      type: 'katakana_handakuten',
      batchCount: katakanaHandakutenTotal,
      completedBatches: katakanaHandakutenCompleted,
      unlocksAt: 'Complete all Katakana Dakuten batches',
    },
    {
      id: 'katakana-combos',
      title: 'Katakana Combinations',
      description: `Learn kana combinations (キャ, キュ, キョ, etc.) (${katakanaCombosCompleted}/${katakanaCombosTotal} batches completed)`,
      status: getSegmentStatus('katakana_combo', katakanaCombosTotal, 'katakana_handakuten'),
      type: 'katakana_combo',
      batchCount: katakanaCombosTotal,
      completedBatches: katakanaCombosCompleted,
      unlocksAt: 'Complete all Katakana Handakuten batches',
    },
    {
      id: 'vocabulary-top100',
      title: 'Top 100 Vocabulary',
      description: `Learn the most essential 100 vocabulary words (${vocabularyTop100Completed}/${vocabularyTop100Total} sessions completed)`,
      status: getSegmentStatus('vocabulary_top100', vocabularyTop100Total, 'katakana_combo'),
      type: 'vocabulary_top100',
      batchCount: vocabularyTop100Total,
      completedBatches: vocabularyTop100Completed,
      unlocksAt: 'Complete all Katakana Combinations batches',
    },
    // Post-Top-100 Pattern (repeating cycle) - To be implemented in Phases 6, 7, and 8
    // Pattern: (a) Grammar → (b) Phrases → (c) Vocabulary → (d) Output
    // These segments will be dynamically generated based on user progress and JLPT level
    // For now, the roadmap will show Top 100 Vocabulary as the final segment until post-top-100 sessions are implemented
  ]

  // Determine which segments to display (3 items: previous, current, future OR 2 items for new users)
  const getDisplaySegments = (): RoadmapSegment[] => {
    // Find the current segment (first segment with status 'current')
    const currentIndex = allRoadmapSegments.findIndex(seg => seg.status === 'current')
    
    if (currentIndex === -1) {
      // No current segment - user hasn't started or has completed everything
      // Show first 2 segments (first one will be current, second will be locked)
      return allRoadmapSegments.slice(0, 2)
    }

    // Find the last completed segment before current
    let previousIndex = -1
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (allRoadmapSegments[i].status === 'completed') {
        previousIndex = i
        break
      }
    }

    // Determine segments to show
    if (previousIndex === -1) {
      // New user: show 2 items (current and next)
      return allRoadmapSegments.slice(currentIndex, currentIndex + 2).filter(seg => seg !== undefined)
    } else {
      // Show 3 items: previous completed, current, and next
      const segments: RoadmapSegment[] = []
      segments.push(allRoadmapSegments[previousIndex]) // Previous completed
      segments.push(allRoadmapSegments[currentIndex]) // Current
      
      // Find next segment (first locked or future segment after current)
      const nextIndex = currentIndex + 1
      if (nextIndex < allRoadmapSegments.length) {
        segments.push(allRoadmapSegments[nextIndex])
      }
      
      return segments
    }
  }

  const displaySegments = getDisplaySegments()

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-4 border border-zinc-200 dark:border-zinc-800">
        <div className="text-center text-zinc-600 dark:text-zinc-400 text-sm">Loading roadmap...</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-4 border border-zinc-200 dark:border-zinc-800">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50 mb-0.5">
          Your Learning Roadmap
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Follow your personalized path to Japanese mastery
        </p>
      </div>

      {/* Horizontal Timeline Layout - Single Line Design */}
      <div className="w-full">
        {/* Desktop: Full horizontal timeline */}
        <div className="hidden md:flex items-center justify-between gap-4">
          {displaySegments.map((segment, index) => {
            const isCurrent = segment.status === 'current'
            const isCompleted = segment.status === 'completed'
            const isLocked = segment.status === 'locked'
            const progressPercent = segment.batchCount && segment.completedBatches !== undefined 
              ? (segment.completedBatches / segment.batchCount) * 100 
              : 0
            const isLast = index === displaySegments.length - 1

            return (
              <div key={segment.id} className="flex-1 flex items-center gap-3">
                {/* Single line content */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-black dark:text-zinc-50 truncate">
                        {segment.title}
                      </h3>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-pink-500 text-white rounded-full flex-shrink-0">
                          Current
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-green-500 text-white rounded-full flex-shrink-0">
                          Done
                        </span>
                      )}
                      {isLocked && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-zinc-400 dark:bg-zinc-600 text-white rounded-full flex-shrink-0">
                          Locked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-1 rounded-full transition-all ${
                            isCompleted ? 'bg-green-500' : isCurrent ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-600'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      {segment.batchCount !== undefined && segment.completedBatches !== undefined && (
                        <span className={`text-xs font-medium flex-shrink-0 ${
                          isCompleted ? 'text-green-600 dark:text-green-400' : 
                          isCurrent ? 'text-pink-600 dark:text-pink-400' : 
                          'text-zinc-500 dark:text-zinc-400'
                        }`}>
                          {segment.completedBatches}/{segment.batchCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Flow direction arrow */}
                {!isLast && (
                  <div className="flex-shrink-0 px-2">
                    <svg 
                      className="w-4 h-4 text-zinc-400 dark:text-zinc-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Mobile: Scrollable horizontal timeline */}
        <div className="md:hidden overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex items-center gap-4 min-w-max">
            {displaySegments.map((segment, index) => {
              const isCurrent = segment.status === 'current'
              const isCompleted = segment.status === 'completed'
              const isLocked = segment.status === 'locked'
              const progressPercent = segment.batchCount && segment.completedBatches !== undefined 
                ? (segment.completedBatches / segment.batchCount) * 100 
                : 0
              const isLast = index === displaySegments.length - 1

              return (
                <div key={segment.id} className="w-56 flex-shrink-0 flex items-center gap-3">
                  {/* Single line content */}
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-black dark:text-zinc-50 truncate">
                          {segment.title}
                        </h3>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-pink-500 text-white rounded-full flex-shrink-0">
                            Current
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-green-500 text-white rounded-full flex-shrink-0">
                            Done
                          </span>
                        )}
                        {isLocked && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-zinc-400 dark:bg-zinc-600 text-white rounded-full flex-shrink-0">
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1 overflow-hidden">
                          <div
                            className={`h-1 rounded-full transition-all ${
                              isCompleted ? 'bg-green-500' : isCurrent ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-600'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        {segment.batchCount !== undefined && segment.completedBatches !== undefined && (
                          <span className={`text-xs font-medium flex-shrink-0 ${
                            isCompleted ? 'text-green-600 dark:text-green-400' : 
                            isCurrent ? 'text-pink-600 dark:text-pink-400' : 
                            'text-zinc-500 dark:text-zinc-400'
                          }`}>
                            {segment.completedBatches}/{segment.batchCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Flow direction arrow */}
                  {!isLast && (
                    <div className="flex-shrink-0 px-2">
                      <svg 
                        className="w-4 h-4 text-zinc-400 dark:text-zinc-600" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
