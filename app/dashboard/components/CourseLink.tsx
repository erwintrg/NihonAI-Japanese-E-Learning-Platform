'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function CourseLink({ returnBatch }: { returnBatch?: string }) {
  const [nextBatch, setNextBatch] = useState<number | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function getNextBatch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // If returnBatch is provided, use it
      if (returnBatch) {
        setNextBatch(parseInt(returnBatch, 10))
        return
      }

      // Otherwise, find the next incomplete batch
      const { data: batches } = await supabase
        .from('completed_batches')
        .select('batch_number')
        .eq('user_id', user.id)
        .eq('batch_type', 'hiragana')
        .order('batch_number', { ascending: true })

      if (batches && batches.length > 0) {
        // Find the first gap or next batch
        const completedNumbers = batches.map(b => b.batch_number).sort((a, b) => a - b)
        let next = 1
        for (const num of completedNumbers) {
          if (num === next) {
            next++
          } else {
            break
          }
        }
        setNextBatch(next)
      } else {
        setNextBatch(1) // Start with batch 1
      }
    }

    getNextBatch()
  }, [returnBatch, supabase])

  const href = nextBatch ? `/dashboard/course?batch=${nextBatch}` : '/dashboard/course'

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

