/**
 * Spaced Repetition System (SRS) Logic
 * Based on Anki's algorithm with customizations for NihonAI
 */

export type SRSStage = 'new' | 'learning' | 'review' | 'mastered'

export type SRSRating = 'again' | 'hard' | 'good' | 'easy'

export interface SRSCard {
  id: string
  user_id: string
  vocabulary_id: string
  stage: SRSStage
  next_review_date: Date | null
  correct_count: number
  incorrect_count: number
  ease_multiplier: number
  interval_days: number
  last_reviewed_at: Date | null
  times_lapsed: number
  is_leech: boolean
  leech_tagged_at: Date | null
  current_step: number
  learning_steps_completed: number[]
  created_at: Date
}

export interface SRSSettings {
  // Daily Limits
  newCardsPerDay: number // Default: 15
  maxReviewsPerDay: number // Default: 9999
  
  // New Cards
  learningSteps: number[] // In minutes: [1, 5, 60] = [1m, 5m, 1h]
  graduatingInterval: number // In days: 1
  easyInterval: number // In days: 4
  
  // Lapses
  relearningSteps: number[] // In minutes: [2, 60] = [2m, 1h]
  minimumInterval: number // In days: 1
  leechThreshold: number // Default: 12
  leechAction: 'tag' | 'suspend' // Default: 'tag'
  
  // Advanced
  maxInterval: number // In days: 36500 (100 years)
  startingEase: number // Default: 3.00
  easyBonus: number // Default: 1.30
  intervalModifier: number // Default: 1.15
  hardInterval: number // Default: 1.20
  newInterval: number // Default: 0.25
}

export const DEFAULT_SRS_SETTINGS: SRSSettings = {
  newCardsPerDay: 15,
  maxReviewsPerDay: 9999,
  learningSteps: [1, 5, 60], // 1m, 5m, 1h
  graduatingInterval: 1,
  easyInterval: 4,
  relearningSteps: [2, 60], // 2m, 1h
  minimumInterval: 1,
  leechThreshold: 12,
  leechAction: 'tag',
  maxInterval: 36500,
  startingEase: 3.00,
  easyBonus: 1.30,
  intervalModifier: 1.15,
  hardInterval: 1.20,
  newInterval: 0.25,
}

/**
 * Calculate the next review date based on the current state and rating
 */
