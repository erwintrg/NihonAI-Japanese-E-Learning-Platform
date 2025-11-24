import hiraganaData from '@/data/kana/hiragana.json'
import hiraganaDakutenData from '@/data/kana/hiragana-dakuten.json'
import hiraganaHandakutenData from '@/data/kana/hiragana-handakuten.json'
import hiraganaComboData from '@/data/kana/hiragana-combo.json'

export type KanaCharacter = {
  character: string
  romaji: string
  mnemonic: string
  mnemonicImage: string
  batch: number
  baseCharacter?: string // For dakuten/handakuten/combo characters
}

export type KanaBatch = {
  batchNumber: number
  kana: KanaCharacter[]
}

export type KanaType = 'hiragana' | 'hiragana_dakuten' | 'hiragana_handakuten' | 'hiragana_combo'

// Course type sequence for determining next session
// This sequence defines the order of all course types (current and future)
export const COURSE_TYPE_SEQUENCE: (KanaType | string)[] = [
  'hiragana',
  'hiragana_dakuten',
  'hiragana_handakuten',
  'hiragana_combo',
  // Future course types will be added here:
  // 'vocabulary',
  // 'grammar',
  // 'phrases',
  // etc.
]

/**
 * Get the next course type in sequence after the given type
 * Returns null if there's no next type or if the type is not found
 */
export function getNextCourseType(currentType: string): string | null {
  const currentIndex = COURSE_TYPE_SEQUENCE.indexOf(currentType)
  if (currentIndex === -1 || currentIndex === COURSE_TYPE_SEQUENCE.length - 1) {
    return null
  }
  return COURSE_TYPE_SEQUENCE[currentIndex + 1] || null
}

/**
 * Get all Hiragana characters
 */
export function getAllHiragana(): KanaCharacter[] {
  return hiraganaData as KanaCharacter[]
}

/**
 * Get Hiragana characters by batch number
 */
export function getHiraganaByBatch(batchNumber: number): KanaCharacter[] {
  return getAllHiragana().filter((kana) => kana.batch === batchNumber)
}

/**
 * Get all Hiragana batches
 */
export function getAllHiraganaBatches(): KanaBatch[] {
  const allKana = getAllHiragana()
  const batches: KanaBatch[] = []
  
  // Find max batch number
  const maxBatch = Math.max(...allKana.map((k) => k.batch))
  
  for (let i = 1; i <= maxBatch; i++) {
    const batchKana = getHiraganaByBatch(i)
    if (batchKana.length > 0) {
      batches.push({
        batchNumber: i,
        kana: batchKana,
      })
    }
  }
  
  return batches
}

/**
 * Get total number of Hiragana batches
 */
export function getTotalHiraganaBatches(): number {
  const allKana = getAllHiragana()
  return Math.max(...allKana.map((k) => k.batch), 0)
}

/**
 * Get a specific Hiragana character by its character
 */
export function getHiraganaByCharacter(character: string): KanaCharacter | undefined {
  return getAllHiragana().find((k) => k.character === character)
}

/**
 * Get the descriptive name for a Hiragana batch
 * Returns names like "Vowels", "K-row", "S-row", etc.
 */
export function getHiraganaBatchName(batchNumber: number): string {
  const batchNames: Record<number, string> = {
    1: 'Vowels',
    2: 'K-row',
    3: 'S-row',
    4: 'T-row',
    5: 'N-row',
    6: 'H-row',
    7: 'M-row',
    8: 'Y-row',
    9: 'R-row',
    10: 'W-row & N',
  }
  
  return batchNames[batchNumber] || `Batch ${batchNumber}`
}

/**
 * Get all Hiragana Dakuten characters
 */
export function getAllHiraganaDakuten(): KanaCharacter[] {
  return hiraganaDakutenData as KanaCharacter[]
}

/**
 * Get Hiragana Dakuten characters by batch number
 */
export function getHiraganaDakutenByBatch(batchNumber: number): KanaCharacter[] {
  return getAllHiraganaDakuten().filter((kana) => kana.batch === batchNumber)
}

/**
 * Get all Hiragana Dakuten batches
 */
export function getAllHiraganaDakutenBatches(): KanaBatch[] {
  const allKana = getAllHiraganaDakuten()
  const batches: KanaBatch[] = []
  
  const maxBatch = Math.max(...allKana.map((k) => k.batch), 0)
  
  for (let i = 1; i <= maxBatch; i++) {
    const batchKana = getHiraganaDakutenByBatch(i)
    if (batchKana.length > 0) {
      batches.push({
        batchNumber: i,
        kana: batchKana,
      })
    }
  }
  
  return batches
}

/**
 * Get total number of Hiragana Dakuten batches
 */
export function getTotalHiraganaDakutenBatches(): number {
  const allKana = getAllHiraganaDakuten()
  return Math.max(...allKana.map((k) => k.batch), 0)
}

/**
 * Get the descriptive name for a Hiragana Dakuten batch
 */
export function getHiraganaDakutenBatchName(batchNumber: number): string {
  const batchNames: Record<number, string> = {
    1: 'G-row (K-row Dakuten)',
    2: 'Z-row (S-row Dakuten)',
    3: 'D-row (T-row Dakuten)',
    4: 'B-row (H-row Dakuten)',
  }
  
  return batchNames[batchNumber] || `Dakuten Batch ${batchNumber}`
}

/**
 * Get all Hiragana Handakuten characters
 */
