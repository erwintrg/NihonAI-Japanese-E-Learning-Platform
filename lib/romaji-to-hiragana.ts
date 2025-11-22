/**
 * Romaji to Hiragana conversion utility
 * Converts typed romaji input to Hiragana characters
 */

const romajiToHiraganaMap: Record<string, string> = {
  // Basic vowels
  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
  // K row
  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  // S row
  'sa': 'さ', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  // T row
  'ta': 'た', 'chi': 'ち', 'tsu': 'つ', 'te': 'て', 'to': 'と',
  // N row
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  // H row
  'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  // M row
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  // Y row
  'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
  // R row
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  // W row
  'wa': 'わ', 'wo': 'を',
  // N
  'n': 'ん',
}

/**
 * Convert romaji input to Hiragana
 * Handles partial input and converts as user types
 * Returns the converted Hiragana if a complete match is found
 */
export function convertRomajiToHiragana(input: string): string {
  if (!input) return ''
  
  const lowerInput = input.toLowerCase().trim()
  
  // Check for exact matches first (longer sequences first to catch "shi" before "s")
  const sortedKeys = Object.keys(romajiToHiraganaMap).sort((a, b) => b.length - a.length)
  
  // First, try exact match
  if (romajiToHiraganaMap[lowerInput]) {
    return romajiToHiraganaMap[lowerInput]
  }
  
  // Then check if input starts with any romaji sequence
  for (const romaji of sortedKeys) {
    if (lowerInput === romaji) {
      return romajiToHiraganaMap[romaji]
    }
  }
  
  // If no exact match found, return empty string (user is still typing)
  return ''
}

/**
 * Check if input is a valid romaji sequence that can be converted
 */
export function isValidRomaji(input: string): boolean {
  const lowerInput = input.toLowerCase().trim()
  const sortedKeys = Object.keys(romajiToHiraganaMap).sort((a, b) => b.length - a.length)
  
  for (const romaji of sortedKeys) {
    if (lowerInput === romaji || lowerInput.startsWith(romaji)) {
      return true
    }
  }
  
  return false
}

