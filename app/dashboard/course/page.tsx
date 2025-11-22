'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getHiraganaByBatch, type KanaCharacter } from '@/lib/kana'
import { convertRomajiToHiragana } from '@/lib/romaji-to-hiragana'
import { getAllVocab, type VocabularyItem } from '@/lib/data'

type SessionSection = 'theory' | 'examples' | 'practice'

type KanaPracticeQuestion = {
  id: number
  kana: KanaCharacter
  questionType: 'character-to-romaji' | 'romaji-to-character'
  question: string
  correctAnswer: string
  userAnswer: string
  isCorrect: boolean | null
}

type CourseSession = {
  id: string
  title: string
  description: string
  batchNumber: number
  theory: {
    title: string
    content: string
    kana: KanaCharacter[]
    wordExamples?: VocabularyItem[]
  }
  examples: KanaCharacter[]
  practice: KanaPracticeQuestion[]
}

function CoursePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [convertedInput, setConvertedInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check authentication
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        router.push('/auth')
      } else {
        setUser(user)
        // Load Hiragana session data
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
    // Get batch number from URL params, default to batch 1
    const batchNumber = parseInt(searchParams?.get('batch') || '1', 10)
    const batchKana = getHiraganaByBatch(batchNumber)
    
    if (batchKana.length === 0) {
      console.error(`No Hiragana found for batch ${batchNumber}`)
      return
    }

    // Create practice questions - mix of character-to-romaji and romaji-to-character
    const practiceQuestions: KanaPracticeQuestion[] = batchKana.flatMap((kana, index) => [
      {
        id: index * 2 + 1,
        kana,
        questionType: 'character-to-romaji' as const,
        question: `What is the romaji for this character?`,
        correctAnswer: kana.romaji.toLowerCase(),
        userAnswer: '',
        isCorrect: null,
      },
      {
        id: index * 2 + 2,
        kana,
        questionType: 'romaji-to-character' as const,
        question: `What is the Hiragana character for "${kana.romaji}"?`,
        correctAnswer: kana.character,
        userAnswer: '',
        isCorrect: null,
      },
    ])

    // Randomize practice questions
    for (let i = practiceQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [practiceQuestions[i], practiceQuestions[j]] = [practiceQuestions[j], practiceQuestions[i]]
    }

    // Get word examples using the kana being learned
    const allVocab = getAllVocab()
    const kanaCharacters = batchKana.map(k => k.character)
    const wordExamples = allVocab
      .filter(vocab => {
        // Check if the word contains any of the kana being learned
        return kanaCharacters.some(kana => vocab.hiragana.includes(kana))
      })
      .slice(0, 5) // Limit to 5 examples

    // Enhanced theory content
    let theoryContent = ''
    if (batchNumber === 1) {
      theoryContent = `Welcome to Hiragana! This is your first step into reading Japanese.

**Why do we need Kana?**
Japanese uses three writing systems: Hiragana, Katakana, and Kanji. Hiragana is the foundation - it's used for:
- Native Japanese words (not borrowed from other languages)
- Grammatical particles and endings
- Words that don't have Kanji or when Kanji is too formal
- Furigana (small characters above Kanji to show pronunciation)

**What is Hiragana?**
Hiragana consists of 46 basic characters, each representing a syllable (like "ka", "ki", "ku"). Unlike English letters, each Hiragana character represents a complete sound. This makes it perfect for beginners because once you learn Hiragana, you can read and write any Japanese word phonetically.

**How to use Mnemonics:**
Each character below has a mnemonic - a memory aid that connects the character's shape to its sound. For example, "あ" (a) looks like a capital "A" with a loop. Visualize the mnemonic story as you look at each character. The more vivid you make the mental image, the easier it will be to remember!

In this batch, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else {
      theoryContent = `In this session, you'll learn ${batchKana.length} more Hiragana characters. Each character has a mnemonic to help you remember its shape and sound.

**About Mnemonics:**
The mnemonics below are visual stories that connect each character's shape to its sound. For example, if a character looks like something familiar, the mnemonic will help you remember that connection. Try to visualize each mnemonic as you study the characters - the more vivid your mental image, the better you'll remember!

**Remember:**
- Each character represents a syllable
- Use the mnemonics to remember the character shapes
- Practice writing and recognizing each character

Characters in this batch: ${batchKana.map(k => k.character).join(', ')}`
    }

    const hiraganaSession: CourseSession = {
      id: `hiragana-batch-${batchNumber}`,
      title: `Hiragana Batch ${batchNumber}`,
      description: `Learn ${batchKana.length} Hiragana characters: ${batchKana.map(k => k.character).join(', ')}`,
      batchNumber,
      theory: {
        title: batchNumber === 1 ? 'Introduction to Hiragana' : `Hiragana Characters: Batch ${batchNumber}`,
        content: theoryContent,
        kana: batchKana,
        wordExamples: wordExamples,
      },
      examples: batchKana,
      practice: practiceQuestions,
    }

    setSession(hiraganaSession)
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
    if ((!userInput.trim() && !convertedInput.trim()) || !session) return

    const currentQuestion = session.practice[currentPracticeIndex]
    // Use converted input if it's a romaji-to-character question, otherwise use regular input
    const userAnswer = currentQuestion.questionType === 'romaji-to-character' 
      ? (convertedInput.trim() || userInput.trim())
      : userInput.trim().toLowerCase()
    const correctAnswer = currentQuestion.correctAnswer
    
    // Check if answer is correct (case-insensitive for romaji)
    const isCorrect = currentQuestion.questionType === 'character-to-romaji'
      ? userAnswer.toLowerCase() === correctAnswer.toLowerCase()
      : userAnswer === correctAnswer

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
    setConvertedInput('')

    // Move to next question or complete session
    if (currentPracticeIndex < session.practice.length - 1) {
      setCurrentPracticeIndex(currentPracticeIndex + 1)
      setUserInput('')
      setConvertedInput('')
    } else {
      completeSession()
    }
  }

  // Handle input change with romaji-to-hiragana conversion
  const handleInputChange = (value: string) => {
    setUserInput(value)
    if (currentPracticeQuestion?.questionType === 'romaji-to-character') {
      const converted = convertRomajiToHiragana(value)
      setConvertedInput(converted)
    } else {
      setConvertedInput('')
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
        quiz_type: 'hiragana_session',
        vocabulary_items: session?.practice.map((q) => ({
          kana: q.kana.character,
          romaji: q.kana.romaji,
          questionType: q.questionType,
          userAnswer: q.userAnswer,
          isCorrect: q.isCorrect,
          batchNumber: session?.batchNumber,
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

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
                Characters in this batch:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {session.theory.kana.map((kana, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="text-center mb-2">
                      <span className="text-5xl font-bold text-black dark:text-zinc-50">
                        {kana.character}
                      </span>
                    </div>
                    <div className="text-center mb-2">
                      <span className="text-lg font-semibold text-zinc-600 dark:text-zinc-400">
                        {kana.romaji}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center italic">
                      {kana.mnemonic}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {session.theory.wordExamples && session.theory.wordExamples.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
                  Words using these characters:
                </h3>
                <div className="space-y-2">
                  {session.theory.wordExamples.map((word, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-black dark:text-zinc-50">
                          {word.japanese}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          ({word.hiragana})
                        </span>
                        <span className="text-zinc-700 dark:text-zinc-300">
                          - {word.english}
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
              Character Recognition & Word Examples
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Review the characters you just learned and see them used in real words:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {session.examples.map((kana, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center"
                >
                  <div className="text-6xl font-bold text-black dark:text-zinc-50 mb-2">
                    {kana.character}
                  </div>
                  <div className="text-lg font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    {kana.romaji}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                    {kana.mnemonic}
                  </div>
                </div>
              ))}
            </div>

            {session.theory.wordExamples && session.theory.wordExamples.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
                  Words using these characters:
                </h3>
                <div className="space-y-3">
                  {session.theory.wordExamples.map((word, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-2xl font-bold text-black dark:text-zinc-50">
                          {word.japanese}
                        </span>
                        <span className="text-lg text-zinc-600 dark:text-zinc-400">
                          ({word.hiragana})
                        </span>
                        <span className="text-zinc-700 dark:text-zinc-300">
                          - {word.english}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              <div className="mb-4 p-6 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
                {currentPracticeQuestion.questionType === 'character-to-romaji' ? (
                  <>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">What is the romaji for this character?</p>
                    <h2 className="text-7xl font-bold text-black dark:text-zinc-50 mb-2">
                      {currentPracticeQuestion.kana.character}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                      Hint: {currentPracticeQuestion.kana.mnemonic}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">What is the Hiragana character for this romaji?</p>
                    <h2 className="text-5xl font-bold text-black dark:text-zinc-50 mb-2">
                      {currentPracticeQuestion.kana.romaji}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                      Hint: {currentPracticeQuestion.kana.mnemonic}
                    </p>
                  </>
                )}
              </div>
              
              <div className="space-y-4">
                {currentPracticeQuestion.questionType === 'romaji-to-character' && convertedInput && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Converted to Hiragana:</p>
                    <p className="text-4xl font-bold text-blue-700 dark:text-blue-300">{convertedInput}</p>
                  </div>
                )}
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePracticeSubmit()
                    }
                  }}
                  placeholder={
                    currentPracticeQuestion.questionType === 'character-to-romaji'
                      ? 'Type the romaji (e.g., "ka", "ki", "ku")...'
                      : 'Type romaji (e.g., "a" for あ, "ka" for か)...'
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 text-black dark:text-white border-2 border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-center text-2xl"
                  autoFocus
                />
                {currentPracticeQuestion.questionType === 'romaji-to-character' && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                    💡 Tip: Type romaji (like "a", "ka") and it will convert to Hiragana automatically
                  </p>
                )}
                
                <button
                  onClick={handlePracticeSubmit}
                  disabled={!userInput.trim() && !convertedInput.trim()}
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
                          {q.questionType === 'character-to-romaji' ? (
                            <>
                              <p className="font-bold text-3xl text-black dark:text-zinc-50">
                                {q.kana.character}
                              </p>
                              <p className="text-zinc-600 dark:text-zinc-400">
                                = {q.kana.romaji}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-lg text-black dark:text-zinc-50">
                                {q.kana.romaji}
                              </p>
                              <p className="text-zinc-600 dark:text-zinc-400">
                                = {q.kana.character}
                              </p>
                            </>
                          )}
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

export default function CoursePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    }>
      <CoursePageContent />
    </Suspense>
  )
}

