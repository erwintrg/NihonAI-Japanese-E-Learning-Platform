'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAllHiragana, getAllHiraganaBatches, getHiraganaBatchName, type KanaCharacter } from '@/lib/kana'

type QuizType = 'character-to-romaji'
type KanaType = 'hiragana' | 'katakana'

type DrillQuestion = {
  kana: KanaCharacter
  questionType: QuizType
  question: string
  correctAnswer: string
  userAnswer: string | null
  isCorrect: boolean | null
}

type KanaProgress = {
  character: string
  correctCount: number
  targetCount: number // 3
}

export default function KanaDrillsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [selectedKana, setSelectedKana] = useState<Set<string>>(new Set())
  const [selectedBatches, setSelectedBatches] = useState<Set<number>>(new Set())
  const [includeDakuten, setIncludeDakuten] = useState(false)
  const [includeHandakuten, setIncludeHandakuten] = useState(false)
  const [includeCombos, setIncludeCombos] = useState(false)
  const [activeTab, setActiveTab] = useState<KanaType>('hiragana')
  const [drillStarted, setDrillStarted] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<DrillQuestion | null>(null)
  const [kanaProgress, setKanaProgress] = useState<Map<string, KanaProgress>>(new Map())
  const [userInput, setUserInput] = useState('')
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [drillComplete, setDrillComplete] = useState(false)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [unlockCheckComplete, setUnlockCheckComplete] = useState(false)
  const [drillKanaList, setDrillKanaList] = useState<KanaCharacter[]>([])
  const [allQuestions, setAllQuestions] = useState<DrillQuestion[]>([])

  const allBatches = getAllHiraganaBatches()
  const allKana = getAllHiragana()

  // Organize kana in typical chart layout (rows)
  const organizeKanaInRows = (kana: KanaCharacter[]): KanaCharacter[][] => {
    const rows: KanaCharacter[][] = []
    const batches = getAllHiraganaBatches()
    
    batches.forEach(batch => {
      rows.push(batch.kana)
    })
    
    return rows
  }

  const kanaRows = organizeKanaInRows(allKana)

  useEffect(() => {
    setMounted(true)
    
    supabase.auth.getUser().then(async ({ data: { user }, error }) => {
      if (error || !user) {
        router.push('/auth')
        return
      }
      
      setUser(user)
      
      // Check if Kana Drills is unlocked (user has completed first Hiragana batch)
      const { data: batches } = await supabase
        .from('completed_batches')
        .select('batch_number')
        .eq('user_id', user.id)
        .eq('batch_type', 'hiragana')
        .eq('batch_number', 1)
      
      if (batches && batches.length > 0) {
        setIsUnlocked(true)
      }
      
      // Mark unlock check as complete
      setUnlockCheckComplete(true)
    })
  }, [router, supabase])

  // Auto-focus input field for textfield questions
  useEffect(() => {
    if (
      drillStarted &&
      !drillComplete &&
      currentQuestion &&
      answerFeedback === null &&
      inputRef.current
    ) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [currentQuestion, drillStarted, drillComplete, answerFeedback])

  const handleBatchToggle = (batchNumber: number) => {
    setSelectedBatches(prev => {
      const newSet = new Set(prev)
      if (newSet.has(batchNumber)) {
        newSet.delete(batchNumber)
        // Also remove individual kana from that batch
        const batch = allBatches.find(b => b.batchNumber === batchNumber)
        if (batch) {
          setSelectedKana(prevKana => {
            const newKanaSet = new Set(prevKana)
            batch.kana.forEach(k => newKanaSet.delete(k.character))
            return newKanaSet
          })
        }
      } else {
        newSet.add(batchNumber)
        // Also add all kana from that batch
        const batch = allBatches.find(b => b.batchNumber === batchNumber)
        if (batch) {
          setSelectedKana(prevKana => {
            const newKanaSet = new Set(prevKana)
            batch.kana.forEach(k => newKanaSet.add(k.character))
            return newKanaSet
          })
        }
      }
      return newSet
    })
  }

  const handleKanaToggle = (character: string) => {
    setSelectedKana(prev => {
      const newSet = new Set(prev)
      const wasSelected = newSet.has(character)
      
      if (wasSelected) {
        newSet.delete(character)
      } else {
        newSet.add(character)
      }
      
      // If removing a kana, check if all kana from its batch are now removed
      // If so, deselect the batch to keep state in sync
      if (wasSelected) {
        const kana = allKana.find(k => k.character === character)
        if (kana) {
          const batch = allBatches.find(b => b.batchNumber === kana.batch)
          if (batch) {
            // Check if any kana from this batch are still selected
            const hasAnyBatchKana = batch.kana.some(k => newSet.has(k.character))
            if (!hasAnyBatchKana) {
              setSelectedBatches(prevBatches => {
                const newBatches = new Set(prevBatches)
                newBatches.delete(batch.batchNumber)
                return newBatches
              })
            }
          }
        }
      }
      
      return newSet
    })
  }

  const clearSelection = () => {
    setSelectedKana(new Set())
    setSelectedBatches(new Set())
  }

  const generateQuestion = useCallback((kanaList: KanaCharacter[], progressMap: Map<string, KanaProgress>): DrillQuestion | null => {
    if (kanaList.length === 0) return null

    // Filter to only kana that haven't reached target (3 correct)
    const incompleteKana = kanaList.filter(k => {
      const progress = progressMap.get(k.character)
      return !progress || progress.correctCount < progress.targetCount
    })

    if (incompleteKana.length === 0) return null

    // Randomly select a kana that needs practice
    const randomKana = incompleteKana[Math.floor(Math.random() * incompleteKana.length)]
    
    return {
      kana: randomKana,
      questionType: 'character-to-romaji',
      question: randomKana.character,
      correctAnswer: randomKana.romaji,
      userAnswer: null,
      isCorrect: null,
    }
  }, [])

  const startDrill = () => {
    // Get all selected kana - use only the final selection (selectedKana), not batches
    const kanaList: KanaCharacter[] = []
    
    // Add individually selected kana (this is the final decision)
    selectedKana.forEach(char => {
      const kana = allKana.find(k => k.character === char)
      if (kana) {
        kanaList.push(kana)
      }
    })

    // TODO: Add Dakuten, Handakuten, and Combo kana when data is available
    // if (includeDakuten) { ... }
    // if (includeHandakuten) { ... }
    // if (includeCombos) { ... }

    if (kanaList.length === 0) {
      return // Button should be disabled, but just in case
    }

    // Initialize progress for all selected kana
    const progressMap = new Map<string, KanaProgress>()
    const questions: DrillQuestion[] = []
    
    kanaList.forEach(k => {
      progressMap.set(k.character, {
        character: k.character,
        correctCount: 0,
        targetCount: 3,
      })
      
      // Generate 3 questions per kana
      for (let i = 0; i < 3; i++) {
        questions.push({
          kana: k,
          questionType: 'character-to-romaji',
          question: k.character,
          correctAnswer: k.romaji,
          userAnswer: null,
          isCorrect: null,
        })
      }
    })
    
    // Shuffle questions to avoid consecutive same kana
    // Use a better algorithm: repeatedly shuffle until no consecutive duplicates
    let attempts = 0
    let hasConsecutive = true
    
    while (hasConsecutive && attempts < 100) {
      // Shuffle
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[questions[i], questions[j]] = [questions[j], questions[i]]
      }
      
      // Check for consecutive duplicates
      hasConsecutive = false
      for (let i = 1; i < questions.length; i++) {
        if (questions[i].kana.character === questions[i - 1].kana.character) {
          hasConsecutive = true
          break
        }
      }
      attempts++
    }
    
    // If still has consecutive after attempts, manually fix them
    if (hasConsecutive) {
      for (let i = 1; i < questions.length; i++) {
        if (questions[i].kana.character === questions[i - 1].kana.character) {
          // Find any question with different kana to swap with
          for (let j = 0; j < questions.length; j++) {
            if (j !== i && j !== i - 1 && 
                questions[j].kana.character !== questions[i - 1].kana.character &&
                (j === 0 || questions[j - 1].kana.character !== questions[j].kana.character) &&
                (j === questions.length - 1 || questions[j + 1].kana.character !== questions[j].kana.character)) {
              ;[questions[i], questions[j]] = [questions[j], questions[i]]
              break
            }
          }
        }
      }
    }
    
    setAllQuestions(questions)
    setKanaProgress(progressMap)
    setDrillKanaList(kanaList)
    setTotalQuestions(questions.length)
    setCorrectAnswers(0)

    // Set first question
    if (questions.length > 0) {
      setCurrentQuestion(questions[0])
      setCurrentQuestionIndex(0)
      setDrillStarted(true)
      setUserInput('')
      setAnswerFeedback(null)
      setDrillComplete(false)
    }
  }

  const handleSubmit = () => {
    if (!currentQuestion) return

    // Safety check: prevent submission with empty input (button should be disabled, but double-check)
    if (!userInput.trim()) {
      return
    }

    const userAnswer = userInput.trim().toLowerCase()
    const isCorrect = userAnswer === currentQuestion.correctAnswer.toLowerCase()

    // Update the question at currentQuestionIndex
    const updatedQuestions = [...allQuestions]
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      userAnswer,
      isCorrect,
    }
    setAllQuestions(updatedQuestions)

    // Update current question
    const updatedQuestion: DrillQuestion = {
      ...currentQuestion,
      userAnswer,
      isCorrect,
    }
    setCurrentQuestion(updatedQuestion)
    setAnswerFeedback(isCorrect ? 'correct' : 'incorrect')

    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1)
    }

    // Update progress
    setKanaProgress(prev => {
      const newMap = new Map(prev)
      if (isCorrect) {
        const progress = newMap.get(currentQuestion.kana.character)
        if (progress) {
          newMap.set(currentQuestion.kana.character, {
            ...progress,
            correctCount: progress.correctCount + 1,
          })
        }
      }
      return newMap
    })

    // Move to next question after a short delay (matching practice section)
    setTimeout(() => {
      // Find next unanswered question
      const nextQuestionIndex = allQuestions.findIndex((q, idx) => idx > currentQuestionIndex && q.userAnswer === null)
      
      if (nextQuestionIndex !== -1) {
        setCurrentQuestion(allQuestions[nextQuestionIndex])
        setCurrentQuestionIndex(nextQuestionIndex)
        setUserInput('')
        setAnswerFeedback(null)
      } else {
        // All questions completed!
        setDrillComplete(true)
        setCurrentQuestion(null)
      }
    }, 500) // Quick feedback, then move on (same as practice section)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentQuestion) {
      handleSubmit()
    }
  }

  const goBackToSelection = () => {
    setDrillStarted(false)
    setDrillComplete(false)
    setCurrentQuestion(null)
    setCurrentQuestionIndex(0)
    setKanaProgress(new Map())
    setUserInput('')
    setAnswerFeedback(null)
    setAllQuestions([])
    setCorrectAnswers(0)
    setTotalQuestions(0)
  }

  const calculatePercentage = () => {
    if (totalQuestions === 0) return 0
    return Math.round((correctAnswers / totalQuestions) * 100)
  }

  if (!mounted || !unlockCheckComplete) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-2">
              Loading...
            </h2>
          </div>
        </div>
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-2">
              Kana Drills Locked
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Complete your first Hiragana learning session to unlock Kana Drills.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (drillComplete) {
    const percentage = calculatePercentage()
    const incorrectQuestions = allQuestions.filter(q => q.isCorrect === false)
    const correctQuestions = allQuestions.filter(q => q.isCorrect === true)
    
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
                Drill Complete!
              </h2>
              <div className="text-6xl font-bold text-pink-500 dark:text-pink-400 mb-2">
                {percentage}%
              </div>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                {correctAnswers} out of {totalQuestions} correct
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
                {percentage === 100
                  ? 'Perfect! You mastered all kana! 🌟'
                  : percentage >= 80
                  ? 'Great job! Keep practicing! 📚'
                  : 'Good effort! Review and try again! 📚'}
              </p>
            </div>

            {/* Review Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-black dark:text-zinc-50">
                  Review Your Answers:
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCorrectAnswers}
                    onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                    className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    Show correct answers
                  </span>
                </label>
              </div>
              <div className="space-y-3">
                {allQuestions
                  .filter((q) => {
                    if (q.isCorrect === null) return false
                    if (q.isCorrect === false) return true
                    if (showCorrectAnswers && q.isCorrect === true) return true
                    return false
                  })
                  .map((q, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      q.isCorrect
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{q.isCorrect ? '✅' : '❌'}</span>
                          <p className="font-bold text-3xl text-black dark:text-zinc-50">
                            {q.kana.character}
                          </p>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            = {q.kana.romaji}
                          </p>
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-1">
                          <span className="font-medium">Correct answer:</span> {q.correctAnswer}
                        </p>
                        {!q.isCorrect && (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            <span className="font-medium">Your answer:</span> {q.userAnswer || '[No answer]'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {allQuestions.filter((q) => {
                  if (q.isCorrect === null) return false
                  if (q.isCorrect === false) return true
                  if (showCorrectAnswers && q.isCorrect === true) return true
                  return false
                }).length === 0 && (
                  <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
                    <p>No incorrect answers to review! 🎉</p>
                    <p className="text-sm mt-2">Toggle "Show correct answers" to see all your answers.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setDrillStarted(false)
                  setDrillComplete(false)
                  setCurrentQuestion(null)
                  setCurrentQuestionIndex(0)
                  setKanaProgress(new Map())
                  setSelectedKana(new Set())
                  setSelectedBatches(new Set())
                  setAllQuestions([])
                  setCorrectAnswers(0)
                  setTotalQuestions(0)
                }}
                className="flex-1 px-6 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-black dark:text-zinc-50 rounded-lg font-medium transition-colors"
              >
                Start New Drill
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!drillStarted) {
    const hasSelection = selectedKana.size > 0
    
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
              Kana Drills
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Practice kana characters until you can answer correctly 3 times each.
            </p>
          </div>

          {/* Kana Type Tabs */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 mb-6 overflow-hidden">
            <div className="flex">
              <button
                onClick={() => setActiveTab('hiragana')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'hiragana'
                    ? 'bg-pink-500 text-white'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                Hiragana
              </button>
              <button
                onClick={() => setActiveTab('katakana')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-l border-zinc-200 dark:border-zinc-700 ${
                  activeTab === 'katakana'
                    ? 'bg-pink-500 text-white'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                Katakana
              </button>
            </div>
          </div>

          {/* Batch Selection */}
          {activeTab === 'hiragana' && (
            <>
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                    Select Kana Groups
                  </h2>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 underline"
                  >
                    Clear Selection
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {allBatches.map(batch => (
                    <button
                      key={batch.batchNumber}
                      onClick={() => handleBatchToggle(batch.batchNumber)}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        selectedBatches.has(batch.batchNumber)
                          ? 'bg-pink-100 dark:bg-pink-900/30 border-pink-500 text-pink-700 dark:text-pink-300'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">
                        {getHiraganaBatchName(batch.batchNumber)}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {batch.kana[0].character}-{batch.kana[batch.kana.length - 1].character}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Extension Options */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 mb-6">
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
                  Additional Options
                </h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDakuten}
                      onChange={(e) => setIncludeDakuten(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-700 text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      Include Dakuten (が, ぎ, ぐ, げ, ご, etc.)
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeHandakuten}
                      onChange={(e) => setIncludeHandakuten(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-700 text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      Include Handakuten (ぱ, ぴ, ぷ, ぺ, ぽ)
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCombos}
                      onChange={(e) => setIncludeCombos(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-700 text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      Include Kana Combos (きゃ, きゅ, きょ, にゃ, にゅ, にょ, etc.)
                    </span>
                  </label>
                </div>
              </div>

              {/* Individual Kana Selection - Organized in Chart Layout */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 mb-6">
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
                  And/Or Select Individual Kana
                </h2>
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {kanaRows.slice(0, Math.ceil(kanaRows.length / 2)).map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-2 flex-wrap">
                        {row.map(kana => (
                          <button
                            key={kana.character}
                            onClick={() => handleKanaToggle(kana.character)}
                            className={`p-3 rounded-lg border-2 transition-colors text-center min-w-[60px] ${
                              selectedKana.has(kana.character)
                                ? 'bg-pink-100 dark:bg-pink-900/30 border-pink-500 text-pink-700 dark:text-pink-300'
                                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                          >
                            <div className="text-2xl mb-1">{kana.character}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{kana.romaji}</div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Right Column */}
                  <div className="space-y-4">
                    {kanaRows.slice(Math.ceil(kanaRows.length / 2)).map((row, rowIdx) => (
                      <div key={rowIdx + Math.ceil(kanaRows.length / 2)} className="flex gap-2 flex-wrap">
                        {row.map(kana => (
                          <button
                            key={kana.character}
                            onClick={() => handleKanaToggle(kana.character)}
                            className={`p-3 rounded-lg border-2 transition-colors text-center min-w-[60px] ${
                              selectedKana.has(kana.character)
                                ? 'bg-pink-100 dark:bg-pink-900/30 border-pink-500 text-pink-700 dark:text-pink-300'
                                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                          >
                            <div className="text-2xl mb-1">{kana.character}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{kana.romaji}</div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'katakana' && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 mb-6">
              <p className="text-zinc-600 dark:text-zinc-400 text-center py-8">
                Katakana support coming soon. Your Hiragana selections are remembered.
              </p>
            </div>
          )}

          <button
            onClick={startDrill}
            disabled={!hasSelection}
            className={`w-full px-6 py-4 rounded-lg font-medium text-lg transition-colors ${
              hasSelection
                ? 'bg-pink-500 hover:bg-pink-600 text-white'
                : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed'
            }`}
          >
            Start Drill
          </button>
        </div>
      </div>
    )
  }

  // Drill in progress
  const percentage = calculatePercentage()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={goBackToSelection}
          className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-flex items-center gap-2"
        >
          ← Back to Selection
        </button>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Progress:</span>
              <div className="text-lg font-bold text-pink-500 dark:text-pink-400">
                {percentage}%
              </div>
            </div>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5">
            <div
              className="bg-pink-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(currentQuestionIndex / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        {currentQuestion && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800 mb-6">
            <div className="text-center mb-6">
              <h2 className="text-8xl font-bold text-black dark:text-zinc-50 mb-4">
                {currentQuestion.question}
              </h2>
            </div>

            <div className="space-y-4">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={answerFeedback !== null}
                placeholder="Type the romaji"
                className={`w-full px-4 py-3 text-black dark:text-white border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-center text-2xl ${
                  answerFeedback === 'correct'
                    ? 'bg-green-200 dark:bg-green-800 border-green-400 dark:border-green-600'
                    : answerFeedback === 'incorrect'
                    ? 'bg-red-200 dark:bg-red-800 border-red-400 dark:border-red-600'
                    : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600'
                }`}
              />
              <button
                onClick={handleSubmit}
                disabled={!userInput.trim() || answerFeedback !== null}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 dark:disabled:text-zinc-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Submit Answer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
