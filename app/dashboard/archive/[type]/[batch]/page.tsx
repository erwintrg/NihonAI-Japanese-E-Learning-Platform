'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  getKanaByBatchAndType,
  getBatchName,
  type KanaCharacter,
  type KanaType
} from '@/lib/kana'
import { getAllVocab, type VocabularyItem } from '@/lib/data'
import Link from 'next/link'

// Helper function to check if a string contains Kanji characters
const containsKanji = (text: string): boolean => {
  // Kanji Unicode range: \u4E00-\u9FAF
  return /[\u4E00-\u9FAF]/.test(text)
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
}

function ArchiveDetailPageContent() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<CourseSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTheoryTab, setCurrentTheoryTab] = useState<string>('')
  const [theorySections, setTheorySections] = useState<Array<{ title: string; content: string }>>([])
  const [currentSection, setCurrentSection] = useState<'theory' | 'examples'>('theory')
  const [isSpecialCase, setIsSpecialCase] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    async function loadSession() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push('/auth')
        return
      }
      
      setUser(user)
      
      const typeParam = params?.type as string
      const batchParam = params?.batch as string
      
      if (!typeParam || !batchParam) {
        router.push('/dashboard/archive')
        return
      }
      
      const validTypes: KanaType[] = ['hiragana', 'hiragana_dakuten', 'hiragana_handakuten', 'hiragana_combo', 'hiragana_special', 'katakana', 'katakana_dakuten', 'katakana_handakuten', 'katakana_combo', 'katakana_special']
      const currentType: KanaType = validTypes.includes(typeParam as KanaType)
        ? (typeParam as KanaType)
        : 'hiragana'
      
      const batchNumber = parseInt(batchParam, 10)
      if (isNaN(batchNumber)) {
        router.push('/dashboard/archive')
        return
      }
      
      // Verify session is completed
      const { data: completedBatch } = await supabase
        .from('completed_batches')
        .select('*')
        .eq('user_id', user.id)
        .eq('batch_type', currentType)
        .eq('batch_number', batchNumber)
        .single()
      
      if (!completedBatch) {
        router.push('/dashboard/archive')
        return
      }
      
      // Load session data (similar to course page)
      const isSpecialCaseValue = currentType === 'hiragana_special' || currentType === 'katakana_special'
      setIsSpecialCase(isSpecialCaseValue)
      
      // Special case sessions don't have kana characters, so skip the check
      let batchKana: KanaCharacter[] = []
      if (!isSpecialCaseValue) {
        batchKana = getKanaByBatchAndType(batchNumber, currentType)
        // Only check for empty kana if it's not a special case session
        if (batchKana.length === 0) {
          router.push('/dashboard/archive')
          return
        }
      }
      const batchName = getBatchName(batchNumber, currentType)
      
      // Get word examples
      const allVocab = getAllVocab()
      const kanaCharacters = batchKana.map(k => k.character)
      const wordExamples = isSpecialCaseValue ? [] : allVocab
        .filter(vocab => {
          return kanaCharacters.some(kana => vocab.hiragana.includes(kana))
        })
        .slice(0, 5)
      
      // Generate theory content (full logic from course page)
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
      
      // Generate full theory content (same as course page)
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
        
        theoryContent = `**${typeLabel} Ordering:**
Characters are organized in batches to help you learn systematically. This session covers the ${batchName}.${batchNote}

**About Mnemonics:**
Each character has a mnemonic - a visual story connecting its shape to its sound. Visualize each mnemonic as you study: the more vivid your mental image, the better you'll remember!

Characters in this session: ${batchKana.map(k => k.character).join(', ')}`
      }
      
      // Parse theory content into sections for tabbed display
      // ONLY for theory-only sessions (no practice questions)
      // For practice sessions, always show raw theory content
      if (theoryContent && isSpecialCaseValue) {
        const sections: Array<{ title: string; content: string }> = []
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
              // Remove trailing colon from title
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
            if (currentContent.length === 0 && line.trim()) {
              currentContent.push(line)
            }
          }
        }
        
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
        
        if (filteredSections.length === 0) {
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
      
      const archiveSession: CourseSession = {
        id: `${currentType}-batch-${batchNumber}`,
        title: isSpecialCaseValue 
          ? typeLabel  // For special cases, just use the type label (e.g., "Hiragana Special Cases")
          : `${typeLabel}: ${batchName}`,
        description: isSpecialCaseValue 
          ? `Learn about ${typeLabel} pronunciation rules`
          : `Learn ${batchKana.length} ${typeLabel} characters: ${batchKana.map(k => k.character).join(', ')}`,
        batchNumber,
        theory: {
          title: sessionTitle,
          content: theoryContent,
          kana: batchKana || [],
          wordExamples: wordExamples || [],
        },
        examples: batchKana || [],
      }
      
      setSession(archiveSession)
      setLoading(false)
    }
    
    loadSession()
  }, [router, supabase, params])

  if (!mounted || loading || !user || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/archive"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white mb-4 inline-flex items-center gap-1 transition-colors"
          >
            ← Back to Archive
          </Link>
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
            {session.title}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            {session.description}
          </p>
        </div>

        {/* Tabs Navigation - Only show for sessions with examples (not theory-only) */}
        {session.examples.length > 0 && (
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
              <button
                onClick={() => setCurrentSection('examples')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-l border-zinc-200 dark:border-zinc-700 ${
                  currentSection === 'examples'
                    ? 'bg-pink-500 text-white'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                Examples
              </button>
            </div>
          </div>
        )}

        {/* Theory Section */}
        {currentSection === 'theory' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
                {session.theory.title}
              </h2>
              
              {/* Theory Tabs - Only show if there are multiple sections AND this is a theory-only session */}
              {theorySections.length > 1 && isSpecialCase && (
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
                {theorySections.length > 0 && isSpecialCase ? (
                  theorySections
                    .filter(section => currentTheoryTab === section.title || theorySections.length === 1)
                    .map((section, idx) => {
                      const lines = section.content.split('\n')
                      const formattedLines: string[] = []
                      let inExampleBlock = false
                      
                      for (let i = 0; i < lines.length; i++) {
                        const line = lines[i]
                        const trimmed = line.trim()
                        
                        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                          if (inExampleBlock) {
                            formattedLines.push('</div>')
                            inExampleBlock = false
                          }
                          // Remove trailing colon from heading
                          const headingText = trimmed.replace(/\*\*/g, '').trim().replace(/:$/, '')
                          formattedLines.push(`<h3 class="text-xl font-bold text-black dark:text-zinc-50 mt-6 mb-3">${headingText}</h3>`)
                        }
                        else if (trimmed.startsWith('- Example:') || trimmed.match(/^-\s*Example/)) {
                          if (!inExampleBlock) {
                            formattedLines.push('<div class="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700 my-3">')
                            formattedLines.push('<p class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Example:</p>')
                            inExampleBlock = true
                          }
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
                        else if (trimmed) {
                          if (inExampleBlock && !trimmed.startsWith('-')) {
                            formattedLines.push('</div>')
                            inExampleBlock = false
                          }
                          formattedLines.push(`<p class="text-zinc-700 dark:text-zinc-300 mb-2">${trimmed}</p>`)
                        }
                        else {
                          if (inExampleBlock) {
                            formattedLines.push('</div>')
                            inExampleBlock = false
                          }
                          formattedLines.push('<br />')
                        }
                      }
                      
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

            {session.theory.kana.length > 0 && (
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
          </div>
        )}

        {/* Examples Section */}
        {currentSection === 'examples' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
            {session.examples.length > 0 ? (
              <>
                <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
                  Character Recognition & Word Examples
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  Review the characters you learned and see them used in real words:
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
                            {word.hiragana && containsKanji(word.japanese) && (
                              <span className="text-lg text-zinc-600 dark:text-zinc-400">
                                ({word.hiragana})
                              </span>
                            )}
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
          </div>
        )}
      </div>
    </div>
  )
}

export default function ArchiveDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    }>
      <ArchiveDetailPageContent />
    </Suspense>
  )
}

