/**
 * Helper functions for SRS system integration
 */

import { createClient } from '@/lib/supabase/client'
import { type VocabularyItem } from '@/lib/data'
import { DEFAULT_SRS_SETTINGS } from './srs'

/**
 * Add vocabulary items to SRS as new cards
 * This should be called when a course session is completed
 */
export async function addVocabularyToSRS(
  userId: string,
  vocabularyItems: VocabularyItem[]
): Promise<void> {
  const supabase = createClient()

  // Filter out items that are already in SRS
  const { data: existingCards } = await supabase
    .from('user_vocabulary')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .in('vocabulary_id', vocabularyItems.map(v => v.id.toString()))

  const existingIds = new Set(existingCards?.map(c => c.vocabulary_id) || [])
  const newItems = vocabularyItems.filter(v => !existingIds.has(v.id.toString()))

  if (newItems.length === 0) {
    return // All items already in SRS
  }

  // Insert new cards
  const cardsToInsert = newItems.map(item => ({
    user_id: userId,
    vocabulary_id: item.id.toString(),
    stage: 'new',
    ease_multiplier: DEFAULT_SRS_SETTINGS.startingEase,
    correct_count: 0,
    incorrect_count: 0,
    interval_days: 0,
    times_lapsed: 0,
    is_leech: false,
    current_step: 0,
    learning_steps_completed: [],
  }))

  const { error } = await supabase
    .from('user_vocabulary')
    .insert(cardsToInsert)

  if (error) {
    console.error('Error adding vocabulary to SRS:', error)
    throw error
  }
}

/**
 * Check if user has completed enough SRS reviews to unlock next session
 * Returns true if user has completed 1-2 repetitions with 80%+ correctness
 */
export async function canUnlockNextSession(
  userId: string,
  vocabularyIds: string[]
): Promise<boolean> {
  const supabase = createClient()

  // Get SRS cards for the vocabulary items
  const { data: cards } = await supabase
    .from('user_vocabulary')
    .select('correct_count, incorrect_count, stage')
    .eq('user_id', userId)
    .in('vocabulary_id', vocabularyIds)

  if (!cards || cards.length === 0) {
    return false // No cards in SRS yet
  }

  // Check if cards have been reviewed at least 1-2 times
  const reviewedCards = cards.filter(
    card => card.correct_count + card.incorrect_count >= 1
  )

  if (reviewedCards.length < Math.min(2, cards.length)) {
    return false // Not enough reviews yet
  }

  // Calculate correctness rate
  const totalReviews = reviewedCards.reduce(
    (sum, card) => sum + card.correct_count + card.incorrect_count,
    0
  )
  const totalCorrect = reviewedCards.reduce(
    (sum, card) => sum + card.correct_count,
    0
  )

  const correctnessRate = totalReviews > 0 ? totalCorrect / totalReviews : 0

  return correctnessRate >= 0.8 // 80% or higher
}

