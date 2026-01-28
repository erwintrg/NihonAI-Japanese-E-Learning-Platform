'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTotalBatches, getBatchName, type KanaType } from '@/lib/kana'
import { getTotalVocabularySessions, getVocabularySessionByBatch } from '@/lib/vocabulary'

const COURSE_TYPE_SEQUENCE: KanaType[] = [
  'hiragana',
  'hiragana_dakuten',
  'hiragana_handakuten',
  'hiragana_combo',
  'hiragana_special',
  'katakana',
  'katakana_dakuten',
  'katakana_handakuten',
  'katakana_combo',
  'katakana_special',
]

type SessionType = KanaType | 'vocabulary_top100' | 'vocabulary'

export default function LearningCourseContent({ returnBatch, returnType }: { returnBatch?: string; returnType?: string }) {
  const [currentSession, setCurrentSession] = useState<{ type: SessionType; batch: number; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function getCurrentSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // If returnBatch and returnType are provided, use them
      if (returnBatch && returnType) {
        const batch = parseInt(returnBatch, 10)
        const type = returnType as SessionType
        
        // Handle vocabulary sessions
        if (type === 'vocabulary_top100' || type === 'vocabulary') {
          const vocabSession = getVocabularySessionByBatch(batch, type)
          const name = vocabSession?.topic ? `Top 100: ${vocabSession.topic}` : `Vocabulary: Session ${batch}`
          setCurrentSession({ type, batch, name })
        } else {
          // Handle Kana sessions
          const name = getBatchName(batch, type as KanaType)
          setCurrentSession({ type: type as KanaType, batch, name })
        }
        setLoading(false)
        return
      }

      // Otherwise, find the next incomplete batch
      // First check Kana types
      for (const courseType of COURSE_TYPE_SEQUENCE) {
        const { data: batches } = await supabase
          .from('completed_batches')
          .select('batch_number')
          .eq('user_id', user.id)
          .eq('batch_type', courseType)
          .order('batch_number', { ascending: true })

        const totalBatches = getTotalBatches(courseType)
        const completedNumbers = batches?.map(b => b.batch_number).sort((a, b) => a - b) || []
        
        if (completedNumbers.length >= totalBatches && totalBatches > 0) {
          continue
        }

        let next = 1
        for (const num of completedNumbers) {
          if (num === next) {
            next++
          } else {
            break
          }
        }

        const name = getBatchName(next, courseType)
        setCurrentSession({ type: courseType, batch: next, name })
        setLoading(false)
        return
      }

      // All Kana completed, check for vocabulary sessions
      const vocabularyTypes: ('vocabulary_top100' | 'vocabulary')[] = ['vocabulary_top100', 'vocabulary']
      
      for (const vocabType of vocabularyTypes) {
        const { data: batches } = await supabase
          .from('completed_batches')
          .select('batch_number')
          .eq('user_id', user.id)
          .eq('batch_type', vocabType)
          .order('batch_number', { ascending: true })

        const totalBatches = getTotalVocabularySessions(vocabType)
        const completedNumbers = batches?.map(b => b.batch_number).sort((a, b) => a - b) || []
        
        if (completedNumbers.length >= totalBatches && totalBatches > 0) {
          continue
        }

        let next = 1
        for (const num of completedNumbers) {
          if (num === next) {
            next++
          } else {
            break
          }
        }

        const vocabSession = getVocabularySessionByBatch(next, vocabType)
        const name = vocabSession?.topic ? `Top 100: ${vocabSession.topic}` : `Vocabulary: Session ${next}`
        setCurrentSession({ type: vocabType, batch: next, name })
        setLoading(false)
        return
      }

      // All completed (including vocabulary), default to first vocabulary session if available
      const firstVocabSession = getVocabularySessionByBatch(1, 'vocabulary_top100')
      if (firstVocabSession) {
        const name = firstVocabSession.topic ? `Top 100: ${firstVocabSession.topic}` : 'Vocabulary: Session 1'
        setCurrentSession({ type: 'vocabulary_top100', batch: 1, name })
      } else {
        // Fallback to first Hiragana batch
        setCurrentSession({ type: 'hiragana', batch: 1, name: getBatchName(1, 'hiragana') })
      }
      setLoading(false)
    }

    getCurrentSession()
  }, [returnBatch, returnType, supabase])

  if (loading) {
    return (
      <div className="mb-6 h-32 bg-gradient-to-r from-pink-400/20 to-rose-400/20 dark:from-pink-600/20 dark:to-rose-600/20 rounded-xl border border-pink-200/50 dark:border-pink-800/50 flex items-center justify-center">
        <span className="text-sm text-pink-600 dark:text-pink-400">Loading...</span>
      </div>
    )
  }

  if (!currentSession) {
    return null
  }

  const typeLabels: Record<SessionType, string> = {
    hiragana: 'Hiragana Basics',
    hiragana_dakuten: 'Hiragana Dakuten',
    hiragana_handakuten: 'Hiragana Handakuten',
    hiragana_combo: 'Hiragana Combinations',
    hiragana_special: 'Hiragana Special Cases',
    katakana: 'Katakana Basics',
    katakana_dakuten: 'Katakana Dakuten',
    katakana_handakuten: 'Katakana Handakuten',
    katakana_combo: 'Katakana Combinations',
    katakana_special: 'Katakana Special Cases',
    vocabulary_top100: 'Top 100 Vocabulary',
    vocabulary: 'Vocabulary',
  }

  return (
    <div className="mb-6 bg-white/60 dark:bg-zinc-900/60 rounded-xl border border-pink-200/50 dark:border-pink-800/50 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-pink-600 dark:text-pink-400 uppercase tracking-wide">
            Current Session
          </span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-pink-900 dark:text-pink-100">
            {typeLabels[currentSession.type]}
          </h3>
          <p className="text-sm text-pink-700 dark:text-pink-300">
            {currentSession.name}
          </p>
        </div>
      </div>
    </div>
  )
}

