'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getRandomVocab, type VocabularyItem } from '@/lib/data'

type AssessmentQuestion = {
  id: number
  vocabulary: VocabularyItem
  question: string
  correctAnswer: string
  userAnswer: string
  isCorrect: boolean | null
}

type OnboardingStep = 'welcome' | 'level' | 'goal' | 'assessment' | 'complete'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [selectedLevel, setSelectedLevel] = useState<string>('beginner')
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [assessmentScore, setAssessmentScore] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check authentication
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        router.push('/auth')
      } else {
        setUser(user)
        // Check if user has already completed onboarding
        checkOnboardingStatus(user.id)
      }
    })
  }, [router, supabase])

  const checkOnboardingStatus = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .single()

    if (data?.onboarding_completed) {
      // User already completed onboarding, redirect to dashboard
      router.push('/dashboard')
    }
  }

  const startAssessment = () => {
    console.log('Starting assessment...')
    // Get 5 random vocabulary items for assessment
    const vocabItems = getRandomVocab(5)
    console.log('Got vocab items:', vocabItems.length)
    
    if (vocabItems.length === 0) {
      console.error('No vocabulary items available for assessment!')
      // Still allow user to skip
      setCurrentStep('assessment')
      setAssessmentQuestions([])
      setCurrentQuestionIndex(0)
      setAssessmentScore(0)
      setUserInput('')
      return
    }
    
    const questions: AssessmentQuestion[] = vocabItems.map((vocab, index) => ({
      id: index + 1,
      vocabulary: vocab,
      question: `Translate: ${vocab.japanese} (${vocab.hiragana})`,
      correctAnswer: vocab.english.toLowerCase().trim(),
      userAnswer: '',
      isCorrect: null,
    }))
    
    console.log('Created assessment questions:', questions.length)
    setAssessmentQuestions(questions)
    setCurrentQuestionIndex(0)
    setAssessmentScore(0)
    setUserInput('')
    setCurrentStep('assessment')
    console.log('Assessment step set, current question:', questions[0])
  }

  const handleAssessmentSubmit = () => {
    if (!userInput.trim()) return

    const currentQuestion = assessmentQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < assessmentQuestions.length
      ? assessmentQuestions[currentQuestionIndex]
      : null
    
    if (!currentQuestion) {
      console.error('No current question available')
      return
    }
    
    const userAnswer = userInput.toLowerCase().trim()
    
    // Check if answer is correct
    const correctAnswers = currentQuestion.correctAnswer
      .split(/[,;]/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.length > 0)
    
    const isCorrect = 
      correctAnswers.includes(userAnswer) ||
      correctAnswers.some((ans) => userAnswer.includes(ans)) ||
      userAnswer === currentQuestion.correctAnswer

    // Update question
    const updatedQuestions = [...assessmentQuestions]
    updatedQuestions[currentQuestionIndex] = {
      ...currentQuestion,
      userAnswer: userInput.trim(),
      isCorrect,
    }
    setAssessmentQuestions(updatedQuestions)

    // Update score
    const newScore = isCorrect ? assessmentScore + 1 : assessmentScore
    setAssessmentScore(newScore)

    // Clear input
    setUserInput('')

    // Move to next question or complete
    if (currentQuestionIndex < assessmentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // All questions answered, complete onboarding
      console.log('All questions answered, completing onboarding...', {
        currentQuestionIndex,
        totalQuestions: assessmentQuestions.length,
        newScore,
        updatedQuestionsLength: updatedQuestions.length
      })
      // Set loading immediately to show feedback
      setLoading(true)
      completeOnboarding(updatedQuestions, newScore)
    }
  }

  const completeOnboarding = async (finalQuestions: AssessmentQuestion[], finalScore: number) => {
    console.log('completeOnboarding called with:', { finalQuestions: finalQuestions.length, finalScore, user: !!user })
    
    if (!user) {
      console.error('User not available for onboarding completion')
      return
    }

    console.log('Setting loading to true...')
    setLoading(true)
    
    // Fallback timeout to ensure we don't get stuck
    const fallbackTimeout = setTimeout(() => {
      console.warn('Onboarding completion taking too long - forcing complete step')
      setCurrentStep('complete')
      setLoading(false)
    }, 5000)

    try {
      // Determine level based on assessment score
      let determinedLevel = selectedLevel
      if (selectedLevel === 'beginner' && finalScore >= 4) {
        determinedLevel = 'N5'
      } else if (selectedLevel === 'beginner' && finalScore >= 2) {
        determinedLevel = 'beginner'
      } else if (selectedLevel === 'beginner') {
        determinedLevel = 'beginner'
      }

      // Update user profile with onboarding data
      const { error } = await supabase
        .from('profiles')
        .update({
          current_level: determinedLevel,
          learning_goal: selectedGoals.join(','), // Store multiple goals as comma-separated
          roadmap_position: 'hiragana-basics',
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating profile:', error)
        // Still show complete step even if there's an error, but allow manual redirect
        setCurrentStep('complete')
        setLoading(false)
        console.log('Set currentStep to complete (error case)')
      } else {
        console.log('Onboarding completed successfully, setting step to complete')
        clearTimeout(fallbackTimeout)
        setCurrentStep('complete')
        setLoading(false)
        console.log('Current step set to:', 'complete')
        // Redirect to dashboard after a brief delay to show completion message
        setTimeout(() => {
          console.log('Redirecting to dashboard...')
          window.location.href = '/dashboard'
        }, 2000)
      }
    } catch (error) {
      console.error('Error completing onboarding:', error)
      clearTimeout(fallbackTimeout)
      // Show complete step even on error so user isn't stuck
      setCurrentStep('complete')
      setLoading(false)
      console.log('Set currentStep to complete (catch case)')
    }
  }

  const skipAssessment = () => {
    completeOnboarding([], 0)
  }

  if (!mounted || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-lg text-zinc-900 dark:text-zinc-50">Loading...</div>
      </div>
    )
  }

  const currentQuestion = assessmentQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < assessmentQuestions.length
    ? assessmentQuestions[currentQuestionIndex]
    : null

  // Debug: Log current step
  console.log('Current step:', currentStep, 'Loading:', loading, 'User:', !!user)

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-2 bg-yellow-100 dark:bg-yellow-900/20 text-xs text-yellow-800 dark:text-yellow-200 rounded">
            Debug: Step={currentStep}, Loading={loading ? 'true' : 'false'}
          </div>
        )}
        {/* Welcome Step */}
        {currentStep === 'welcome' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center border border-zinc-200 dark:border-zinc-800">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">👋</span>
              </div>
              <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
                Welcome to NihonAI Tutor!
              </h1>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                Let's set up your personalized learning journey
              </p>
            </div>
            <button
              onClick={() => setCurrentStep('level')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors text-lg"
            >
              Get Started
              <span>→</span>
            </button>
          </div>
        )}

        {/* Level Selection Step */}
        {currentStep === 'level' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
              What's your current Japanese level?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              This helps us customize your learning path
            </p>

            <div className="space-y-3 mb-6">
              {[
                { value: 'beginner', label: 'Beginner', desc: 'Just starting out' },
                { value: 'N5', label: 'JLPT N5', desc: 'Basic level' },
                { value: 'N4', label: 'JLPT N4', desc: 'Elementary level' },
                { value: 'N3', label: 'JLPT N3', desc: 'Intermediate level' },
                { value: 'N2', label: 'JLPT N2', desc: 'Upper-intermediate' },
                { value: 'N1', label: 'JLPT N1', desc: 'Advanced level' },
              ].map((level) => (
                <button
                  key={level.value}
                  onClick={() => setSelectedLevel(level.value)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedLevel === level.value
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="font-semibold text-black dark:text-zinc-50">{level.label}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">{level.desc}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep('welcome')}
                className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-black dark:text-white rounded-lg font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep('goal')}
                className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Goal Selection Step */}
        {currentStep === 'goal' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
              What's your learning goal?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              This helps us personalize your experience
            </p>

            <div className="space-y-3 mb-6">
              {[
                { value: 'travel', label: 'Travel to Japan', desc: 'Learn practical phrases for travel' },
                { value: 'work', label: 'Work in Japan', desc: 'Business and professional Japanese' },
                { value: 'anime', label: 'Understand Anime/Manga', desc: 'Pop culture and entertainment' },
                { value: 'academic', label: 'Academic Study', desc: 'Formal learning and JLPT preparation' },
                { value: 'conversation', label: 'Daily Conversation', desc: 'Speak naturally with native speakers' },
                { value: 'reading', label: 'Reading & Literature', desc: 'Read books, articles, and novels' },
              ].map((goal) => {
                const isSelected = selectedGoals.includes(goal.value)
                return (
                  <button
                    key={goal.value}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedGoals(selectedGoals.filter(g => g !== goal.value))
                      } else {
                        setSelectedGoals([...selectedGoals, goal.value])
                      }
                    }}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-pink-500 bg-pink-500'
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-black dark:text-zinc-50">{goal.label}</div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">{goal.desc}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep('level')}
                className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-black dark:text-white rounded-lg font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={startAssessment}
                className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
                disabled={selectedGoals.length === 0}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Assessment Step */}
        {currentStep === 'assessment' && (
          loading ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center border border-zinc-200 dark:border-zinc-800">
              <div className="text-lg text-zinc-600 dark:text-zinc-400">Completing onboarding...</div>
              <div className="mt-4 text-sm text-zinc-500">Please wait...</div>
            </div>
          ) : assessmentQuestions.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center border border-zinc-200 dark:border-zinc-800">
              <div className="text-lg text-zinc-600 dark:text-zinc-400 mb-4">No assessment questions available</div>
              <button
                onClick={skipAssessment}
                className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
              >
                Skip Assessment
              </button>
            </div>
          ) : currentQuestion ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-2">
                Quick Assessment (Optional)
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Answer 5 questions to help us gauge your current level. You can skip this step.
              </p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Question {currentQuestionIndex + 1} of {assessmentQuestions.length}
                </span>
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Score: {assessmentScore}
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                <div
                  className="bg-pink-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex) / assessmentQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Translate to English:</p>
                <h3 className="text-3xl font-bold text-black dark:text-zinc-50 mb-1">
                  {currentQuestion.vocabulary.japanese}
                </h3>
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
                      handleAssessmentSubmit()
                    }
                  }}
                  placeholder="Type your answer in English..."
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 text-black dark:text-white border-2 border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  autoFocus
                />
                
                <div className="flex gap-3">
                  <button
                    onClick={handleAssessmentSubmit}
                    disabled={!userInput.trim()}
                    className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    Submit Answer
                  </button>
                  <button
                    onClick={skipAssessment}
                    className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-black dark:text-white rounded-lg font-medium transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center border border-zinc-200 dark:border-zinc-800">
              <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading assessment...</div>
            </div>
          )
        )}

        {/* Complete Step */}
        {currentStep === 'complete' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center border border-zinc-200 dark:border-zinc-800">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🎉</span>
              </div>
              <h2 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
                All Set!
              </h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-4">
                Your learning journey is ready to begin
              </p>
              {assessmentQuestions.length > 0 && (
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Assessment Score:</span>
                  <span className="text-xl font-bold text-black dark:text-zinc-50">
                    {assessmentScore}/{assessmentQuestions.length}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                window.location.href = '/dashboard'
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-4 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-lg font-medium transition-colors text-lg"
            >
              Go to Dashboard
              <span>→</span>
            </button>
            {loading && (
              <p className="mt-4 text-sm text-zinc-500">Saving your preferences...</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

