'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getRandomVocab, getAllVocab, type VocabularyItem } from '@/lib/data'

type QuizQuestion = {
  id: number
  vocabulary: VocabularyItem
  question: string
  correctAnswer: string
  userAnswer: string
  isCorrect: boolean | null
}

export default function QuizPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [score, setScore] = useState(0)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check authentication
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        router.push('/auth')
      } else {
        setUser(user)
      }
    })
  }, [router, supabase])

  const startQuiz = () => {
    // Get 5 random vocabulary items
    const vocabItems = getRandomVocab(5)
    
    // Create quiz questions
    const quizQuestions: QuizQuestion[] = vocabItems.map((vocab, index) => ({
      id: index + 1,
      vocabulary: vocab,
      question: `Translate: ${vocab.japanese} (${vocab.hiragana})`,
      correctAnswer: vocab.english.toLowerCase().trim(),
      userAnswer: '',
      isCorrect: null,
    }))
    
    setQuestions(quizQuestions)
    setCurrentQuestionIndex(0)
    setScore(0)
    setUserInput('')
    setQuizStarted(true)
    setQuizCompleted(false)
  }

  const handleSubmit = () => {
    if (!userInput.trim()) return

    const currentQuestion = questions[currentQuestionIndex]
    const userAnswer = userInput.toLowerCase().trim()
    
    // Check if answer is correct (handle multiple possible answers)
    // Split by comma/semicolon for multiple answers, or check if it contains the correct answer
    const correctAnswers = currentQuestion.correctAnswer
      .split(/[,;]/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.length > 0)
    
    const isCorrect = 
      correctAnswers.includes(userAnswer) ||
      correctAnswers.some((ans) => userAnswer.includes(ans)) ||
      userAnswer === currentQuestion.correctAnswer

    // Update question with user answer
    const updatedQuestions = [...questions]
    updatedQuestions[currentQuestionIndex] = {
      ...currentQuestion,
      userAnswer: userInput.trim(), // Keep original case for display
      isCorrect,
    }
    setQuestions(updatedQuestions)

    // Update score
    if (isCorrect) {
      setScore(score + 1)
    }

    // Clear input
    setUserInput('')

    // Move to next question or end quiz
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      endQuiz(updatedQuestions, isCorrect ? score + 1 : score)
    }
  }

  const endQuiz = async (finalQuestions: QuizQuestion[], finalScore: number) => {
    setQuizCompleted(true)
    setLoading(true)

    try {
      // Save to Supabase progress table
      const { error } = await supabase.from('progress').insert({
        user_id: user.id,
        quiz_score: finalScore,
        quiz_type: 'vocabulary',
        vocabulary_items: finalQuestions.map((q) => ({
          japanese: q.vocabulary.japanese,
          hiragana: q.vocabulary.hiragana,
          english: q.vocabulary.english,
          userAnswer: q.userAnswer,
          isCorrect: q.isCorrect,
        })),
      })

      if (error) {
        console.error('Error saving quiz progress:', error)
      }
    } catch (error) {
      console.error('Error saving quiz progress:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetQuiz = () => {
    setQuizStarted(false)
    setQuizCompleted(false)
    setQuestions([])
    setCurrentQuestionIndex(0)
    setUserInput('')
    setScore(0)
  }

  if (!mounted || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
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
            Vocabulary Quiz
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Test your Japanese vocabulary knowledge
          </p>
        </div>

        {/* Start Screen */}
        {!quizStarted && !quizCompleted && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center border border-zinc-200 dark:border-zinc-800">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📚</span>
              </div>
              <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-2">
                Ready to start?
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                You'll be asked to translate 5 Japanese words. Good luck!
              </p>
            </div>
            <button
              onClick={startQuiz}
              className="inline-flex items-center gap-2 px-8 py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors text-lg"
            >
              Start Quiz
              <span>→</span>
            </button>
          </div>
        )}

        {/* Quiz Active */}
        {quizStarted && !quizCompleted && currentQuestion && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Score:</span>
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center">
                    {score}
                  </div>
                </div>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                <div
                  className="bg-pink-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(currentQuestionIndex / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="mb-6">
              <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Translate to English:</p>
                <h2 className="text-3xl font-bold text-black dark:text-zinc-50 mb-1">
                  {currentQuestion.vocabulary.japanese}
                </h2>
                <p className="text-lg text-zinc-600 dark:text-zinc-400">
                  ({currentQuestion.vocabulary.hiragana})
                </p>
              </div>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmit()
                    }
                  }}
                  placeholder="Type your answer in English..."
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 text-black dark:text-white border-2 border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  autoFocus
                />
                
                <button
                  onClick={handleSubmit}
                  disabled={!userInput.trim()}
                  className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  Submit Answer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz Complete */}
        {quizCompleted && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🎉</span>
              </div>
              <h2 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
                Quiz Complete!
              </h2>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="text-5xl font-bold text-black dark:text-zinc-50">
                  {score}
                </div>
                <div className="text-2xl text-zinc-400">/</div>
                <div className="text-5xl font-bold text-zinc-400">
                  {questions.length}
                </div>
              </div>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                {score === questions.length
                  ? 'Perfect score! Excellent work! 🌟'
                  : score >= questions.length * 0.7
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
                {questions.map((q) => (
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
                onClick={resetQuiz}
                className="inline-flex items-center gap-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
                <span>↻</span>
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-black dark:text-white rounded-lg font-medium transition-colors"
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

