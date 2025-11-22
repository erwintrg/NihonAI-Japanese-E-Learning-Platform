import hiraganaData from '@/data/kana/hiragana.json'

export type KanaCharacter = {
  character: string
  romaji: string
  mnemonic: string
  mnemonicImage: string
  batch: number
}

export type KanaBatch = {
  batchNumber: number
  kana: KanaCharacter[]
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

