/**
 * Romaji to Hiragana conversion utility
 * Converts typed romaji input to Hiragana characters
 * Handles full words, combos, and single characters
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
  // Dakuten (voiced)
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  'za': 'ざ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  'da': 'だ', 'de': 'で', 'do': 'ど',
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  // Handakuten
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  // Combos (small ya, yu, yo)
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
  'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
  // Long vowels (double vowels)
  'aa': 'ああ', 'ii': 'いい', 'uu': 'うう', 'ee': 'ええ', 'oo': 'おお',
}

/**
 * Convert full romaji word to Hiragana
 * Handles combos, dakuten, and full words
 */
export function convertRomajiToHiragana(input: string): string {
  if (!input) return ''
  
  const lowerInput = input.toLowerCase().trim()
  let result = ''
  let i = 0
  
  // Sort keys by length (longest first) to match combos before single characters
  const sortedKeys = Object.keys(romajiToHiraganaMap).sort((a, b) => b.length - a.length)
  
  while (i < lowerInput.length) {
    let matched = false
    
    // Try to match longest possible sequence first
    for (const romaji of sortedKeys) {
      if (lowerInput.substring(i, i + romaji.length) === romaji) {
        result += romajiToHiraganaMap[romaji]
        i += romaji.length
        matched = true
        break
      }
    }
    
    // If no match found, skip the character (might be punctuation or space)
    if (!matched) {
      // Handle spaces and punctuation
      if (lowerInput[i] === ' ') {
        result += ' '
      } else if (/[a-z]/.test(lowerInput[i])) {
        // If it's a letter but no match, try single character
        // This handles cases where user is still typing
        return result // Return partial conversion
      }
      i++
    }
  }
  
  return result
}

/**
 * Check if input is a valid romaji sequence that can be converted
 */
export function isValidRomaji(input: string): boolean {
  const lowerInput = input.toLowerCase().trim()
  const sortedKeys = Object.keys(romajiToHiraganaMap).sort((a, b) => b.length - a.length)
  
  for (const romaji of sortedKeys) {
    if (lowerInput.includes(romaji)) {
      return true
    }
  }
  
  return false
}
