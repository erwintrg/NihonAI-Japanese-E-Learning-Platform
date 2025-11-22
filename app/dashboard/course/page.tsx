'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getVocabByLevel, type VocabularyItem } from '@/lib/data'

type SessionSection = 'theory' | 'examples' | 'practice'

type PracticeQuestion = {
  id: number
  vocabulary: VocabularyItem
  question: string
  correctAnswer: string
  userAnswer: string
  isCorrect: boolean | null
}

type CourseSession = {
  id: string
  title: string
  description: string
  theory: {
    title: string
    content: string
    vocabulary?: VocabularyItem[]
  }
  examples: Array<{
    japanese: string
    hiragana: string
    english: string
  }>
  practice: PracticeQuestion[]
}

export default function CoursePage() {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [currentSection, setCurrentSection] = useState<SessionSection>('theory')
  const [session, setSession] = useState<CourseSession | null>(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(300) // 5 minutes in seconds
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [practiceScore, setPracticeScore] = useState(0)
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check authentication
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        router.push('/auth')
      } else {
        setUser(user)
        // Load mock session data for "Hiragana Basics"
        loadSession()
      }
    })
  }, [router, supabase])

  // Timer effect
  useEffect(() => {
    if (!timerEnabled || !sessionStarted || sessionCompleted || timeRemaining <= 0) {
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up - auto-complete session
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timerEnabled, sessionStarted, sessionCompleted, timeRemaining])

  const loadSession = () => {
    // Mock session data for "Hiragana Basics" using JLPT N5 vocabulary
    const n5Vocab = getVocabByLevel('N5').slice(0, 5)
    
    const mockSession: CourseSession = {
      id: 'hiragana-basics-1',
      title: 'Hiragana Basics',
      description: 'Learn essential hiragana and basic vocabulary',
      theory: {
        title: 'Introduction to Hiragana',
        content: `Hiragana is one of the three writing systems in Japanese. It consists of 46 basic characters representing syllables. In this lesson, we'll learn some common words that use hiragana.

Key points:
- Hiragana is used for native Japanese words
- Each character represents a syllable (like "ka", "ki", "ku")
- It's essential for reading and writing Japanese`,
        vocabulary: n5Vocab,
      },
      examples: n5Vocab.slice(0, 3).map((vocab) => ({
        japanese: vocab.japanese,
        hiragana: vocab.hiragana,
        english: vocab.english,
      })),
      practice: n5Vocab.map((vocab, index) => ({
        id: index + 1,
        vocabulary: vocab,
        question: `Translate: ${vocab.japanese} (${vocab.hiragana})`,
        correctAnswer: vocab.english.toLowerCase().trim(),
        userAnswer: '',
        isCorrect: null,
      })),
    }

    setSession(mockSession)
  }

  const startSession = () => {
    setSessionStarted(true)
    setCurrentSection('theory')
    setTimeRemaining(300) // Reset to 5 minutes
  }

  const handleTimeUp = () => {
    // Auto-advance to practice if in theory/examples, or complete if in practice
    if (currentSection === 'theory') {
      setCurrentSection('examples')
      setTimeRemaining(300) // Reset timer for next section
    } else if (currentSection === 'examples') {
      setCurrentSection('practice')
      setTimeRemaining(300) // Reset timer for practice
    } else {
      completeSession()
    }
  }

  const nextSection = () => {
    if (currentSection === 'theory') {
      setCurrentSection('examples')
      setTimeRemaining(300) // Reset timer
    } else if (currentSection === 'examples') {
      setCurrentSection('practice')
      setTimeRemaining(300) // Reset timer
    }
  }

  const handlePracticeSubmit = () => {
    if (!userInput.trim() || !session) return

    const currentQuestion = session.practice[currentPracticeIndex]
    const userAnswer = userInput.toLowerCase().trim()
    
    // Check if answer is correct (handle multiple possible answers)
    const correctAnswers = currentQuestion.correctAnswer
      .split(/[,;]/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.length > 0)
    
    const isCorrect = 
      correctAnswers.includes(userAnswer) ||
      correctAnswers.some((ans) => userAnswer.includes(ans)) ||
      userAnswer === currentQuestion.correctAnswer

    // Update question with user answer
    const updatedPractice = [...session.practice]
    updatedPractice[currentPracticeIndex] = {
      ...currentQuestion,
      userAnswer: userInput.trim(),
      isCorrect,
    }

    setSession({ ...session, practice: updatedPractice })

    // Update score
    if (isCorrect) {
      setPracticeScore(practiceScore + 1)
    }

    // Clear input
    setUserInput('')

    // Move to next question or complete session
    if (currentPracticeIndex < session.practice.length - 1) {
      setCurrentPracticeIndex(currentPracticeIndex + 1)
    } else {
      completeSession()
    }
  }

  const completeSession = async () => {
    setSessionCompleted(true)
    setLoading(true)

    try {
      // Save to Supabase progress table
      const { error } = await supabase.from('progress').insert({
        user_id: user.id,
        quiz_score: practiceScore,
        quiz_type: 'course_session',
        vocabulary_items: session?.practice.map((q) => ({
          japanese: q.vocabulary.japanese,
          hiragana: q.vocabulary.hiragana,
          english: q.vocabulary.english,
          userAnswer: q.userAnswer,
          isCorrect: q.isCorrect,
        })),
      })

      if (error) {
        console.error('Error saving session progress:', error)
      }
    } catch (error) {
      console.error('Error saving session progress:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!mounted || !user || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const currentPracticeQuestion = session.practice[currentPracticeIndex]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white mb-4 inline-flex items-center gap-1 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
            {session.title}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            {session.description}
          </p>
        </div>

        {/* Timer */}
        {sessionStarted && !sessionCompleted && (
          <div className="mb-4 flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Time: {formatTime(timeRemaining)}
              </span>
              <button
                onClick={() => setTimerEnabled(!timerEnabled)}
                className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded transition-colors"
              >
                {timerEnabled ? 'Pause' : 'Resume'}
              </button>
            </div>
            <div className="text-xs text-zinc-500">
              Section: {currentSection.charAt(0).toUpperCase() + currentSection.slice(1)}
            </div>
          </div>
        )}

        {/* Start Screen */}
        {!sessionStarted && !sessionCompleted && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center border border-zinc-200 dark:border-zinc-800">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📚</span>
              </div>
              <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-2">
                Ready to learn?
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                This session includes theory, examples, and practice. Estimated time: 5 minutes.
              </p>
              <div className="text-sm text-zinc-500">
                <p>• Theory: Learn the concepts</p>
                <p>• Examples: See them in action</p>
                <p>• Practice: Test your understanding</p>
              </div>
            </div>
            <button
              onClick={startSession}
              className="inline-flex items-center gap-2 px-8 py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors text-lg"
            >
              Start Session
              <span>→</span>
            </button>
          </div>
        )}

        {/* Theory Section */}
        {sessionStarted && !sessionCompleted && currentSection === 'theory' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-2">
                {session.theory.title}
              </h2>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                  {session.theory.content}
                </p>
              </div>
            </div>

            {session.theory.vocabulary && session.theory.vocabulary.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
                  Vocabulary in this lesson:
                </h3>
                <div className="space-y-2">
                  {session.theory.vocabulary.map((vocab, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-black dark:text-zinc-50">
                          {vocab.japanese}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          ({vocab.hiragana})
                        </span>
                        <span className="text-zinc-700 dark:text-zinc-300">
                          - {vocab.english}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={nextSection}
              className="mt-6 w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
            >
              Continue to Examples →
            </button>
          </div>
        )}

        {/* Examples Section */}
        {sessionStarted && !sessionCompleted && currentSection === 'examples' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
              Examples
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              See how these words are used in context:
            </p>

            <div className="space-y-4 mb-6">
              {session.examples.map((example, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="mb-2">
                    <p className="text-xl font-bold text-black dark:text-zinc-50">
                      {example.japanese}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      ({example.hiragana})
                    </p>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {example.english}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={nextSection}
              className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
            >
              Continue to Practice →
            </button>
          </div>
        )}

        {/* Practice Section */}
        {sessionStarted && !sessionCompleted && currentSection === 'practice' && currentPracticeQuestion && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Question {currentPracticeIndex + 1} of {session.practice.length}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Score:</span>
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center">
                    {practiceScore}
                  </div>
                </div>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                <div
                  className="bg-pink-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${((currentPracticeIndex) / session.practice.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="mb-6">
              <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Translate to English:</p>
                <h2 className="text-3xl font-bold text-black dark:text-zinc-50 mb-1">
                  {currentPracticeQuestion.vocabulary.japanese}
                </h2>
                <p className="text-lg text-zinc-600 dark:text-zinc-400">
                  ({currentPracticeQuestion.vocabulary.hiragana})
                </p>
              </div>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePracticeSubmit()
                    }
                  }}
                  placeholder="Type your answer in English..."
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 text-black dark:text-white border-2 border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  autoFocus
                />
                
                <button
                  onClick={handlePracticeSubmit}
                  disabled={!userInput.trim()}
                  className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  Submit Answer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Session Complete */}
        {sessionCompleted && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🎉</span>
              </div>
              <h2 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
                Session Complete!
              </h2>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="text-5xl font-bold text-black dark:text-zinc-50">
                  {practiceScore}
                </div>
                <div className="text-2xl text-zinc-400">/</div>
                <div className="text-5xl font-bold text-zinc-400">
                  {session.practice.length}
                </div>
              </div>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                {practiceScore === session.practice.length
                  ? 'Perfect score! Excellent work! 🌟'
                  : practiceScore >= session.practice.length * 0.8
                  ? 'Great job! Keep practicing! 💪'
                  : 'Good effort! Review and try again! 📚'}
              </p>
            </div>

            {/* Review Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
                Review Your Answers:
              </h3>
              <div className="space-y-3">
                {session.practice.map((q) => (
                  <div
                    key={q.id}
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
                          <p className="font-bold text-lg text-black dark:text-zinc-50">
                            {q.vocabulary.japanese}
                          </p>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            ({q.vocabulary.hiragana})
                          </p>
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-1">
                          <span className="font-medium">Correct:</span> {q.vocabulary.english}
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
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

