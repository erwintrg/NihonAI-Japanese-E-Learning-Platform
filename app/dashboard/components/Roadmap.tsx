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
  type?: 'hiragana' | 'hiragana_dakuten' | 'hiragana_handakuten' | 'hiragana_combo' | 'katakana' | 'katakana_dakuten' | 'katakana_handakuten' | 'katakana_combo'
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
      // This will automatically include future course types (vocabulary, grammar, phrases, etc.)
      const { data, error } = await supabase
        .from('completed_batches')
        .select('batch_type, batch_number')
        .eq('user_id', user.id)
        // Note: For future course types, they will be automatically included in the query
        // We only filter by user_id, so all batch_types are returned

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
        }
        
        // Dynamically organize batches by type
        // This handles both current kana types and future course types (vocabulary, grammar, phrases, etc.)
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
      // Future course types will be added here
      // case 'vocabulary':
      //   return getTotalVocabularyBatches()
      // case 'grammar':
      //   return getTotalGrammarBatches()
      // case 'phrases':
      //   return getTotalPhrasesBatches()
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

  // Define roadmap segments
  const hiraganaTotal = getTotalHiraganaBatches()
  const dakutenTotal = getTotalHiraganaDakutenBatches()
  const handakutenTotal = getTotalHiraganaHandakutenBatches()
  const combosTotal = getTotalHiraganaComboBatches()
  const katakanaTotal = getTotalKatakanaBatches()
  const katakanaDakutenTotal = getTotalKatakanaDakutenBatches()
  const katakanaHandakutenTotal = getTotalKatakanaHandakutenBatches()
  const katakanaCombosTotal = getTotalKatakanaComboBatches()
  
  const hiraganaCompleted = completedBatches.hiragana.size
  const dakutenCompleted = completedBatches.hiragana_dakuten.size
  const handakutenCompleted = completedBatches.hiragana_handakuten.size
  const combosCompleted = completedBatches.hiragana_combo.size
  const katakanaCompleted = completedBatches.katakana.size
  const katakanaDakutenCompleted = completedBatches.katakana_dakuten.size
  const katakanaHandakutenCompleted = completedBatches.katakana_handakuten.size
  const katakanaCombosCompleted = completedBatches.katakana_combo.size

  const roadmapSegments: RoadmapSegment[] = [
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
  ]

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

      <div className="space-y-4">
        {roadmapSegments.map((segment) => {
          const isCurrent = segment.status === 'current'
          const isCompleted = segment.status === 'completed'
          const isLocked = segment.status === 'locked'

          return (
            <div
              key={segment.id}
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
                {isCompleted && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded-full">
                    Completed
                  </span>
                )}
                {isLocked && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-zinc-400 dark:bg-zinc-600 text-white rounded-full">
                    Locked
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                {segment.description}
              </p>
              {segment.batchCount !== undefined && segment.completedBatches !== undefined && (
                <div className="mt-2 mb-2">
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                    <div
                      className="bg-pink-500 h-2 rounded-full transition-all"
                      style={{ width: `${(segment.completedBatches / segment.batchCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {isLocked && segment.unlocksAt && (
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  Unlocks: {segment.unlocksAt}
                </p>
              )}
            </div>
          )
        })}
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
