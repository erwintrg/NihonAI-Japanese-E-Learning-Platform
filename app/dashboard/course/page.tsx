'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  getHiraganaByBatch, 
  getAllHiragana, 
  getTotalHiraganaBatches, 
  getHiraganaBatchName,
  getKanaByBatchAndType,
  getAllKanaByType,
  getTotalBatches,
  getBatchName,
  getNextCourseType,
  type KanaCharacter,
  type KanaType
} from '@/lib/kana'
import { getAllVocab, type VocabularyItem } from '@/lib/data'
import { 
  getVocabularySessionByBatch,
  getTotalVocabularySessions,
  getTopicName,
  type VocabularySession
} from '@/lib/vocabulary'
import { addVocabularyToSRS } from '@/lib/srs-helpers'
import { convertRomajiToHiragana } from '@/lib/romaji-to-hiragana'

type SessionSection = 'theory' | 'examples' | 'practice'

type KanaPracticeQuestion = {
  id: number
  kana: KanaCharacter
  questionType: 'character-to-romaji' | 'romaji-to-character'
  question: string
  correctAnswer: string
  userAnswer: string
  isCorrect: boolean | null
  options?: string[] // For multiple choice questions
}

type VocabularyPracticeQuestion = {
  id: number
  vocabulary: VocabularyItem
  questionType: 'japanese-to-english' | 'english-to-japanese'
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
  sessionType: 'kana' | 'vocabulary'
  theory: {
    title: string
    content: string
    kana?: KanaCharacter[]
    vocabulary?: VocabularyItem[]
    wordExamples?: VocabularyItem[]
  }
  examples: KanaCharacter[] | VocabularyItem[]
  practice: KanaPracticeQuestion[] | VocabularyPracticeQuestion[]
}

function CoursePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [currentSection, setCurrentSection] = useState<SessionSection>('theory')
  const [currentTheoryTab, setCurrentTheoryTab] = useState<string>('')
  const [theorySections, setTheorySections] = useState<Array<{ title: string; content: string }>>([])
  const [session, setSession] = useState<CourseSession | null>(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false)
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [completedBatches, setCompletedBatches] = useState<Set<number>>(new Set())
  const [batchesLoaded, setBatchesLoaded] = useState(false)
  const [kanaType, setKanaType] = useState<KanaType>('hiragana')

  useEffect(() => {
    setMounted(true)
    
    // Check authentication
    supabase.auth.getUser().then(async ({ data: { user }, error }) => {
      if (error || !user) {
        router.push('/auth')
      } else {
        setUser(user)
        
        // Get kana type from URL params, default to 'hiragana'
        const typeParam = searchParams?.get('type') as KanaType
        const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
        const currentType: KanaType = typeParam && validTypes.includes(typeParam)
          ? typeParam
          : 'hiragana'
        
        if (currentType !== kanaType) {
          setKanaType(currentType)
        }
        
        // Load completed batches - ensure we're filtering by the correct user_id and batch_type
        const { data: batches, error: batchesError } = await supabase
          .from('completed_batches')
          .select('batch_number')
          .eq('user_id', user.id)
          .eq('batch_type', currentType)
        
        if (batchesError) {
          console.error('Error loading completed batches on mount:', batchesError)
          setBatchesLoaded(true) // Still set to true to allow page to load
          return
        }
        
        if (batches) {
          const batchNumbers = batches.map(b => b.batch_number)
          console.log(`Loaded ${batchNumbers.length} completed batches for user ${user.id}:`, batchNumbers)
          setCompletedBatches(new Set(batchNumbers))
        } else {
          console.log(`No completed batches found for user ${user.id}`)
        }
        setBatchesLoaded(true)
      }
    })
  }, [router, supabase])



  // Generate theory content for vocabulary sessions
  const generateVocabularyTheoryContent = (vocabSession: VocabularySession): string => {
    const topicName = vocabSession.topic ? getTopicName(vocabSession.topic) : 'Vocabulary'
    let content = `# ${topicName}\n\n`
    
    content += `In this session, you'll learn ${vocabSession.vocabulary.length} essential vocabulary words${vocabSession.topic ? ` related to ${topicName.toLowerCase()}` : ''}.\n\n`
    
    vocabSession.vocabulary.forEach((vocab, index) => {
      content += `## ${index + 1}. ${vocab.japanese} (${vocab.hiragana})\n\n`
      content += `**Romaji:** ${vocab.romaji}\n\n`
      content += `**English:** ${vocab.english}\n\n`
      
      // Kanji exposure (if available)
      if (vocab.kanji_breakdown) {
        content += `**Kanji Breakdown:** ${vocab.kanji_breakdown}\n\n`
      }
      
      // Notes (if available)
      if (vocab.notes) {
        content += `**Notes:** ${vocab.notes}\n\n`
      }
      
      // Example sentences
      if (vocab.example_sentences && vocab.example_sentences.length > 0) {
        content += `**Example:**\n`
        vocab.example_sentences.slice(0, 2).forEach(example => {
          content += `- ${example.japanese} (${example.hiragana})\n`
          content += `  ${example.romaji}\n`
          content += `  "${example.english}"\n\n`
        })
      }
      
      content += `---\n\n`
    })
    
    return content
  }

  const loadSession = useCallback(async () => {
    if (!searchParams || !user) return
    
    // Don't reload if session is already completed (preserves review state)
    if (sessionCompleted) return
    
    // Don't load if batches aren't loaded yet (prevents race condition)
    if (!batchesLoaded) return
    
    // Get session type from URL params
    const typeParam = searchParams.get('type') || ''
    const validKanaTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
    const validVocabularyTypes = ['vocabulary_top100', 'vocabulary']
    
    // Determine if this is a vocabulary session or kana session
    const isVocabularySession = validVocabularyTypes.includes(typeParam)
    const currentType = isVocabularySession 
      ? typeParam 
      : (typeParam && validKanaTypes.includes(typeParam as KanaType) ? typeParam as KanaType : 'hiragana')
    
    // Always reload batches from Supabase to ensure we have the latest data
    // This prevents issues where local state is stale
    const { data: batches, error: batchesError } = await supabase
      .from('completed_batches')
      .select('batch_number')
      .eq('user_id', user.id)
      .eq('batch_type', currentType)
    
    if (batchesError) {
      console.error('Error loading completed batches in loadSession:', batchesError)
      return
    }
    
    // Update local state with fresh data from Supabase
    const batchNumbers = batches?.map(b => b.batch_number) || []
    const freshCompletedBatches = new Set(batchNumbers)
    console.log(`loadSession: Loaded ${batchNumbers.length} completed batches for user ${user.id}:`, batchNumbers)
    setCompletedBatches(freshCompletedBatches)
    
    // Get batch number from URL params, default to batch 1
    // Ignore timestamp parameter if present
    const batchParam = searchParams.get('batch')
    const batchNumber = batchParam ? parseInt(batchParam, 10) : 1
    
    // Validate batch number
    if (isNaN(batchNumber) || batchNumber < 1) {
      window.location.href = `/dashboard/course?batch=1&type=${currentType}&t=${Date.now()}`
      return
    }
    
    // Check if batch is unlocked (batch 1 is always unlocked, others require previous batch completion)
    // Only redirect if the batch is explicitly locked (user hasn't completed the previous batch)
    if (batchNumber > 1) {
      const previousBatchCompleted = freshCompletedBatches.has(batchNumber - 1)
      
      if (!previousBatchCompleted) {
        // User is trying to access a batch they haven't unlocked yet
        // Find the last completed batch and redirect to the next one they should work on
        const lastCompleted = Array.from(freshCompletedBatches).sort((a, b) => b - a)[0] || 0
        const nextBatch = lastCompleted + 1
        
        // Only redirect if the requested batch is beyond what they've unlocked
        if (batchNumber > nextBatch) {
          window.location.href = `/dashboard/course?batch=${nextBatch}&type=${currentType}&t=${Date.now()}`
          return
        }
        // If batchNumber === nextBatch, they're trying to access the next batch they should work on
        // This is allowed - they may have just completed the previous batch
      }
      // If previousBatchCompleted is true, the batch is unlocked, proceed normally
    }
    
    // Handle vocabulary sessions
    if (isVocabularySession) {
      const vocabSession = getVocabularySessionByBatch(batchNumber, currentType as 'vocabulary_top100' | 'vocabulary')
      
      if (!vocabSession) {
        // Check if we should transition to next type
        const totalBatches = getTotalVocabularySessions(currentType as 'vocabulary_top100' | 'vocabulary')
        if (batchNumber > totalBatches) {
          const nextType = getNextCourseType(currentType)
          if (nextType) {
            window.location.href = `/dashboard/course?batch=1&type=${nextType}&t=${Date.now()}`
            return
          }
        }
        window.location.href = `/dashboard?t=${Date.now()}`
        return
      }
      
      // Create vocabulary practice questions (typing only)
      const vocabPracticeQuestions: VocabularyPracticeQuestion[] = []
      
      vocabSession.vocabulary.forEach((vocab, index) => {
        // Question 1: Japanese to English (typing)
        vocabPracticeQuestions.push({
          id: index * 2 + 1,
          vocabulary: vocab,
          questionType: 'japanese-to-english',
          question: `What does "${vocab.japanese}" mean?`,
          correctAnswer: vocab.english.toLowerCase(),
          userAnswer: '',
          isCorrect: null,
        })
        
        // Question 2: English to Japanese (typing with romaji-to-hiragana converter)
        vocabPracticeQuestions.push({
          id: index * 2 + 2,
          vocabulary: vocab,
          questionType: 'english-to-japanese',
          question: `What is the Japanese word for "${vocab.english}"?`,
          correctAnswer: vocab.japanese,
          userAnswer: '',
          isCorrect: null,
        })
      })
      
      // Shuffle practice questions
      for (let shuffle = 0; shuffle < 10; shuffle++) {
        for (let i = vocabPracticeQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[vocabPracticeQuestions[i], vocabPracticeQuestions[j]] = [vocabPracticeQuestions[j], vocabPracticeQuestions[i]]
        }
      }
      
      // Create vocabulary session
      const topicName = vocabSession.topic ? getTopicName(vocabSession.topic) : 'Vocabulary'
      const theoryContent = generateVocabularyTheoryContent(vocabSession)
      
      const newSession: CourseSession = {
        id: vocabSession.id,
        title: vocabSession.topic 
          ? `${topicName}: Session ${batchNumber}`
          : `Vocabulary: Session ${batchNumber}`,
        description: `Learn ${vocabSession.vocabulary.length} vocabulary words${vocabSession.topic ? ` about ${topicName.toLowerCase()}` : ''}`,
        batchNumber: vocabSession.batchNumber,
        sessionType: 'vocabulary',
        theory: {
          title: topicName,
          content: theoryContent,
          vocabulary: vocabSession.vocabulary,
        },
        examples: vocabSession.vocabulary,
        practice: vocabPracticeQuestions,
      }
      
      setSession(newSession)
      setKanaType('hiragana') // Not used for vocabulary, but keep state consistent
      setCorrectAnswers(0) // Reset correct answers counter for new session
      setCurrentPracticeIndex(0) // Reset practice index
      setSessionStarted(false) // Reset session started state
      setSessionCompleted(false) // Reset session completed state
      return
    }
    
    // Handle kana sessions (existing logic)
    const batchKana = getKanaByBatchAndType(batchNumber, currentType as KanaType)
    
    // Special case sessions are theory-only (no kana characters)
    const isSpecialCase = currentType === 'hiragana_special' || currentType === 'katakana_special'
    
    if (batchKana.length === 0 && !isSpecialCase) {
      console.error(`No kana found for batch ${batchNumber} of type ${currentType}`)
      
      // If we're trying to load a batch that doesn't exist, check if we should transition to next type
      const totalBatches = getTotalBatches(currentType)
      if (batchNumber > totalBatches) {
        // Determine next course type in sequence (works for all current and future types)
        const nextType = getNextCourseType(currentType)
        
        if (nextType) {
          // Redirect to first batch of next type
          window.location.href = `/dashboard/course?batch=1&type=${nextType}&t=${Date.now()}`
          return
        }
      }
      
      // If no next type or other error, redirect to dashboard
      window.location.href = `/dashboard?t=${Date.now()}`
      return
    }

    // Create practice questions - each kana appears twice
    // For romaji-to-character, use multiple choice
    // Special case sessions have no practice questions (theory-only)
    const allKana = getAllKanaByType(currentType)
    const practiceQuestions: KanaPracticeQuestion[] = []
    
    if (!isSpecialCase) {
      batchKana.forEach((kana, index) => {
      // First question: character-to-romaji (typing)
      practiceQuestions.push({
        id: index * 4 + 1,
        kana,
        questionType: 'character-to-romaji' as const,
        question: `What is the romaji for this character?`,
        correctAnswer: kana.romaji.toLowerCase(),
        userAnswer: '',
        isCorrect: null,
      })
      
      // Second question: romaji-to-character (multiple choice)
      // Generate 3 wrong options from other kana
      const wrongOptions = allKana
        .filter(k => k.character !== kana.character)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(k => k.character)
      
      const allOptions = [kana.character, ...wrongOptions].sort(() => 0.5 - Math.random())
      
      practiceQuestions.push({
        id: index * 4 + 2,
        kana,
        questionType: 'romaji-to-character' as const,
        question: `What is the Hiragana character for "${kana.romaji}"?`,
        correctAnswer: kana.character,
        userAnswer: '',
        isCorrect: null,
        options: allOptions,
      })
      
      // Repeat each question type once more (total 2x per kana)
      practiceQuestions.push({
        id: index * 4 + 3,
        kana,
        questionType: 'character-to-romaji' as const,
        question: `What is the romaji for this character?`,
        correctAnswer: kana.romaji.toLowerCase(),
        userAnswer: '',
        isCorrect: null,
      })
      
      const wrongOptions2 = allKana
        .filter(k => k.character !== kana.character)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(k => k.character)
      
      const allOptions2 = [kana.character, ...wrongOptions2].sort(() => 0.5 - Math.random())
      
      practiceQuestions.push({
        id: index * 4 + 4,
        kana,
        questionType: 'romaji-to-character' as const,
        question: `What is the Hiragana character for "${kana.romaji}"?`,
        correctAnswer: kana.character,
        userAnswer: '',
        isCorrect: null,
        options: allOptions2,
      })
      })
    }

    // Randomize practice questions, but ensure no two identical questions appear consecutively
    // Only shuffle if there are practice questions (not for special case sessions)
    if (practiceQuestions.length > 0) {
      // Shuffle multiple times to ensure good distribution
      for (let shuffle = 0; shuffle < 10; shuffle++) {
        for (let i = practiceQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [practiceQuestions[i], practiceQuestions[j]] = [practiceQuestions[j], practiceQuestions[i]]
        }
      }
      
      // Ensure no consecutive duplicates
      for (let i = 1; i < practiceQuestions.length; i++) {
        const prev = practiceQuestions[i - 1]
        const current = practiceQuestions[i]
        
        // If same kana and same question type, swap with a different question
        if (prev.kana.character === current.kana.character && prev.questionType === current.questionType) {
          // Find a different question to swap with
          for (let j = i + 1; j < practiceQuestions.length; j++) {
            const candidate = practiceQuestions[j]
            if (candidate.kana.character !== current.kana.character || candidate.questionType !== current.questionType) {
              [practiceQuestions[i], practiceQuestions[j]] = [practiceQuestions[j], practiceQuestions[i]]
              break
            }
          }
        }
      }
    }

    // Get word examples using the kana being learned (skip for special case sessions)
    const allVocab = getAllVocab()
    const kanaCharacters = batchKana.map(k => k.character)
    const wordExamples = isSpecialCase ? [] : allVocab
      .filter(vocab => {
        // Check if the word contains any of the kana being learned
        return kanaCharacters.some(kana => vocab.hiragana.includes(kana))
      })
      .slice(0, 5) // Limit to 5 examples

    // Get batch name once for use in theory content and session title
    const batchName = getBatchName(batchNumber, currentType)
    
    // Enhanced theory content
    let theoryContent = ''
    if (currentType === 'hiragana' && batchNumber === 1) {
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

In this session, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else if (currentType === 'hiragana_dakuten' && batchNumber === 1) {
      theoryContent = `**Dakuten (゛) - Voiced Sounds**

Dakuten (also called "ten-ten") are two small marks (゛) added to certain Hiragana characters to create voiced sounds. When you add dakuten, the sound becomes "voiced":

- K-row (か, き, く, け, こ) → G-row (が, ぎ, ぐ, げ, ご)
- S-row (さ, し, す, せ, そ) → Z-row (ざ, じ, ず, ぜ, ぞ)
- T-row (た, ち, つ, て, と) → D-row (だ, ぢ, づ, で, ど)
- H-row (は, ひ, ふ, へ, ほ) → B-row (ば, び, ぶ, べ, ぼ)

**Pronunciation Note:**
Dakuten creates a "voiced" sound by adding vibration to the vocal cords. The key difference is that voiced sounds use your vocal cords, while unvoiced sounds don't. For example:
- "そ" (so) is unvoiced, like the "s" in "sun" - no vocal cord vibration
- "ぞ" (zo) is voiced, like the "z" in "zoo" - vocal cords vibrate
- "た" (ta) is unvoiced, like the "t" in "top" - no vocal cord vibration
- "だ" (da) is voiced, like the "d" in "dog" - vocal cords vibrate

The difference is subtle but important. Practice saying pairs like "so/zo" and "ta/da" to feel the vibration in your throat when producing the voiced sounds!

**How to remember:**
Think of dakuten as "activating" the character - the two dots make the sound voiced by adding vocal cord vibration. Visualize the base character you already know, then add the two dots on top!

In this session, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else if (currentType === 'hiragana_handakuten' && batchNumber === 1) {
      theoryContent = `**Handakuten (゜) - Semi-Voiced Sounds**

Handakuten (also called "maru") is a small circle (゜) added to H-row characters to create P-sounds. Unlike dakuten which uses two dots, handakuten uses a circle:

- H-row (は, ひ, ふ, へ, ほ) → P-row (ぱ, ぴ, ぷ, ぺ, ぽ)

**Pronunciation Note:**
Handakuten creates a "p" sound that is aspirated (with a puff of air) compared to the base H-row sounds. Notice the difference:
- "は" (ha) is a soft "h" sound (unvoiced fricative)
- "ぱ" (pa) is an aspirated "p" sound (unvoiced plosive with a puff of air), like the "p" in "pop"

The handakuten mark transforms the H-row into clear P-sounds, making them distinct from both the original H-row (h sounds) and the B-row (b sounds from dakuten).

**How to remember:**
Think of the circle as a "puff" of air - the handakuten mark creates a "p" sound. Visualize the base H-row character you already know, then add the small circle on top!

In this session, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else if (currentType === 'hiragana_combo' && batchNumber === 1) {
      theoryContent = `**Kana Combinations (Yōon) - Contracted Sounds**

Kana combinations are created by combining certain base characters with small versions of や (ya), ゆ (yu), or よ (yo). The small kana (ゃ, ゅ, ょ) combine with the base character to create a new sound:

- き (ki) + ゃ (small ya) = きゃ (kya)
- き (ki) + ゅ (small yu) = きゅ (kyu)
- き (ki) + ょ (small yo) = きょ (kyo)

**How to remember:**
Think of the small kana as "attaching" to the base character. The base character provides the consonant, and the small kana provides the vowel sound. Visualize the base character you already know, then add the small version of や, ゆ, or よ!

In this session, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else if (currentType === 'katakana' && batchNumber === 1) {
      theoryContent = `**What is Katakana?**
Katakana consists of 46 basic characters, each representing the same syllables as Hiragana (like "ka", "ki", "ku"). While Hiragana is used for native Japanese words and grammar, Katakana is primarily used for:
- Foreign words and loanwords (e.g., コーヒー "koohii" = coffee)
- Onomatopoeia (sound words)
- Emphasis (similar to italics in English)
- Scientific names and technical terms

**How to use Mnemonics:**
Each character below has a mnemonic - a memory aid that connects the character's shape to its sound. Katakana characters are more angular and sharp compared to Hiragana's curved shapes. Visualize the mnemonic story as you look at each character. The more vivid you make the mental image, the easier it will be to remember!

In this session, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else if (currentType === 'katakana_dakuten' && batchNumber === 1) {
      theoryContent = `**Dakuten (゛) - Voiced Sounds (Katakana)**

Dakuten (also called "ten-ten") are two small marks (゛) added to certain Katakana characters to create voiced sounds, just like in Hiragana. When you add dakuten, the sound becomes "voiced":

- K-row (カ, キ, ク, ケ, コ) → G-row (ガ, ギ, グ, ゲ, ゴ)
- S-row (サ, シ, ス, セ, ソ) → Z-row (ザ, ジ, ズ, ゼ, ゾ)
- T-row (タ, チ, ツ, テ, ト) → D-row (ダ, ヂ, ヅ, デ, ド)
- H-row (ハ, ヒ, フ, ヘ, ホ) → B-row (バ, ビ, ブ, ベ, ボ)

**Pronunciation Note:**
Dakuten creates a "voiced" sound by adding vibration to the vocal cords. The key difference is that voiced sounds use your vocal cords, while unvoiced sounds don't. For example:
- "ソ" (so) is unvoiced, like the "s" in "sun" - no vocal cord vibration
- "ゾ" (zo) is voiced, like the "z" in "zoo" - vocal cords vibrate
- "タ" (ta) is unvoiced, like the "t" in "top" - no vocal cord vibration
- "ダ" (da) is voiced, like the "d" in "dog" - vocal cords vibrate

The difference is subtle but important. Practice saying pairs like "so/zo" and "ta/da" to feel the vibration in your throat when producing the voiced sounds!

**How to remember:**
Think of dakuten as "activating" the character - the two dots make the sound voiced by adding vocal cord vibration. Visualize the base Katakana character you already know, then add the two dots on top!

In this session, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else if (currentType === 'katakana_handakuten' && batchNumber === 1) {
      theoryContent = `**Handakuten (゜) - Semi-Voiced Sounds (Katakana)**

Handakuten (also called "maru") is a small circle (゜) added to H-row Katakana characters to create P-sounds. Unlike dakuten which uses two dots, handakuten uses a circle:

- H-row (ハ, ヒ, フ, ヘ, ホ) → P-row (パ, ピ, プ, ペ, ポ)

**Pronunciation Note:**
Handakuten creates a "p" sound that is aspirated (with a puff of air) compared to the base H-row sounds. Notice the difference:
- "ハ" (ha) is a soft "h" sound (unvoiced fricative)
- "パ" (pa) is an aspirated "p" sound (unvoiced plosive with a puff of air), like the "p" in "pop"

The handakuten mark transforms the H-row into clear P-sounds, making them distinct from both the original H-row (h sounds) and the B-row (b sounds from dakuten).

**How to remember:**
Think of the circle as a "puff" of air - the handakuten mark creates a "p" sound. Visualize the base H-row Katakana character you already know, then add the small circle on top!

In this session, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else if (currentType === 'katakana_combo' && batchNumber === 1) {
      theoryContent = `**Kana Combinations (Yōon) - Contracted Sounds (Katakana)**

Katakana combinations are created by combining certain base characters with small versions of ヤ (ya), ユ (yu), or ヨ (yo). The small kana (ャ, ュ, ョ) combine with the base character to create a new sound:

- キ (ki) + ャ (small ya) = キャ (kya)
- キ (ki) + ュ (small yu) = キュ (kyu)
- キ (ki) + ョ (small yo) = キョ (kyo)

**How to remember:**
Think of the small kana as "attaching" to the base character. The base character provides the consonant, and the small kana provides the vowel sound. Visualize the base Katakana character you already know, then add the small version of ヤ, ユ, or ヨ!

In this session, you'll learn ${batchKana.length} characters: ${batchKana.map(k => k.character).join(', ')}`
    } else if (currentType === 'hiragana_special' && batchNumber === 1) {
      theoryContent = `**1. Double Consonants (Small っ or Regular ん)**

Double consonants create a pause or emphasis in pronunciation. They are essential for distinguishing between words and creating natural-sounding Japanese.

**Small っ (tsu):**
The small っ (tsu) creates a double consonant sound. The consonant that follows is held for a moment, creating a brief pause. The small っ is written half the size of regular characters and appears before the consonant that is doubled.

- Example: がっこう (gakkou) = "school" - the "k" sound is doubled
- Example: きっぷ (kippu) = "ticket" - the "p" sound is doubled

**Regular ん (n):**
The regular ん (n) can also create a double consonant effect when followed by certain consonants, adding emphasis to the sound.

- Example: ほんとう (hontou) = "really" - the "n" sound is emphasized

**2. Long Vowels & Dropped Vowels**

**Long Vowels:**
Long vowels extend the sound of a vowel, making it twice as long. This is crucial for distinguishing words in Japanese.

Long "aa" sound is written as ああ or あー (in some cases):
- Example: おばあさん (obaasan) = "grandmother" (long "aa")
- vs. おばさん (obasan) = "aunt" (short "a")

Long "ee" sound is often written as えい (ei) instead of ええ:
- Example: せんせい (sensei) = "teacher" - the "ei" is pronounced as a long "ee"
- Example: えいご (eigo) = "English" - long "ee" sound

Long "ii" sound is written as いい:
- Example: いいえ (iie) = "no"

Long "oo" sound is written as おお or おう:
- Example: おおきい (ookii) = "big"
- Example: おとうさん (otousan) = "father" - the "ou" is pronounced as long "oo"

Long "uu" sound is written as うう:
- Example: すうがく (suugaku) = "mathematics"

**Dropped Vowels (i and u):**
In Japanese, the vowels "i" (い) and "u" (う) are often dropped or barely pronounced, especially when they appear between unvoiced consonants. This is a natural part of Japanese pronunciation - don't try to force every vowel to be clearly pronounced!

- Example: すきです (sukidesu) = "I like it"
  - The "u" in "su" and "i" in "desu" are often barely audible
  - It sounds more like "skides" than "sukidesu"
  
- Example: ききます (kikimasu) = "I listen"
  - The "i" in "ki" and "u" in "masu" are often dropped
  - It sounds more like "kkimas" than "kikimasu"

**3. Special Pronunciation of ん (n)**

The character ん (n) has special pronunciation rules that change based on what sound follows it. Understanding these variations is essential for natural pronunciation.

Before "m", "b", or "p" sounds, ん is pronounced like "m":
- Example: しんぶん (shinbun) = "newspaper" - the ん sounds like "m"

Before "k" or "g" sounds, ん is pronounced like "ng" (as in "sing"):
- Example: ほんご (honggo) = "Japanese language" - the ん sounds like "ng"

Before "t", "d", "n", "r" sounds, ん is pronounced like "n":
- Example: ほんとう (hontou) = "really" - the ん sounds like "n"

At the end of words, ん is often nasalized (pronounced through the nose):
- Example: にほん (nihon) = "Japan" - the final ん is nasalized

`
    } else if (currentType === 'katakana_special' && batchNumber === 1) {
      theoryContent = `**1. Long Vowels (Long Dash ー) & Dropped Vowels**

**Long Vowels:**
In Katakana, long vowels are written with a long dash (ー), unlike Hiragana:
- Example: コーヒー (koohii) = "coffee" - the ー extends the "o" and "i" sounds
- Example: ケーキ (keeki) = "cake" - the ー extends the "e" sound
- Example: テーブル (teeburu) = "table" - the ー extends the "e" sound

**Important:** The long dash (ー) is always written horizontally, regardless of the direction of the text.

**Dropped Vowels:**
Just like in Hiragana, the vowels "i" (イ) and "u" (ウ) are often dropped or barely pronounced:
- Example: デスク (desuku) = "desk" - the "u" is often barely audible

**2. Double Consonants (Small ッ or Regular ン)**

Same as Hiragana:
- Small ッ (tsu): Creates a double consonant sound
  - Example: カップ (kappu) = "cup" - the "p" sound is doubled
  - Example: ベッド (beddo) = "bed" - the "d" sound is doubled

- Regular ン (n): Can create emphasis when followed by consonants
  - Example: コンピューター (konpyuutaa) = "computer"

**3. Additional Foreign Sound Combinations**

Katakana uses special combinations with small vowel letters to transcribe foreign sounds that don't exist in standard Japanese:

**Wa-row combinations:**
- ウィ (wi) = WA + small I - Example: ウィンドウ (windou) = "window"
- ウェ (we) = WA + small E - Example: ウェブ (webu) = "web"
- ウォ (wo) = WA + small O - Example: ウォーター (wootaa) = "water"

**Shi/Ji-row combinations:**
- シェ (she) = SHI + small E - Example: シェア (shea) = "share"
- ジェ (je) = JI + small E - Example: ジェット (jetto) = "jet"

**Chi-row combinations:**
- チェ (che) = CHI + small E - Example: チェック (chekku) = "check"

**Fu-row combinations:**
- ファ (fa) = FU + small A - Example: ファン (fan) = "fan"
- フィ (fi) = FU + small I - Example: フィルム (firumu) = "film"
- フェ (fe) = FU + small E - Example: フェスティバル (fesutibaru) = "festival"
- フォ (fo) = FU + small O - Example: フォーク (fooku) = "fork"

**Te/De-row combinations:**
- ティ (ti) = TE + small I - Example: パーティー (paatii) = "party"
- ディ (di) = DE + small I - Example: ディスク (disuku) = "disk"
- ディュ (dyu) = DI + small YU - Example: デュエット (dyuetto) = "duet"

**4. Special Pronunciation: "V" Sound**

The "v" sound doesn't exist in Japanese, so it's often transcribed using:
- ビ (bi) or ビィ (bii) - Example: ビデオ (bideo) = "video"
- Sometimes written as ヴ (vu) in modern Japanese, but ビ is more common

`
    } else {
      // Check if this is a noteworthy batch (e.g., special patterns or pronunciation notes)
      let batchNote = ''
      if (currentType === 'hiragana' && batchNumber === 2) {
        batchNote = `\n\n**Note:** This is the K-row (か行). Notice how each character starts with "k" followed by the five vowels (a, i, u, e, o). This pattern continues for other consonant rows.`
      } else if (currentType === 'hiragana' && batchNumber === 3) {
        batchNote = `\n\n**Note:** This is the S-row (さ行). Pay attention to "shi" (し) - it's the only character in this row that doesn't follow the "s + vowel" pattern. Instead of "si", Japanese uses "shi" because the "si" sound doesn't exist naturally in Japanese.`
      } else if (currentType === 'hiragana' && batchNumber === 4) {
        batchNote = `\n\n**Note:** This is the T-row (た行). Notice "chi" (ち) and "tsu" (つ) - they don't follow the standard "t + vowel" pattern. Instead of "ti" and "tu", Japanese uses "chi" and "tsu" because these sounds are more natural in Japanese pronunciation.`
      } else if (currentType === 'hiragana' && batchNumber === 6) {
        batchNote = `\n\n**Pronunciation Notes:** 
- "ふ" (fu): This character is pronounced more like "fu" than "hu". The sound is made by blowing air through slightly pursed lips, similar to blowing out a candle.
- "は" (ha): When used as a grammatical particle (topic marker), "は" is pronounced as "wa" even though it's written with the "ha" character. For example, in "こんにちは" (konnichiwa - hello), the last character is written as "は" but pronounced "wa". This is a common grammatical exception you'll encounter frequently.`
      } else if (currentType === 'hiragana' && batchNumber === 8) {
        batchNote = `\n\n**Note:** The Y-row (や行) only has three characters: や (ya), ゆ (yu), and よ (yo). The sounds "yi" and "ye" don't exist in Japanese, so they're skipped.`
      } else if (currentType === 'hiragana' && batchNumber === 9) {
        batchNote = `\n\n**Pronunciation Note:** The Japanese "R" sound (ら, り, る, れ, ろ) is unique! It's not like the English "R" in "Russia" or "red". Instead, it's a sound between "R" and "L" - like a light tap of the tongue against the roof of your mouth. Try saying "ら" (ra) by quickly tapping your tongue up, almost like a very soft "la" sound. This R-row sound is one of the most distinctive features of Japanese pronunciation.`
      } else if (currentType === 'hiragana' && batchNumber === 10) {
        batchNote = `\n\n**Special Characters:**
- "ん" (n): This is the only standalone consonant in Hiragana (besides the vowels). It's pronounced as a nasal sound, like the "n" in "sing" or "m" in "camp" depending on what comes after it. It can appear anywhere in a word and changes its pronunciation slightly based on context.
- "を" (wo): This character is almost always pronounced as "o" (like the vowel), not "wo". It's primarily used as a grammatical particle (object marker) and is rarely used in modern Japanese words.
- "は" (ha) as "wa": Remember that "は" is pronounced "wa" when used as the topic particle, even though it's written with the "ha" character.`
      } else if (currentType === 'hiragana_dakuten' && batchNumber === 2) {
        batchNote = `\n\n**Important Exception:** Notice that "じ" (ji) comes from "し" (shi), not "さ" (sa). This is because "shi" (し) doesn't follow the standard "s + vowel" pattern, so when adding dakuten, it becomes "ji" (じ) instead of "zhi". This is one of the most common dakuten characters you'll encounter!`
      } else if (currentType === 'hiragana_dakuten' && batchNumber === 3) {
        batchNote = `\n\n**Special Notes:**
- "だ" (da), "で" (de), "ど" (do): These follow the standard pattern from "た" (ta), "て" (te), "と" (to).
- "ぢ" (ji) and "づ" (zu): These come from "ち" (chi) and "つ" (tsu) respectively. However, in modern Japanese, "ぢ" and "づ" are rarely used - they're usually replaced by "じ" (ji) and "ず" (zu) from the S-row dakuten. You'll mostly see "じ" and "ず" in practice, but it's good to know "ぢ" and "づ" exist!`
      } else if (currentType === 'katakana' && batchNumber === 2) {
        batchNote = `\n\n**Note:** This is the K-row (カ行). Notice how each character starts with "k" followed by the five vowels (a, i, u, e, o). This pattern continues for other consonant rows.`
      } else if (currentType === 'katakana' && batchNumber === 3) {
        batchNote = `\n\n**Note:** This is the S-row (サ行). Pay attention to "shi" (シ) - it's the only character in this row that doesn't follow the "s + vowel" pattern. Instead of "si", Japanese uses "shi" because the "si" sound doesn't exist naturally in Japanese.`
      } else if (currentType === 'katakana' && batchNumber === 4) {
        batchNote = `\n\n**Note:** This is the T-row (タ行). Notice "chi" (チ) and "tsu" (ツ) - they don't follow the standard "t + vowel" pattern. Instead of "ti" and "tu", Japanese uses "chi" and "tsu" because these sounds are more natural in Japanese pronunciation.`
      } else if (currentType === 'katakana' && batchNumber === 6) {
        batchNote = `\n\n**Pronunciation Notes:** 
- "フ" (fu): This character is pronounced more like "fu" than "hu". The sound is made by blowing air through slightly pursed lips, similar to blowing out a candle.
- "ハ" (ha): When used as a grammatical particle (topic marker), "ハ" is pronounced as "wa" even though it's written with the "ha" character.`
      } else if (currentType === 'katakana' && batchNumber === 8) {
        batchNote = `\n\n**Note:** The Y-row (ヤ行) only has three characters: ヤ (ya), ユ (yu), and ヨ (yo). The sounds "yi" and "ye" don't exist in Japanese, so they're skipped.`
      } else if (currentType === 'katakana' && batchNumber === 9) {
        batchNote = `\n\n**Pronunciation Note:** The Japanese "R" sound (ラ, リ, ル, レ, ロ) is unique! It's not like the English "R" in "Russia" or "red". Instead, it's a sound between "R" and "L" - like a light tap of the tongue against the roof of your mouth. Try saying "ラ" (ra) by quickly tapping your tongue up, almost like a very soft "la" sound. This R-row sound is one of the most distinctive features of Japanese pronunciation.`
      } else if (currentType === 'katakana' && batchNumber === 10) {
        batchNote = `\n\n**Special Characters:**
- "ン" (n): This is the only standalone consonant in Katakana (besides the vowels). It's pronounced as a nasal sound, like the "n" in "sing" or "m" in "camp" depending on what comes after it. It can appear anywhere in a word and changes its pronunciation slightly based on context.
- "ヲ" (wo): This character is almost always pronounced as "o" (like the vowel), not "wo". It's primarily used as a grammatical particle (object marker) and is rarely used in modern Japanese words.`
      } else if (currentType === 'katakana_dakuten' && batchNumber === 2) {
        batchNote = `\n\n**Important Exception:** Notice that "ジ" (ji) comes from "シ" (shi), not "サ" (sa). This is because "shi" (シ) doesn't follow the standard "s + vowel" pattern, so when adding dakuten, it becomes "ji" (ジ) instead of "zhi". This is one of the most common dakuten characters you'll encounter!`
      } else if (currentType === 'katakana_dakuten' && batchNumber === 3) {
        batchNote = `\n\n**Special Notes:**
- "ダ" (da), "デ" (de), "ド" (do): These follow the standard pattern from "タ" (ta), "テ" (te), "ト" (to).
- "ヂ" (ji) and "ヅ" (zu): These come from "チ" (chi) and "ツ" (tsu) respectively. However, in modern Japanese, "ヂ" and "ヅ" are rarely used - they're usually replaced by "ジ" (ji) and "ズ" (zu) from the S-row dakuten. You'll mostly see "ジ" and "ズ" in practice, but it's good to know "ヂ" and "ヅ" exist!`
      }
      
      const typeLabel = currentType === 'hiragana' ? 'Hiragana' 
        : currentType === 'hiragana_dakuten' ? 'Hiragana Dakuten'
        : currentType === 'hiragana_handakuten' ? 'Hiragana Handakuten'
        : currentType === 'hiragana_combo' ? 'Hiragana Combos'
        : currentType === 'hiragana_special' ? 'Hiragana Special Cases'
        : currentType === 'katakana' ? 'Katakana'
        : currentType === 'katakana_dakuten' ? 'Katakana Dakuten'
        : currentType === 'katakana_handakuten' ? 'Katakana Handakuten'
        : currentType === 'katakana_combo' ? 'Katakana Combos'
        : 'Katakana Special Cases'
      
      theoryContent = `**${typeLabel} Ordering:**
Characters are organized in batches to help you learn systematically. This session covers the ${batchName}.${batchNote}

**About Mnemonics:**
Each character has a mnemonic - a visual story connecting its shape to its sound. Visualize each mnemonic as you study: the more vivid your mental image, the better you'll remember!

Characters in this session: ${batchKana.map(k => k.character).join(', ')}`
    }
    
    const typeLabel = currentType === 'hiragana' ? 'Hiragana' 
      : currentType === 'hiragana_dakuten' ? 'Hiragana Dakuten'
      : currentType === 'hiragana_handakuten' ? 'Hiragana Handakuten'
      : currentType === 'hiragana_combo' ? 'Hiragana Combos'
      : currentType === 'hiragana_special' ? 'Hiragana Special Cases'
      : currentType === 'katakana' ? 'Katakana'
      : currentType === 'katakana_dakuten' ? 'Katakana Dakuten'
      : currentType === 'katakana_handakuten' ? 'Katakana Handakuten'
      : currentType === 'katakana_combo' ? 'Katakana Combos'
      : 'Katakana Special Cases'
    
    const sessionTitle = batchNumber === 1 && currentType === 'hiragana' 
      ? 'Introduction to Hiragana'
      : batchNumber === 1 && currentType === 'hiragana_dakuten'
      ? 'Introduction to Dakuten'
      : batchNumber === 1 && currentType === 'hiragana_handakuten'
      ? 'Introduction to Handakuten'
      : batchNumber === 1 && currentType === 'hiragana_combo'
      ? 'Introduction to Kana Combinations'
      : batchNumber === 1 && currentType === 'hiragana_special'
      ? 'Hiragana Special Cases'
      : batchNumber === 1 && currentType === 'katakana'
      ? 'Introduction to Katakana'
      : batchNumber === 1 && currentType === 'katakana_dakuten'
      ? 'Introduction to Katakana Dakuten'
      : batchNumber === 1 && currentType === 'katakana_handakuten'
      ? 'Introduction to Katakana Handakuten'
      : batchNumber === 1 && currentType === 'katakana_combo'
      ? 'Introduction to Katakana Combinations'
      : batchNumber === 1 && currentType === 'katakana_special'
      ? 'Katakana Special Cases'
      : `${typeLabel} Characters: ${batchName}`
    
    const hiraganaSession: CourseSession = {
      id: `${currentType}-batch-${batchNumber}`,
      title: isSpecialCase 
        ? typeLabel  // For special cases, just use the type label (e.g., "Hiragana Special Cases")
        : `${typeLabel}: ${batchName}`,
      description: isSpecialCase 
        ? `Learn about ${typeLabel} pronunciation rules`
        : `Learn ${batchKana.length} ${typeLabel} characters: ${batchKana.map(k => k.character).join(', ')}`,
      batchNumber,
      theory: {
        title: sessionTitle,
        content: theoryContent,
        kana: batchKana,
        wordExamples: wordExamples,
      },
      examples: batchKana,
      practice: practiceQuestions,
    }

    const kanaSession: CourseSession = {
      ...hiraganaSession,
      sessionType: 'kana',
    }
    setSession(kanaSession)
    setCorrectAnswers(0) // Reset correct answers counter for new session
    setCurrentPracticeIndex(0) // Reset practice index
    setSessionStarted(false) // Reset session started state
    setSessionCompleted(false) // Reset session completed state
    
    // Parse theory content into sections for tabbed display
    // ONLY for theory-only sessions (no practice questions)
    // For practice sessions, always show raw theory content
    if (theoryContent && practiceQuestions.length === 0) {
      const sections: Array<{ title: string; content: string }> = []
      // Split by numbered headings like "**1. Title**" or "**Title**"
      const sectionPattern = /\*\*(\d+\.\s*)?([^*]+)\*\*/g
      const lines = theoryContent.split('\n')
      let currentSection: { title: string; content: string } | null = null
      let currentContent: string[] = []
      
      for (const line of lines) {
        const match = line.match(/^\*\*(\d+\.\s*)?([^*]+)\*\*/)
        if (match) {
          const hasNumber = match[1] !== undefined // Check if it starts with a number like "1."
          if (hasNumber) {
            // This is a main section (numbered) - save previous section and start new one
            if (currentSection) {
              currentSection.content = currentContent.join('\n').trim()
              sections.push(currentSection)
            }
            // Start new section - remove trailing colon from title
            const title = match[2].trim().replace(/:$/, '')
            currentSection = { title, content: '' }
            currentContent = []
          } else {
            // This is a subsection (no number) - include it in current section's content
            if (currentSection) {
              currentContent.push(line)
            } else {
              // No main section yet, treat as content before first section
              currentContent.push(line)
            }
          }
        } else if (currentSection) {
          currentContent.push(line)
        } else {
          // Content before first section
          if (currentContent.length === 0 && line.trim()) {
            currentContent.push(line)
          }
        }
      }
      
      // Save last section
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim()
        sections.push(currentSection)
      }
      
      // Filter out intro sections, empty sections, and "Key Takeaway" sections
      const filteredSections = sections.filter(section => {
        // Remove "Key Takeaway" sections (they contain no actual learning content)
        if (section.title.toLowerCase().includes('key takeaway')) {
          return false
        }
        // Remove sections with empty or whitespace-only content
        const trimmedContent = section.content.trim()
        if (!trimmedContent || trimmedContent.length === 0) {
          return false
        }
        // Skip sections that are just intro sentences (less than 100 chars and no examples)
        const contentLength = trimmedContent.length
        const hasExamples = trimmedContent.includes('Example:') || trimmedContent.includes('example') || trimmedContent.includes('=')
        // Filter out very short sections without examples
        return contentLength > 50 && (contentLength > 100 || hasExamples)
      })
      
      // If no sections found after filtering, treat entire content as one section
      if (filteredSections.length === 0) {
        const typeLabel = currentType === 'hiragana' ? 'Hiragana' 
          : currentType === 'hiragana_dakuten' ? 'Hiragana Dakuten'
          : currentType === 'hiragana_handakuten' ? 'Hiragana Handakuten'
          : currentType === 'hiragana_combo' ? 'Hiragana Combos'
          : currentType === 'hiragana_special' ? 'Hiragana Special Cases'
          : currentType === 'katakana' ? 'Katakana'
          : currentType === 'katakana_dakuten' ? 'Katakana Dakuten'
          : currentType === 'katakana_handakuten' ? 'Katakana Handakuten'
          : currentType === 'katakana_combo' ? 'Katakana Combos'
          : 'Katakana Special Cases'
        filteredSections.push({ title: typeLabel, content: theoryContent })
      }
      
      setTheorySections(filteredSections)
      if (filteredSections.length > 0) {
        setCurrentTheoryTab(filteredSections[0].title)
      }
    } else {
      // For practice sessions, don't parse into sections - show raw content
      setTheorySections([])
      setCurrentTheoryTab('')
    }
  }, [searchParams, user, router, sessionCompleted, batchesLoaded, supabase, kanaType])

  // Load session when completed batches are loaded and search params change
  // Don't reload if session is completed (to preserve review state)
  // Wait for batches to be loaded before checking unlock status
  useEffect(() => {
    if (mounted && user && searchParams && batchesLoaded && !sessionCompleted) {
      // Update kana type from URL params
      const typeParam = searchParams.get('type') as KanaType
      const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo']
      if (typeParam && validTypes.includes(typeParam)) {
        setKanaType(typeParam)
      }
      
      loadSession().catch(error => {
        console.error('Error loading session:', error)
      })
    }
  }, [mounted, user, searchParams, loadSession, sessionCompleted, batchesLoaded])

  const startSession = () => {
    setSessionStarted(true)
    setCurrentSection('theory')
  }

  const nextSection = () => {
    const isSpecialCase = session?.id.includes('_special')
    const hasPractice = session?.practice && session.practice.length > 0
    
    if (currentSection === 'theory') {
      if (isSpecialCase || !hasPractice) {
        // Special case sessions or sessions without practice: complete after theory
        completeSession()
      } else {
        setCurrentSection('examples')
      }
    } else if (currentSection === 'examples') {
      if (hasPractice) {
        setCurrentSection('practice')
      } else {
        // No practice questions: complete after examples
        completeSession()
      }
    }
  }

  const handlePracticeSubmit = () => {
    if (!session) return
    
    const currentQuestion = session.practice[currentPracticeIndex]
    let userAnswer = ''
    let isCorrect = false
    
    // Handle kana questions
    if ('kana' in currentQuestion) {
      if (currentQuestion.questionType === 'character-to-romaji') {
        // Typing question - use user input
        if (!userInput.trim()) return
        userAnswer = userInput.trim().toLowerCase()
        isCorrect = userAnswer === currentQuestion.correctAnswer.toLowerCase()
      } else {
        // Multiple choice question - use selected option
        if (!selectedOption) return
        userAnswer = selectedOption
        isCorrect = userAnswer === currentQuestion.correctAnswer
      }
    } 
    // Handle vocabulary questions
    else if ('vocabulary' in currentQuestion) {
      if (currentQuestion.questionType === 'japanese-to-english') {
        // Typing question - use user input
        if (!userInput.trim()) return
        userAnswer = userInput.trim().toLowerCase()
        isCorrect = userAnswer === currentQuestion.correctAnswer.toLowerCase()
      } else if (currentQuestion.questionType === 'english-to-japanese') {
        // Typing question with romaji-to-hiragana conversion
        if (!userInput.trim()) return
        // Convert romaji input to hiragana
        const convertedHiragana = convertRomajiToHiragana(userInput.trim())
        userAnswer = convertedHiragana
        // Check if the converted hiragana matches the correct answer (Japanese)
        // Also check if it matches the vocabulary's hiragana field if available
        const correctAnswer = currentQuestion.vocabulary.japanese
        const vocabHiragana = currentQuestion.vocabulary.hiragana
        isCorrect = convertedHiragana === correctAnswer || (vocabHiragana && convertedHiragana === vocabHiragana)
      }
    }

    // Update question with user answer
    const updatedPractice = [...session.practice]
    updatedPractice[currentPracticeIndex] = {
      ...currentQuestion,
      userAnswer,
      isCorrect,
    }

    setSession({ ...session, practice: updatedPractice })

    // Update correct answers count
    if (isCorrect) {
      setCorrectAnswers(correctAnswers + 1)
    }

    // Show visual feedback
    setAnswerFeedback(isCorrect ? 'correct' : 'incorrect')

    // Clear input and selection and move to next question
    setTimeout(() => {
      setAnswerFeedback(null)
      setUserInput('')
      setSelectedOption(null)
      
      if (currentPracticeIndex < session.practice.length - 1) {
        setCurrentPracticeIndex(currentPracticeIndex + 1)
      } else {
        completeSession()
      }
    }, 500) // Quick feedback, then move on
  }

  const completeSession = async () => {
    // Don't set sessionCompleted until we've saved everything
    setLoading(true)

    try {
      // Calculate percentage from session data instead of state
      const totalQuestions = session?.practice.length || 0
      const correctCount = session?.practice.filter(q => q.isCorrect === true).length || 0
      const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
      
      // Get session type from URL params
      const typeParam = searchParams?.get('type') || ''
      const validKanaTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
      const validVocabularyTypes = ['vocabulary_top100', 'vocabulary']
      const isVocabularySession = validVocabularyTypes.includes(typeParam)
      const currentType = isVocabularySession ? typeParam : (typeParam && validKanaTypes.includes(typeParam as KanaType) ? typeParam as KanaType : 'hiragana')
      
      // Save to Supabase progress table (only if there are practice questions)
      if (session?.practice && session.practice.length > 0) {
        let vocabularyItems: any[] = []
        
        if (isVocabularySession && session.sessionType === 'vocabulary') {
          // Vocabulary session - map vocabulary questions
          vocabularyItems = session.practice.map((q) => {
            const vocabQ = q as VocabularyPracticeQuestion
            return {
              vocabulary: vocabQ.vocabulary.japanese,
              hiragana: vocabQ.vocabulary.hiragana,
              romaji: vocabQ.vocabulary.romaji,
              english: vocabQ.vocabulary.english,
              questionType: vocabQ.questionType,
              userAnswer: vocabQ.userAnswer,
              isCorrect: vocabQ.isCorrect,
              batchNumber: session.batchNumber,
            }
          })
        } else {
          // Kana session - map kana questions
          vocabularyItems = session.practice.map((q) => {
            const kanaQ = q as KanaPracticeQuestion
            return {
              kana: kanaQ.kana.character,
              romaji: kanaQ.kana.romaji,
              questionType: kanaQ.questionType,
              userAnswer: kanaQ.userAnswer,
              isCorrect: kanaQ.isCorrect,
              batchNumber: session.batchNumber,
            }
          })
        }
        
        const { error: progressError } = await supabase.from('progress').insert({
          user_id: user.id,
          quiz_score: percentage,
          quiz_type: `${currentType}_session`,
          vocabulary_items: vocabularyItems,
        })

        if (progressError) {
          console.error('Error saving session progress:', progressError)
        }
      }
      
      // Add vocabulary to SRS if this is a vocabulary session
      if (isVocabularySession && session?.sessionType === 'vocabulary' && session.theory.vocabulary) {
        try {
          await addVocabularyToSRS(user.id, session.theory.vocabulary)
          console.log(`Added ${session.theory.vocabulary.length} vocabulary items to SRS`)
        } catch (error) {
          console.error('Error adding vocabulary to SRS:', error)
        }
      }

      // Mark batch as completed
      if (session?.batchNumber) {
        const { error: batchError } = await supabase.from('completed_batches').upsert({
          user_id: user.id,
          batch_type: currentType,
          batch_number: session.batchNumber,
          score: percentage,
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,batch_type,batch_number'
        })

        if (batchError) {
          console.error('Error marking batch as completed:', batchError)
        } else {
          // Update local state - add the completed batch
          console.log(`Batch ${session.batchNumber} marked as completed for user ${user.id}`)
          setCompletedBatches(prev => {
            const newSet = new Set(prev)
            newSet.add(session.batchNumber)
            return newSet
          })
          
          // Reload completed batches from database to ensure we have the latest state
          // This is important for determining if we can transition to the next type
          const { data: freshBatches } = await supabase
            .from('completed_batches')
            .select('batch_number')
            .eq('user_id', user.id)
            .eq('batch_type', currentType)
          
          if (freshBatches) {
            const freshBatchNumbers = freshBatches.map(b => b.batch_number)
            setCompletedBatches(new Set(freshBatchNumbers))
          }
        }
      }
    } catch (error) {
      console.error('Error saving session progress:', error)
    } finally {
      setLoading(false)
      // Only mark as completed after everything is saved
      setSessionCompleted(true)
    }
  }

  const calculatePercentage = () => {
    if (!session || session.practice.length === 0) return 100 // Theory-only sessions are 100% complete
    // Count correct answers from session data instead of state to avoid synchronization issues
    const correctCount = session.practice.filter(q => q.isCorrect === true).length
    return Math.round((correctCount / session.practice.length) * 100)
  }

  // Auto-focus input field when moving to next textfield question
  // Must be called before any conditional returns to maintain hook order
  useEffect(() => {
    if (
      session &&
      sessionStarted &&
      !sessionCompleted &&
      currentSection === 'practice' &&
      currentPracticeIndex < session.practice.length &&
      session.practice[currentPracticeIndex]?.questionType === 'character-to-romaji' &&
      answerFeedback === null &&
      inputRef.current
    ) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [session, currentPracticeIndex, currentSection, sessionStarted, sessionCompleted, answerFeedback])

  if (!mounted || !user || !session || !batchesLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const currentPracticeQuestion = session.practice[currentPracticeIndex]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                {session.practice.length > 0 
                  ? 'This session includes theory, examples, and practice. Estimated time: 5 minutes.'
                  : 'This session includes theory and examples. Estimated time: 3 minutes.'}
              </p>
              <div className="text-sm text-zinc-500">
                <p>• Theory: Learn the concepts</p>
                {session.practice.length > 0 && (
                  <>
                    <p>• Examples: See them in action</p>
                    <p>• Practice: Test your understanding</p>
                  </>
                )}
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

        {/* Tabs Navigation */}
        {sessionStarted && !sessionCompleted && (
          <div className="mb-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex">
              <button
                onClick={() => setCurrentSection('theory')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  currentSection === 'theory'
                    ? 'bg-pink-500 text-white'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                Theory
              </button>
              {session.practice.length > 0 && (
                <>
                  <button
                    onClick={() => setCurrentSection('examples')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-l border-r border-zinc-200 dark:border-zinc-700 ${
                      currentSection === 'examples'
                        ? 'bg-pink-500 text-white'
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Examples
                  </button>
                  <button
                    onClick={() => setCurrentSection('practice')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      currentSection === 'practice'
                        ? 'bg-pink-500 text-white'
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Practice
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Theory Section */}
        {sessionStarted && !sessionCompleted && currentSection === 'theory' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
                {session.theory.title}
              </h2>
              
              {/* Theory Tabs - Only show if there are multiple sections AND this is a theory-only session */}
              {theorySections.length > 1 && session.practice.length === 0 && (
                <div className="mb-6 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <div className="flex">
                    {theorySections.map((section, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentTheoryTab(section.title)}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors text-center ${
                          idx < theorySections.length - 1 ? 'border-r border-zinc-200 dark:border-zinc-700' : ''
                        } ${
                          currentTheoryTab === section.title
                            ? 'bg-pink-500 text-white'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Theory Content */}
              <div className="prose dark:prose-invert max-w-none">
                {theorySections.length > 0 && session.practice.length === 0 ? (
                  // Theory-only sessions: show sections with tabs
                  theorySections
                    .filter(section => currentTheoryTab === section.title || theorySections.length === 1)
                    .map((section, idx) => {
                      // Parse content to separate headings from examples
                      const lines = section.content.split('\n')
                      const formattedLines: string[] = []
                      let inExampleBlock = false
                      
                      for (let i = 0; i < lines.length; i++) {
                        const line = lines[i]
                        const trimmed = line.trim()
                        
                        // Check if this is a heading (starts with **)
                        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                          // Close previous example block if open
                          if (inExampleBlock) {
                            formattedLines.push('</div>')
                            inExampleBlock = false
                          }
                          // Add heading - remove trailing colon
                          const headingText = trimmed.replace(/\*\*/g, '').trim().replace(/:$/, '')
                          formattedLines.push(`<h3 class="text-xl font-bold text-black dark:text-zinc-50 mt-6 mb-3">${headingText}</h3>`)
                        }
                        // Check if this is an example line (starts with "- Example:" or contains "Example:")
                        else if (trimmed.startsWith('- Example:') || trimmed.match(/^-\s*Example/)) {
                          if (!inExampleBlock) {
                            formattedLines.push('<div class="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700 my-3">')
                            formattedLines.push('<p class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Example:</p>')
                            inExampleBlock = true
                          }
                          // Remove "- Example:" prefix and format (no bullet point)
                          const exampleText = trimmed.replace(/^-\s*Example:?\s*/, '').trim()
                          formattedLines.push(`<p class="text-zinc-700 dark:text-zinc-300 mb-1">${exampleText}</p>`)
                        }
                        // Check if this is a nested example (indented bullet with "Example:" or contains "=" which indicates an example)
                        else if (trimmed.startsWith('  - ') && (trimmed.includes('Example:') || trimmed.includes('='))) {
                          if (!inExampleBlock) {
                            formattedLines.push('<div class="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700 my-3">')
                            formattedLines.push('<p class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Example:</p>')
                            inExampleBlock = true
                          }
                          const exampleText = trimmed.replace(/^\s*-\s*/, '').trim()
                          formattedLines.push(`<p class="text-zinc-700 dark:text-zinc-300 mb-1">${exampleText}</p>`)
                        }
                        // Check if this is a regular bullet point
                        else if (trimmed.startsWith('- ')) {
                          // Close example block if we're starting a new non-example bullet
                          if (inExampleBlock && !trimmed.includes('Example:') && !trimmed.includes('=')) {
                            formattedLines.push('</div>')
                            inExampleBlock = false
                          }
                          if (!inExampleBlock) {
                            formattedLines.push('<div class="my-2">')
                            inExampleBlock = true
                          }
                          const bulletText = trimmed.substring(2).trim()
                          formattedLines.push(`<p class="text-zinc-700 dark:text-zinc-300 mb-1">• ${bulletText}</p>`)
                        }
                        // Regular text line
                        else if (trimmed) {
                          if (inExampleBlock && !trimmed.startsWith('-')) {
                            formattedLines.push('</div>')
                            inExampleBlock = false
                          }
                          formattedLines.push(`<p class="text-zinc-700 dark:text-zinc-300 mb-2">${trimmed}</p>`)
                        }
                        // Empty line
                        else {
                          if (inExampleBlock) {
                            formattedLines.push('</div>')
                            inExampleBlock = false
                          }
                          formattedLines.push('<br />')
                        }
                      }
                      
                      // Close any open example block
                      if (inExampleBlock) {
                        formattedLines.push('</div>')
                      }
                      
                      return (
                        <div
                          key={idx}
                          className="text-zinc-700 dark:text-zinc-300"
                          dangerouslySetInnerHTML={{
                            __html: formattedLines.join('')
                          }}
                        />
                      )
                    })
                ) : (
                  // Practice sessions: show raw theory content with formatting
                  <div 
                    className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line"
                    dangerouslySetInnerHTML={{
                      __html: session.theory.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br />')
                    }}
                  />
                )}
              </div>
            </div>

            {session.sessionType === 'vocabulary' && session.theory.vocabulary && session.theory.vocabulary.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
                  Vocabulary in this session:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {session.theory.vocabulary.map((vocab, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="text-center mb-2">
                        <span className="text-3xl font-bold text-black dark:text-zinc-50">
                          {vocab.japanese}
                        </span>
                        {vocab.hiragana && vocab.hiragana !== vocab.japanese && (
                          <span className="text-lg text-zinc-600 dark:text-zinc-400 ml-2">
                            ({vocab.hiragana})
                          </span>
                        )}
                      </div>
                      <div className="text-center mb-2">
                        <span className="text-lg font-semibold text-zinc-600 dark:text-zinc-400">
                          {vocab.romaji}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-700 dark:text-zinc-300 text-center">
                        {vocab.english}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {session.sessionType === 'kana' && session.theory.kana && session.theory.kana.length > 0 && (
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
            )}
            
            {/* Next button for special case sessions */}
            {session.practice.length === 0 && (
              <div className="mt-6 text-center">
                <button
                  onClick={completeSession}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors text-lg"
                >
                  Complete Session
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Examples Section */}
        {sessionStarted && !sessionCompleted && currentSection === 'examples' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            {session.examples.length > 0 ? (
              <>
                {session.sessionType === 'vocabulary' ? (
                  <>
                    <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
                      Vocabulary Examples
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                      Review the vocabulary words you just learned:
                    </p>

                    <div className="space-y-4 mb-6">
                      {(session.examples as VocabularyItem[]).map((vocab, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                        >
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <span className="text-3xl font-bold text-black dark:text-zinc-50">
                              {vocab.japanese}
                            </span>
                            {vocab.hiragana && vocab.hiragana !== vocab.japanese && (
                              <span className="text-xl text-zinc-600 dark:text-zinc-400">
                                ({vocab.hiragana})
                              </span>
                            )}
                            <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                              {vocab.romaji}
                            </span>
                          </div>
                          <div className="text-lg text-zinc-700 dark:text-zinc-300 mb-2">
                            {vocab.english}
                          </div>
                          {vocab.example_sentences && vocab.example_sentences.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-300 dark:border-zinc-600">
                              <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2">Example:</p>
                              {vocab.example_sentences.slice(0, 1).map((example, exIdx) => (
                                <div key={exIdx} className="text-sm text-zinc-700 dark:text-zinc-300">
                                  <div className="mb-1">{example.japanese} ({example.hiragana})</div>
                                  <div className="text-zinc-600 dark:text-zinc-400 italic mb-1">{example.romaji}</div>
                                  <div className="text-zinc-500 dark:text-zinc-400">"{example.english}"</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
                      Character Recognition & Word Examples
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                      Review the characters you just learned and see them used in real words:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                      {(session.examples as KanaCharacter[]).map((kana, idx) => (
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
                  </>
                )}

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
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
                  Review
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  This session covers important pronunciation rules and special cases. Review the theory section to ensure you understand these concepts.
                </p>
              </>
            )}
            
            {/* Next button for special case sessions */}
            {session.practice.length === 0 && (
              <div className="mt-6 text-center">
                <button
                  onClick={completeSession}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors text-lg"
                >
                  Complete Session
                  <span>→</span>
                </button>
              </div>
            )}
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
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Progress:</span>
                  <div className="text-lg font-bold text-pink-500 dark:text-pink-400">
                    {calculatePercentage()}%
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
              <div className="mb-6 text-center">
                {'kana' in currentPracticeQuestion ? (
                  // Kana question
                  currentPracticeQuestion.questionType === 'character-to-romaji' ? (
                    <>
                      <p className="text-lg font-medium text-zinc-600 dark:text-zinc-400 mb-6">What is the romaji for this character?</p>
                      <h2 className="text-8xl font-bold text-black dark:text-zinc-50">
                        {currentPracticeQuestion.kana.character}
                      </h2>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-zinc-600 dark:text-zinc-400 mb-6">What is the Hiragana character for this romaji?</p>
                      <h2 className="text-7xl font-bold text-black dark:text-zinc-50">
                        {currentPracticeQuestion.kana.romaji}
                      </h2>
                    </>
                  )
                ) : (
                  // Vocabulary question
                  currentPracticeQuestion.questionType === 'japanese-to-english' ? (
                    <>
                      <p className="text-lg font-medium text-zinc-600 dark:text-zinc-400 mb-6">What does this word mean?</p>
                      <h2 className="text-6xl font-bold text-black dark:text-zinc-50 mb-2">
                        {currentPracticeQuestion.vocabulary.japanese}
                      </h2>
                      {currentPracticeQuestion.vocabulary.hiragana && currentPracticeQuestion.vocabulary.hiragana !== currentPracticeQuestion.vocabulary.japanese && (
                        <p className="text-2xl text-zinc-600 dark:text-zinc-400">
                          ({currentPracticeQuestion.vocabulary.hiragana})
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-zinc-600 dark:text-zinc-400 mb-6">What is the Japanese word for:</p>
                      <h2 className="text-5xl font-bold text-black dark:text-zinc-50">
                        {currentPracticeQuestion.vocabulary.english}
                      </h2>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                        Type in romaji (e.g., "hon", "mizu") and it will convert to Hiragana
                      </p>
                    </>
                  )
                )}
              </div>
              
              <div className="space-y-4">
                {'kana' in currentPracticeQuestion ? (
                  // Kana question handling
                  currentPracticeQuestion.questionType === 'character-to-romaji' ? (
                  <>
                    <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePracticeSubmit()
                        }
                      }}
                      placeholder={session.sessionType === 'vocabulary' ? 'Type the English translation...' : 'Type the romaji (e.g., "ka", "ki", "ku")...'}
                      disabled={answerFeedback !== null}
                      className={`w-full px-4 py-3 text-black dark:text-white border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-center text-2xl ${
                        answerFeedback === 'correct'
                          ? 'bg-green-200 dark:bg-green-800 border-green-400 dark:border-green-600'
                          : answerFeedback === 'incorrect'
                          ? 'bg-red-200 dark:bg-red-800 border-red-400 dark:border-red-600'
                          : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600'
                      }`}
                    />
                    <button
                      onClick={handlePracticeSubmit}
                      disabled={!userInput.trim() || answerFeedback !== null}
                      className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      Submit Answer
                    </button>
                  </>
                  ) : (
                    // Kana multiple choice
                    <>
                      <div className="space-y-2">
                        {currentPracticeQuestion.options?.map((option, idx) => {
                          const isSelected = selectedOption === option
                          const isCorrect = option === currentPracticeQuestion.correctAnswer
                          const showFeedback = answerFeedback !== null
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!showFeedback) {
                                  setSelectedOption(option)
                                }
                              }}
                              disabled={showFeedback}
                              className={`w-full p-4 text-4xl font-bold rounded-lg border-2 transition-all ${
                                showFeedback && isSelected
                                  ? isCorrect
                                    ? 'bg-green-200 dark:bg-green-800 border-green-500 dark:border-green-600 text-green-900 dark:text-green-100'
                                    : 'bg-red-200 dark:bg-red-800 border-red-500 dark:border-red-600 text-red-900 dark:text-red-100'
                                  : showFeedback && isCorrect && !isSelected
                                  ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
                                  : isSelected
                                  ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300'
                                  : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 hover:border-pink-300 dark:hover:border-pink-700'
                              }`}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        onClick={handlePracticeSubmit}
                        disabled={!selectedOption || answerFeedback !== null}
                        className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        Submit Answer
                      </button>
                    </>
                  )
                ) : (
                  // Vocabulary question handling (all typing)
                  <>
                    {currentPracticeQuestion.questionType === 'english-to-japanese' && (
                      // Show romaji-to-hiragana conversion preview
                      <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                          Romaji input:
                        </div>
                        <div className="text-lg font-mono text-zinc-800 dark:text-zinc-200 mb-2">
                          {userInput || '(type romaji here)'}
                        </div>
                        {userInput && (
                          <>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                              Converts to:
                            </div>
                            <div className="text-2xl font-bold text-black dark:text-zinc-50">
                              {convertRomajiToHiragana(userInput)}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePracticeSubmit()
                        }
                      }}
                      placeholder={currentPracticeQuestion.questionType === 'japanese-to-english' 
                        ? 'Type the English translation...' 
                        : 'Type in romaji (e.g., "hon", "mizu")...'}
                      disabled={answerFeedback !== null}
                      className={`w-full px-4 py-3 text-black dark:text-white border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-center text-xl ${
                        answerFeedback === 'correct'
                          ? 'bg-green-200 dark:bg-green-800 border-green-400 dark:border-green-600'
                          : answerFeedback === 'incorrect'
                          ? 'bg-red-200 dark:bg-red-800 border-red-400 dark:border-red-600'
                          : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600'
                      }`}
                    />
                    <button
                      onClick={handlePracticeSubmit}
                      disabled={!userInput.trim() || answerFeedback !== null}
                      className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      Submit Answer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Session Complete */}
        {sessionCompleted && (
          <>
            {/* Theory/Example-Only Session Completion */}
            {session.practice.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">📚</span>
                  </div>
                  <h2 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
                    Session Complete!
                  </h2>
                  <div className="mb-6">
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-4">
                      You've completed this theory session. Great job reviewing the concepts! 🌟
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-500">
                      This session focused on learning important concepts and examples. No practice questions were included.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center">
                  <button
                    type="button"
                    onClick={async () => {
                      const currentBatch = session?.batchNumber || 1
                      const typeParam = searchParams?.get('type') as KanaType
                      const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
                      const currentType: KanaType = typeParam && validTypes.includes(typeParam)
                        ? typeParam
                        : 'hiragana'
                      
                      try {
                        const { data: batches } = await supabase
                          .from('completed_batches')
                          .select('batch_number')
                          .eq('user_id', user.id)
                          .eq('batch_type', currentType)
                        
                        const completedSet = new Set(batches?.map(b => b.batch_number) || [])
                        const totalBatches = getTotalBatches(currentType)
                        const nextBatch = currentBatch + 1
                        
                        let returnBatch = currentBatch
                        let returnType: KanaType | string = currentType
                        
                        if (nextBatch > totalBatches) {
                          // Transition to next course type - find the next incomplete batch
                          const nextType = getNextCourseType(currentType)
                          if (nextType) {
                            returnType = nextType as KanaType
                            // Find the next incomplete batch in the new type
                            const { data: nextTypeBatches } = await supabase
                              .from('completed_batches')
                              .select('batch_number')
                              .eq('user_id', user.id)
                              .eq('batch_type', nextType)
                            
                            const nextTypeCompleted = new Set(nextTypeBatches?.map(b => b.batch_number) || [])
                            const nextTypeTotal = getTotalBatches(nextType as KanaType)
                            
                            // Find first incomplete batch
                            let nextIncomplete = 1
                            for (let i = 1; i <= nextTypeTotal; i++) {
                              if (!nextTypeCompleted.has(i)) {
                                nextIncomplete = i
                                break
                              }
                            }
                            
                            returnBatch = nextIncomplete
                          } else {
                            window.location.href = `/dashboard?t=${Date.now()}`
                            return
                          }
                        } else {
                          const canAccessNext = nextBatch <= totalBatches && (nextBatch === 1 || completedSet.has(nextBatch - 1))
                          returnBatch = canAccessNext ? nextBatch : currentBatch
                        }
                        
                        window.location.href = `/dashboard?returnBatch=${returnBatch}&type=${returnType}&t=${Date.now()}`
                      } catch (error) {
                        console.error('Error determining return batch:', error)
                        window.location.href = `/dashboard?returnBatch=${currentBatch}&type=${currentType}&t=${Date.now()}`
                      }
                    }}
                    className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-black dark:text-white rounded-lg font-medium transition-colors"
                  >
                    Back to Dashboard
                  </button>
                  {session && (() => {
                    const typeParam = searchParams?.get('type') as KanaType
                    const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
                    const currentType: KanaType = typeParam && validTypes.includes(typeParam)
                      ? typeParam
                      : 'hiragana'
                    
                    const currentBatch = session.batchNumber
                    const totalBatches = getTotalBatches(currentType)
                    const nextBatch = currentBatch + 1
                    
                    const hasNextBatchInType = nextBatch <= totalBatches && (nextBatch === 1 || completedBatches.has(nextBatch - 1))
                    
                    let nextType: KanaType | string | null = null
                    let nextTypeBatch = 1
                    if (!hasNextBatchInType && currentBatch === totalBatches) {
                      const allBatchesCompleted = completedBatches.size >= totalBatches
                      
                      if (allBatchesCompleted) {
                        const nextCourseType = getNextCourseType(currentType)
                        if (nextCourseType) {
                          nextType = nextCourseType
                          // We'll find the next incomplete batch in the onClick handler
                          // since we can't use await during render
                          nextTypeBatch = 1
                        } else {
                          nextType = null
                        }
                      }
                    }
                    
                    const canAccessNext = hasNextBatchInType || (nextType !== null)
                    
                    return canAccessNext ? (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          
                          try {
                            const typeParam = searchParams?.get('type') as KanaType
                            const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
                            const currentType: KanaType = typeParam && validTypes.includes(typeParam)
                              ? typeParam
                              : 'hiragana'
                            
                            const currentBatch = session.batchNumber
                            const totalBatches = getTotalBatches(currentType)
                            const nextBatch = currentBatch + 1
                            
                            let targetType: KanaType | string = currentType
                            let targetBatch = nextBatch
                            
                            if (nextBatch > totalBatches) {
                              // Transition to next course type - find the next incomplete batch
                              const nextCourseType = getNextCourseType(currentType)
                              if (nextCourseType) {
                                targetType = nextCourseType
                                // Find the next incomplete batch in the new type
                                const { data: nextTypeBatches } = await supabase
                                  .from('completed_batches')
                                  .select('batch_number')
                                  .eq('user_id', user.id)
                                  .eq('batch_type', nextCourseType)
                                
                                const nextTypeCompleted = new Set(nextTypeBatches?.map(b => b.batch_number) || [])
                                const nextTypeTotal = getTotalBatches(nextCourseType as KanaType)
                                
                                // Find first incomplete batch
                                let nextIncomplete = 1
                                for (let i = 1; i <= nextTypeTotal; i++) {
                                  if (!nextTypeCompleted.has(i)) {
                                    nextIncomplete = i
                                    break
                                  }
                                }
                                
                                targetBatch = nextIncomplete
                              } else {
                                window.location.href = `/dashboard?t=${Date.now()}`
                                return
                              }
                            } else {
                              const { data: batches, error: batchesError } = await supabase
                                .from('completed_batches')
                                .select('batch_number')
                                .eq('user_id', user.id)
                                .eq('batch_type', currentType)
                              
                              if (batchesError) {
                                console.error('Error loading completed batches:', batchesError)
                                return
                              }
                              
                              if (batches) {
                                const completedSet = new Set(batches.map(b => b.batch_number))
                                setCompletedBatches(completedSet)
                                
                                if (nextBatch > 1 && !completedSet.has(nextBatch - 1)) {
                                  const lastCompleted = Array.from(completedSet).sort((a, b) => b - a)[0] || 0
                                  const actualNext = lastCompleted + 1
                                  window.location.href = `/dashboard/course?batch=${actualNext}&type=${currentType}&t=${Date.now()}`
                                  return
                                }
                              }
                            }
                            
                            window.location.href = `/dashboard/course?batch=${targetBatch}&type=${targetType}&t=${Date.now()}`
                          } catch (error) {
                            console.error('Error navigating to next batch:', error)
                          }
                        }}
                        className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
                      >
                        Next Session
                      </button>
                    ) : null
                  })()}
                </div>
              </div>
            ) : (
              /* Practice Session Completion */
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🎉</span>
                  </div>
                  <h2 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
                    Session Complete!
                  </h2>
                  <div className="mb-4">
                    <div className="text-6xl font-bold text-pink-500 dark:text-pink-400 mb-2">
                      {calculatePercentage()}%
                    </div>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400">
                      {calculatePercentage() === 100
                        ? 'Perfect! Excellent work! 🌟'
                        : calculatePercentage() >= 80
                        ? 'Great job! Keep practicing! 💪'
                        : 'Good effort! Review and try again! 📚'}
                    </p>
                  </div>
                </div>

                {/* Review Section */}
                <div className="mb-8">
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
                    {session.practice
                      .filter((q) => {
                        if (q.isCorrect === null) return false
                        if (q.isCorrect === false) return true
                        if (showCorrectAnswers && q.isCorrect === true) return true
                        return false
                      })
                      .map((q) => (
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
                    {session.practice.filter((q) => {
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
                <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={async () => {
                  // Since the session is completed, determine the next available batch/type
                  // Reload batches from Supabase to ensure we have the latest state
                  const currentBatch = session?.batchNumber || 1
                  
                  // Get kana type from URL params (declare outside try for catch block access)
                  const typeParam = searchParams?.get('type') as KanaType
                  const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
                  const currentType: KanaType = typeParam && validTypes.includes(typeParam)
                    ? typeParam
                    : 'hiragana'
                  
                  try {
                    const { data: batches } = await supabase
                      .from('completed_batches')
                      .select('batch_number')
                      .eq('user_id', user.id)
                      .eq('batch_type', currentType)
                    
                    const completedSet = new Set(batches?.map(b => b.batch_number) || [])
                    const totalBatches = getTotalBatches(currentType)
                    const nextBatch = currentBatch + 1
                    
                    // Check if we should transition to next type
                    let returnBatch = currentBatch
                    let returnType: KanaType | string = currentType
                    
                    if (nextBatch > totalBatches) {
                      // All batches of current type are completed, transition to next type
                      const nextType = getNextCourseType(currentType)
                      if (nextType) {
                        returnType = nextType as KanaType
                        returnBatch = 1
                      } else {
                        // No more course types, just go to dashboard
                        window.location.href = `/dashboard?t=${Date.now()}`
                        return
                      }
                    } else {
                      // Check if next batch is unlocked
                      const canAccessNext = nextBatch <= totalBatches && (nextBatch === 1 || completedSet.has(nextBatch - 1))
                      returnBatch = canAccessNext ? nextBatch : currentBatch
                    }
                    
                    // Use window.location for full page reload to ensure state is reset
                    window.location.href = `/dashboard?returnBatch=${returnBatch}&type=${returnType}&t=${Date.now()}`
                  } catch (error) {
                    console.error('Error determining return batch:', error)
                    // Fallback to current batch
                    window.location.href = `/dashboard?returnBatch=${currentBatch}&type=${currentType}&t=${Date.now()}`
                  }
                }}
                className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-black dark:text-white rounded-lg font-medium transition-colors"
              >
                Back to Dashboard
              </button>
              {session && (() => {
                // Get kana type from URL params
                const typeParam = searchParams?.get('type') as KanaType
                const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
                const currentType: KanaType = typeParam && validTypes.includes(typeParam)
                  ? typeParam
                  : 'hiragana'
                
                const currentBatch = session.batchNumber
                const totalBatches = getTotalBatches(currentType)
                const nextBatch = currentBatch + 1
                
                // Check if there's a next batch in the current type
                const hasNextBatchInType = nextBatch <= totalBatches && (nextBatch === 1 || completedBatches.has(nextBatch - 1))
                
                // If we're at the last batch of current type, check if there's a next course type
                let nextType: KanaType | string | null = null
                let nextTypeBatch = 1
                if (!hasNextBatchInType && currentBatch === totalBatches) {
                  // Check if all batches of current type are completed
                  // Note: completedBatches should include the just-completed batch since it's saved in completeSession
                  const allBatchesCompleted = completedBatches.size >= totalBatches
                  
                  if (allBatchesCompleted) {
                    // Determine next course type in sequence using helper function
                    // This works for all current and future course types
                    const nextCourseType = getNextCourseType(currentType)
                    if (nextCourseType) {
                      nextType = nextCourseType
                      nextTypeBatch = 1
                    } else {
                      // No more course types available
                      nextType = null
                    }
                  }
                }
                
                const canAccessNext = hasNextBatchInType || (nextType !== null)
                
                return canAccessNext ? (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      
                      try {
                        // Get kana type from URL params
                        const typeParam = searchParams?.get('type') as KanaType
                        const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
                        const currentType: KanaType = typeParam && validTypes.includes(typeParam)
                          ? typeParam
                          : 'hiragana'
                        
                        const currentBatch = session.batchNumber
                        const totalBatches = getTotalBatches(currentType)
                        const nextBatch = currentBatch + 1
                        
                        // Check if we're transitioning to a new course type
                        let targetType: KanaType | string = currentType
                        let targetBatch = nextBatch
                        
                        if (nextBatch > totalBatches) {
                          // We're at the last batch of current type, transition to next type
                          // This works for all current and future course types
                          const nextCourseType = getNextCourseType(currentType)
                          if (nextCourseType) {
                            targetType = nextCourseType
                            // Find the next incomplete batch in the new type
                            const { data: nextTypeBatches } = await supabase
                              .from('completed_batches')
                              .select('batch_number')
                              .eq('user_id', user.id)
                              .eq('batch_type', nextCourseType)
                            
                            const nextTypeCompleted = new Set(nextTypeBatches?.map(b => b.batch_number) || [])
                            const nextTypeTotal = getTotalBatches(nextCourseType as KanaType)
                            
                            // Find first incomplete batch
                            let nextIncomplete = 1
                            for (let i = 1; i <= nextTypeTotal; i++) {
                              if (!nextTypeCompleted.has(i)) {
                                nextIncomplete = i
                                break
                              }
                            }
                            
                            targetBatch = nextIncomplete
                          } else {
                            // No more course types available
                            window.location.href = `/dashboard?t=${Date.now()}`
                            return
                          }
                        } else {
                          // Stay in current type, verify the next batch is unlocked
                          // Ensure the current batch completion is saved and loaded
                          const { data: batches, error: batchesError } = await supabase
                            .from('completed_batches')
                            .select('batch_number')
                            .eq('user_id', user.id)
                            .eq('batch_type', currentType)
                          
                          if (batchesError) {
                            console.error('Error loading completed batches:', batchesError)
                            return
                          }
                          
                          if (batches) {
                            const completedSet = new Set(batches.map(b => b.batch_number))
                            setCompletedBatches(completedSet)
                            
                            // Verify the next batch is actually unlocked
                            if (nextBatch > 1 && !completedSet.has(nextBatch - 1)) {
                              console.error(`Next batch ${nextBatch} is not unlocked yet. Completed batches:`, Array.from(completedSet))
                              // Instead of returning, redirect to the last completed batch + 1
                              const lastCompleted = Array.from(completedSet).sort((a, b) => b - a)[0] || 0
                              const actualNext = lastCompleted + 1
                              window.location.href = `/dashboard/course?batch=${actualNext}&type=${currentType}&t=${Date.now()}`
                              return
                            }
                          }
                        }
                        
                        // Navigate to next batch/type with full page reload and cache busting
                        window.location.href = `/dashboard/course?batch=${targetBatch}&type=${targetType}&t=${Date.now()}`
                      } catch (error) {
                        console.error('Error navigating to next batch:', error)
                      }
                    }}
                    className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Next Session
                  </button>
                ) : null
              })()}
                </div>
              </div>
            )}
          </>
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

