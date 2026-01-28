'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  calculateNextReview, 
  type SRSCard, 
  type SRSRating,
  DEFAULT_SRS_SETTINGS,
  getStageName,
  type SRSSettings
} from '@/lib/srs'
import { getAllVocab, type VocabularyItem } from '@/lib/data'
import Link from 'next/link'

type ReviewCard = SRSCard & {
  vocabulary?: VocabularyItem
}

export default function SRSReviewPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [cards, setCards] = useState<ReviewCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [timer, setTimer] = useState(0)
  const [answerTime, setAnswerTime] = useState(0)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<Date | null>(null)
  const [settings] = useState<SRSSettings>(DEFAULT_SRS_SETTINGS)
  const [dailyProgress, setDailyProgress] = useState({ newCards: 0, reviews: 0 })
  const [stats, setStats] = useState({
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0,
    leech: 0,
  })

  useEffect(() => {
    checkAuth()
  }, [])

  // Reset card state when moving to a new card
  useEffect(() => {
    if (sessionStarted && !sessionCompleted && currentCardIndex < cards.length) {
      startTimeRef.current = new Date()
      setTimer(0)
      setAnswerTime(0)
      setShowAnswer(false)
    }
  }, [sessionStarted, currentCardIndex, cards.length, sessionCompleted])

  // Timer effect - separate from card reset to avoid resetting showAnswer
  useEffect(() => {
    if (sessionStarted && !sessionCompleted && currentCardIndex < cards.length) {
      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => prev + 1)
      }, 1000)

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
        }
      }
    }
  }, [sessionStarted, currentCardIndex, cards.length, sessionCompleted])

  // Answer time tracking - separate effect that only runs when answer is shown
  useEffect(() => {
    if (showAnswer && sessionStarted && !sessionCompleted) {
      const answerTimerInterval = setInterval(() => {
        setAnswerTime(prev => prev + 1)
      }, 1000)

      return () => {
        clearInterval(answerTimerInterval)
      }
    }
  }, [showAnswer, sessionStarted, sessionCompleted])

  const checkAuth = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      router.push('/auth')
    } else {
      setUser(user)
      await loadCards(user.id)
    }
  }

  const loadCards = async (userId: string) => {
    setLoading(true)
    try {
      // Load SRS cards from database
      const { data: srsCards, error: cardsError } = await supabase
        .from('user_vocabulary')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }) // Sequential order (oldest first)

      if (cardsError) {
        console.error('Error loading SRS cards:', cardsError)
        setLoading(false)
        return
      }

      // Load all vocabulary to match with cards
      const allVocab = getAllVocab()
      const vocabMap = new Map(allVocab.map(v => [v.id.toString(), v]))

      // Convert database records to SRSCard format and match with vocabulary
      const reviewCards: ReviewCard[] = (srsCards || []).map(card => ({
        id: card.id,
        user_id: card.user_id,
        vocabulary_id: card.vocabulary_id,
        stage: card.stage as any,
        next_review_date: card.next_review_date ? new Date(card.next_review_date) : null,
        correct_count: card.correct_count || 0,
        incorrect_count: card.incorrect_count || 0,
        ease_multiplier: parseFloat(card.ease_multiplier) || 3.00,
        interval_days: card.interval_days || 0,
        last_reviewed_at: card.last_reviewed_at ? new Date(card.last_reviewed_at) : null,
        times_lapsed: card.times_lapsed || 0,
        is_leech: card.is_leech || false,
        leech_tagged_at: card.leech_tagged_at ? new Date(card.leech_tagged_at) : null,
        current_step: card.current_step || 0,
        learning_steps_completed: Array.isArray(card.learning_steps_completed) 
          ? card.learning_steps_completed 
          : [],
        created_at: new Date(card.created_at),
        vocabulary: vocabMap.get(card.vocabulary_id),
      }))

      // Filter and sort cards according to SRS rules
      const now = new Date()
      
      // Get new cards (not yet started)
      const newCards = reviewCards
        .filter(card => card.stage === 'new')
        .slice(0, settings.newCardsPerDay - dailyProgress.newCards)
      
      // Get learning cards (due for review)
      const learningCards = reviewCards.filter(card => {
        if (card.stage !== 'learning') return false
        if (!card.next_review_date) return true
        return new Date(card.next_review_date) <= now
      })
      
      // Get review cards (due for review)
      const reviewCardsDue = reviewCards.filter(card => {
        if (card.stage !== 'review') return false
        if (!card.next_review_date) return true
        return new Date(card.next_review_date) <= now
      }).sort((a, b) => {
        // Sort by due date (oldest first), then random
        if (a.next_review_date && b.next_review_date) {
          return a.next_review_date.getTime() - b.next_review_date.getTime()
        }
        return Math.random() - 0.5
      }).slice(0, settings.maxReviewsPerDay - dailyProgress.reviews)

      // Combine: new cards first, then mix learning and reviews
      const cardsToReview = [
        ...newCards,
        ...learningCards,
        ...reviewCardsDue,
      ]

      // Calculate stats
      setStats({
        new: reviewCards.filter(c => c.stage === 'new').length,
        learning: reviewCards.filter(c => c.stage === 'learning').length,
        review: reviewCards.filter(c => c.stage === 'review').length,
        mastered: reviewCards.filter(c => c.stage === 'mastered').length,
        leech: reviewCards.filter(c => c.is_leech).length,
      })

      setCards(cardsToReview)
      
      if (cardsToReview.length === 0) {
        setSessionCompleted(true)
      }
    } catch (error) {
      console.error('Error loading cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const startSession = () => {
    if (cards.length === 0) {
      setSessionCompleted(true)
      return
    }
    setSessionStarted(true)
    setCurrentCardIndex(0)
  }

  const handleRating = async (rating: SRSRating) => {
    if (!user || currentCardIndex >= cards.length) return

    const currentCard = cards[currentCardIndex]
    if (!currentCard) return

    // Calculate new review date and interval
    const result = calculateNextReview(currentCard, rating, settings)
    
    // Cap answer time at 60 seconds
    const cappedTime = Math.min(answerTime || timer, 60)

    // Update card in database
    const updateData: any = {
      stage: result.newStage,
      current_step: result.newStep,
      next_review_date: result.nextReviewDate.toISOString(),
      interval_days: result.newInterval,
      ease_multiplier: result.newEase,
      last_reviewed_at: new Date().toISOString(),
      correct_count: currentCard.correct_count + (rating === 'good' || rating === 'easy' ? 1 : 0),
      incorrect_count: currentCard.incorrect_count + (rating === 'again' ? 1 : 0),
      times_lapsed: rating === 'again' && currentCard.stage === 'review' 
        ? currentCard.times_lapsed + 1 
        : currentCard.times_lapsed,
      is_leech: result.isLeech,
      leech_tagged_at: result.isLeech && !currentCard.is_leech 
        ? new Date().toISOString() 
        : currentCard.leech_tagged_at,
    }

    const { error } = await supabase
      .from('user_vocabulary')
      .update(updateData)
      .eq('id', currentCard.id)

    if (error) {
      console.error('Error updating card:', error)
    }

    // Update daily progress
    if (currentCard.stage === 'new') {
      setDailyProgress(prev => ({ ...prev, newCards: prev.newCards + 1 }))
    } else {
      setDailyProgress(prev => ({ ...prev, reviews: prev.reviews + 1 }))
    }

    // Move to next card or complete session
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
      setShowAnswer(false)
    } else {
      setSessionCompleted(true)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Loading...</div>
          <div className="text-zinc-600 dark:text-zinc-400">Preparing your review session</div>
        </div>
      </div>
    )
  }

  if (sessionCompleted || cards.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
              Review Complete!
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
              {cards.length === 0 
                ? "You don't have any cards to review right now. Great job!"
                : "You've completed all available reviews for now."}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{stats.new}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">New</div>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.learning}</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Learning</div>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.review}</div>
                <div className="text-sm text-orange-700 dark:text-orange-300">Review</div>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.mastered}</div>
                <div className="text-sm text-green-700 dark:text-green-300">Mastered</div>
              </div>
              <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.leech}</div>
                <div className="text-sm text-red-700 dark:text-red-300">Leech</div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
              Spaced Repetition Review
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
              Review your vocabulary to strengthen your memory
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                <div className="text-3xl font-bold text-orange-900 dark:text-orange-100 mb-1">
                  {cards.length}
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">Cards to Review</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                  {dailyProgress.newCards}/{settings.newCardsPerDay}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">New Cards Today</div>
              </div>
            </div>

            <button
              onClick={startSession}
              className="w-full px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-lg transition-colors"
            >
              Start Review Session
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentCard = cards[currentCardIndex]
  const progress = ((currentCardIndex + 1) / cards.length) * 100

  if (!currentCard || !currentCard.vocabulary) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Error</div>
          <div className="text-zinc-600 dark:text-zinc-400">Card data not found</div>
        </div>
      </div>
    )
  }

  const vocab = currentCard.vocabulary

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Card {currentCardIndex + 1} of {cards.length}
            </span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {getStageName(currentCard.stage)} • {formatTime(timer)}
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 mb-6 min-h-[400px] flex flex-col justify-center">
          {!showAnswer ? (
            // Question side
            <div className="text-center">
              <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                {currentCard.stage === 'new' ? 'New Card' : 'Review'}
              </div>
              <div className="text-6xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
                {vocab.japanese}
              </div>
              {vocab.hiragana && vocab.hiragana !== vocab.japanese && (
                <div className="text-2xl text-zinc-600 dark:text-zinc-400 mb-4">
                  {vocab.hiragana}
                </div>
              )}
              <button
                onClick={() => setShowAnswer(true)}
                className="mt-8 px-6 py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-50 rounded-xl font-medium transition-colors"
              >
                Show Answer
              </button>
            </div>
          ) : (
            // Answer side
            <div className="text-center">
              <div className="text-6xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                {vocab.japanese}
              </div>
              {vocab.hiragana && vocab.hiragana !== vocab.japanese && (
                <div className="text-2xl text-zinc-600 dark:text-zinc-400 mb-4">
                  {vocab.hiragana}
                </div>
              )}
              <div className="text-3xl font-semibold text-orange-600 dark:text-orange-400 mb-6">
                {vocab.english}
              </div>
              {vocab.romaji && (
                <div className="text-lg text-zinc-500 dark:text-zinc-400 mb-6">
                  {vocab.romaji}
                </div>
              )}
              
              {/* Answer Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <button
                  onClick={() => handleRating('again')}
                  className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors"
                >
                  Again
                </button>
                <button
                  onClick={() => handleRating('hard')}
                  className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors"
                >
                  Hard
                </button>
                <button
                  onClick={() => handleRating('good')}
                  className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
                >
                  Good
                </button>
                <button
                  onClick={() => handleRating('easy')}
                  className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors"
                >
                  Easy
                </button>
              </div>

              {currentCard.is_leech && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    ⚠️ This is a leech card. Consider reviewing it more carefully or creating a mnemonic.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

