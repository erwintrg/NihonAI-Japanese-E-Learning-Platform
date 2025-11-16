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
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
            Vocabulary Quiz
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Test your Japanese vocabulary knowledge
          </p>
        </div>

        {!quizStarted && !quizCompleted && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-4">
              Ready to start?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              You'll be asked to translate 5 Japanese words. Good luck!
            </p>
            <button
              onClick={startQuiz}
              className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium"
            >
              Start Quiz
            </button>
          </div>
        )}

        {quizStarted && !quizCompleted && currentQuestion && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
            <div className="mb-4 flex justify-between items-center">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="text-sm font-semibold text-black dark:text-zinc-50">
                Score: {score}/{questions.length}
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
                {currentQuestion.question}
              </h2>
              
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
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 text-black dark:text-white border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  autoFocus
                />
                
                <button
                  onClick={handleSubmit}
                  disabled={!userInput.trim()}
                  className="w-full px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Answer
                </button>
              </div>
            </div>
          </div>
        )}

        {quizCompleted && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
              Quiz Complete! 🎉
            </h2>
            <div className="text-4xl font-bold text-black dark:text-zinc-50 mb-6">
              {score}/{questions.length}
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {score === questions.length
                ? 'Perfect score! Excellent work!'
                : score >= questions.length * 0.7
                ? 'Great job! Keep practicing!'
                : 'Good effort! Review and try again!'}
            </p>

            <div className="mb-6 space-y-3 text-left">
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
                Review:
              </h3>
              {questions.map((q) => (
                <div
                  key={q.id}
                  className={`p-4 rounded-lg ${
                    q.isCorrect
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-black dark:text-zinc-50">
                        {q.vocabulary.japanese} ({q.vocabulary.hiragana})
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Correct: {q.correctAnswer}
                      </p>
                      {!q.isCorrect && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Your answer: {q.userAnswer}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl">
                      {q.isCorrect ? '✅' : '❌'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={resetQuiz}
                className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors font-medium"
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