export function calculateNextReview(
  card: SRSCard,
  rating: SRSRating,
  settings: SRSSettings = DEFAULT_SRS_SETTINGS
): {
  nextReviewDate: Date
  newInterval: number
  newStage: SRSStage
  newStep: number
  newEase: number
  isLeech: boolean
} {
  const now = new Date()
  let nextReviewDate: Date
  let newInterval: number
  let newStage: SRSStage = card.stage
  let newStep = card.current_step
  let newEase = card.ease_multiplier
  let isLeech = card.is_leech

  if (card.stage === 'new') {
    // New card - handle learning steps
    if (rating === 'again') {
      // Restart from first learning step
      newStep = 1
      nextReviewDate = new Date(now.getTime() + settings.learningSteps[0] * 60 * 1000)
      newInterval = 0
      newStage = 'learning'
    } else if (rating === 'good') {
      // Advance to next learning step
      if (newStep < settings.learningSteps.length) {
        newStep = newStep + 1
        nextReviewDate = new Date(now.getTime() + settings.learningSteps[newStep - 1] * 60 * 1000)
        newInterval = 0
        newStage = 'learning'
      } else {
        // Graduated - move to review stage
        newStep = 0
        newInterval = settings.graduatingInterval
        nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)
        newStage = 'review'
      }
    } else if (rating === 'easy') {
      // Skip learning steps - graduate immediately
      newStep = 0
      newInterval = settings.easyInterval
      nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)
      newStage = 'review'
    } else {
      // Hard - same as Again for new cards
      newStep = 1
      nextReviewDate = new Date(now.getTime() + settings.learningSteps[0] * 60 * 1000)
      newInterval = 0
      newStage = 'learning'
    }
  } else if (card.stage === 'learning') {
    // Card in learning phase
    if (rating === 'again') {
      // Restart from first learning step
      newStep = 1
      nextReviewDate = new Date(now.getTime() + settings.learningSteps[0] * 60 * 1000)
      newInterval = 0
    } else if (rating === 'good') {
      // Advance to next learning step
      if (newStep < settings.learningSteps.length) {
        newStep = newStep + 1
        const stepDelay = settings.learningSteps[newStep - 1] * 60 * 1000
        // Check if this crosses a day boundary
        const nextDate = new Date(now.getTime() + stepDelay)
        if (nextDate.getDate() !== now.getDate()) {
          // Crosses day boundary - becomes interday learning
          nextReviewDate = nextDate
        } else {
          nextReviewDate = nextDate
        }
        newInterval = 0
      } else {
        // Graduated - move to review stage
        newStep = 0
        newInterval = settings.graduatingInterval
        nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)
        newStage = 'review'
      }
    } else if (rating === 'easy') {
      // Skip to review stage
      newStep = 0
      newInterval = settings.easyInterval
      nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)
      newStage = 'review'
    } else {
      // Hard - stay in learning, repeat current step
      const stepDelay = settings.learningSteps[Math.max(0, newStep - 1)] * 60 * 1000
      nextReviewDate = new Date(now.getTime() + stepDelay)
      newInterval = 0
    }
  } else if (card.stage === 'review') {
    // Card in review phase
    const currentInterval = card.interval_days || settings.graduatingInterval
    
    if (rating === 'again') {
      // Lapse - enter relearning
      newStep = 1
      nextReviewDate = new Date(now.getTime() + settings.relearningSteps[0] * 60 * 1000)
      newInterval = Math.max(settings.minimumInterval, Math.floor(currentInterval * settings.newInterval))
      newStage = 'learning'
      newEase = Math.max(1.30, newEase - 0.20) // Decrease ease
      
      // Check for leech
      const newTimesLapsed = card.times_lapsed + 1
      if (newTimesLapsed >= settings.leechThreshold && !isLeech) {
        isLeech = true
      }
    } else if (rating === 'hard') {
      // Hard - smaller interval
      newInterval = Math.max(settings.minimumInterval, Math.floor(currentInterval * settings.hardInterval))
      nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)
      newEase = Math.max(1.30, newEase - 0.15) // Slight decrease
    } else if (rating === 'good') {
      // Good - normal interval
      newInterval = Math.min(
        settings.maxInterval,
        Math.floor(currentInterval * newEase * settings.intervalModifier)
      )
      nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)
      // Ease stays the same
    } else {
      // Easy - larger interval
      newInterval = Math.min(
        settings.maxInterval,
        Math.floor(currentInterval * newEase * settings.intervalModifier * settings.easyBonus)
      )
      nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)
      newEase = Math.min(2.50, newEase + 0.15) // Increase ease
    }
  } else {
    // Mastered - should not happen, but handle gracefully
    newInterval = card.interval_days
    nextReviewDate = card.next_review_date || now
  }

  return {
    nextReviewDate,
    newInterval,
    newStage,
    newStep,
    newEase,
    isLeech,
  }
}

/**
 * Get stage name for display
 */
export function getStageName(stage: SRSStage): string {
  const stageNames: Record<SRSStage, string> = {
    new: 'Seedling',
    learning: 'Sprout',
    review: 'Growing',
    mastered: 'Flourishing',
  }
  return stageNames[stage]
}

/**
 * Check if a card is due for review
 */
export function isCardDue(card: SRSCard): boolean {
  if (card.stage === 'mastered') return false
  if (!card.next_review_date) return true
  return new Date(card.next_review_date) <= new Date()
}

/**
 * Get cards due for review
 */
export function getDueCards(cards: SRSCard[]): SRSCard[] {
  return cards.filter(isCardDue)
}

/**
 * Get new cards (not yet started)
 */
export function getNewCards(cards: SRSCard[]): SRSCard[] {
  return cards.filter(card => card.stage === 'new')
}

/**
 * Get learning cards (in learning phase)
 */
export function getLearningCards(cards: SRSCard[]): SRSCard[] {
  return cards.filter(card => card.stage === 'learning')
}

/**
 * Get review cards (in review phase)
 */
export function getReviewCards(cards: SRSCard[]): SRSCard[] {
  return cards.filter(card => card.stage === 'review' && isCardDue(card))
}

/**
 * Get mastered cards
 */
export function getMasteredCards(cards: SRSCard[]): SRSCard[] {
  return cards.filter(card => card.stage === 'mastered')
}

/**
 * Get leech cards
 */
export function getLeechCards(cards: SRSCard[]): SRSCard[] {
  return cards.filter(card => card.is_leech)
}