export function getAllHiraganaHandakuten(): KanaCharacter[] {
  return hiraganaHandakutenData as KanaCharacter[]
}

/**
 * Get Hiragana Handakuten characters by batch number
 */
export function getHiraganaHandakutenByBatch(batchNumber: number): KanaCharacter[] {
  return getAllHiraganaHandakuten().filter((kana) => kana.batch === batchNumber)
}

/**
 * Get all Hiragana Handakuten batches
 */
export function getAllHiraganaHandakutenBatches(): KanaBatch[] {
  const allKana = getAllHiraganaHandakuten()
  const batches: KanaBatch[] = []
  
  const maxBatch = Math.max(...allKana.map((k) => k.batch), 0)
  
  for (let i = 1; i <= maxBatch; i++) {
    const batchKana = getHiraganaHandakutenByBatch(i)
    if (batchKana.length > 0) {
      batches.push({
        batchNumber: i,
        kana: batchKana,
      })
    }
  }
  
  return batches
}

/**
 * Get total number of Hiragana Handakuten batches
 */
export function getTotalHiraganaHandakutenBatches(): number {
  const allKana = getAllHiraganaHandakuten()
  return Math.max(...allKana.map((k) => k.batch), 0)
}

/**
 * Get the descriptive name for a Hiragana Handakuten batch
 */
export function getHiraganaHandakutenBatchName(batchNumber: number): string {
  return 'P-row (H-row Handakuten)'
}

/**
 * Get all Hiragana Combo characters
 */
export function getAllHiraganaCombo(): KanaCharacter[] {
  return hiraganaComboData as KanaCharacter[]
}

/**
 * Get Hiragana Combo characters by batch number
 */
export function getHiraganaComboByBatch(batchNumber: number): KanaCharacter[] {
  return getAllHiraganaCombo().filter((kana) => kana.batch === batchNumber)
}

/**
 * Get all Hiragana Combo batches
 */
export function getAllHiraganaComboBatches(): KanaBatch[] {
  const allKana = getAllHiraganaCombo()
  const batches: KanaBatch[] = []
  
  const maxBatch = Math.max(...allKana.map((k) => k.batch), 0)
  
  for (let i = 1; i <= maxBatch; i++) {
    const batchKana = getHiraganaComboByBatch(i)
    if (batchKana.length > 0) {
      batches.push({
        batchNumber: i,
        kana: batchKana,
      })
    }
  }
  
  return batches
}

/**
 * Get total number of Hiragana Combo batches
 */
export function getTotalHiraganaComboBatches(): number {
  const allKana = getAllHiraganaCombo()
  return Math.max(...allKana.map((k) => k.batch), 0)
}

/**
 * Get the descriptive name for a Hiragana Combo batch
 */
export function getHiraganaComboBatchName(batchNumber: number): string {
  const batchNames: Record<number, string> = {
    1: 'KYA-row Combos',
    2: 'SHA-row Combos',
    3: 'CHA-row Combos',
    4: 'NYA-row Combos',
    5: 'HYA-row Combos',
    6: 'MYA-row Combos',
    7: 'RYA-row Combos',
    8: 'GYA-row Combos',
    9: 'JA-row Combos',
    10: 'BYA-row Combos',
    11: 'PYA-row Combos',
  }
  
  return batchNames[batchNumber] || `Combo Batch ${batchNumber}`
}

/**
 * Get all kana of a specific type
 */
export function getAllKanaByType(type: KanaType): KanaCharacter[] {
  switch (type) {
    case 'hiragana':
      return getAllHiragana()
    case 'hiragana_dakuten':
      return getAllHiraganaDakuten()
    case 'hiragana_handakuten':
      return getAllHiraganaHandakuten()
    case 'hiragana_combo':
      return getAllHiraganaCombo()
    default:
      return []
  }
}

/**
 * Get kana by batch for a specific type
 */
export function getKanaByBatchAndType(batchNumber: number, type: KanaType): KanaCharacter[] {
  switch (type) {
    case 'hiragana':
      return getHiraganaByBatch(batchNumber)
    case 'hiragana_dakuten':
      return getHiraganaDakutenByBatch(batchNumber)
    case 'hiragana_handakuten':
      return getHiraganaHandakutenByBatch(batchNumber)
    case 'hiragana_combo':
      return getHiraganaComboByBatch(batchNumber)
    default:
      return []
  }
}

/**
 * Get batch name for a specific type
 */
export function getBatchName(batchNumber: number, type: KanaType): string {
  switch (type) {
    case 'hiragana':
      return getHiraganaBatchName(batchNumber)
    case 'hiragana_dakuten':
      return getHiraganaDakutenBatchName(batchNumber)
    case 'hiragana_handakuten':
      return getHiraganaHandakutenBatchName(batchNumber)
    case 'hiragana_combo':
      return getHiraganaComboBatchName(batchNumber)
    default:
      return `Batch ${batchNumber}`
  }
}

/**
 * Get total batches for a specific type
 */
export function getTotalBatches(type: KanaType): number {
  switch (type) {
    case 'hiragana':
      return getTotalHiraganaBatches()
    case 'hiragana_dakuten':
      return getTotalHiraganaDakutenBatches()
    case 'hiragana_handakuten':
      return getTotalHiraganaHandakutenBatches()
    case 'hiragana_combo':
      return getTotalHiraganaComboBatches()
    default:
      return 0
  }
}

