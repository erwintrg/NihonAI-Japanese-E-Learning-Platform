'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { getTotalBatches, type KanaType } from '@/lib/kana'

// Course type sequence for determining next session
const COURSE_TYPE_SEQUENCE: KanaType[] = [
  'hiragana',
  'hiragana_dakuten',
  'hiragana_handakuten',
  'hiragana_combo',
  // Future: 'vocabulary', 'grammar', 'phrases' will be added here
]

export default function CourseLink({ returnBatch, returnType }: { returnBatch?: string; returnType?: string }) {
  const [nextBatch, setNextBatch] = useState<number | null>(null)
  const [nextType, setNextType] = useState<KanaType>('hiragana')
  const supabase = createClient()

  useEffect(() => {
    async function getNextBatch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // If returnBatch and returnType are provided, use them
      if (returnBatch && returnType) {
        setNextBatch(parseInt(returnBatch, 10))
        setNextType(returnType as KanaType)
        return
      }

      // Otherwise, find the next incomplete batch across all course types
      // Check each course type in sequence
      for (const courseType of COURSE_TYPE_SEQUENCE) {
        const { data: batches } = await supabase
          .from('completed_batches')
          .select('batch_number')
          .eq('user_id', user.id)
          .eq('batch_type', courseType)
          .order('batch_number', { ascending: true })

        const totalBatches = getTotalBatches(courseType)
        const completedNumbers = batches?.map(b => b.batch_number).sort((a, b) => a - b) || []
        
        // Check if all batches of this type are completed
        if (completedNumbers.length >= totalBatches && totalBatches > 0) {
          // All batches completed, check next type
          continue
        }

        // Find the first incomplete batch in this type
        let next = 1
        for (const num of completedNumbers) {
          if (num === next) {
            next++
          } else {
            break
          }
        }

        // Found the next batch to work on
        setNextBatch(next)
        setNextType(courseType)
        return
      }

      // All course types completed, default to first batch of first type
      setNextBatch(1)
      setNextType('hiragana')
    }

    getNextBatch()
  }, [returnBatch, returnType, supabase])

  const href = nextBatch 
    ? `/dashboard/course?batch=${nextBatch}&type=${nextType}` 
    : '/dashboard/course?batch=1&type=hiragana'

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
    >
      Start Course Session
      <span>→</span>
    </Link>
  )
}

