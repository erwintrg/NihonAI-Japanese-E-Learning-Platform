/**
 * Vocabulary session utilities
 * Handles vocabulary grouping, session creation, and Top 100 vocabulary
 */

import { getAllVocab, getVocabByLevel, getVocabByCategory, type VocabularyItem } from './data'

export type VocabularyTopic = 
  | 'family' 
  | 'food' 
  | 'time' 
  | 'colors' 
  | 'numbers'
  | 'body'
  | 'weather'
  | 'places'
  | 'actions'
  | 'descriptions'
  | 'common'

export interface VocabularySession {
  id: string
  batchNumber: number
  type: 'vocabulary_top100' | 'vocabulary'
  vocabulary: VocabularyItem[]
  topic?: VocabularyTopic
  jlptLevel?: string // N5, N4, N3, N2, N1
}

/**
 * Get Top 100 vocabulary items grouped by topic
 * Returns 20 sessions with 5 vocabulary items each
 */
export function getTop100VocabularySessions(): VocabularySession[] {
  // Get all N5 vocabulary (or most common vocabulary if level not specified)
  const allVocab = getAllVocab()
  
  // Filter for vocabulary type (not phrases or sentences)
  const vocabWords = allVocab.filter(item => item.type === 'word')
  
  // Group by topic/category where possible
  const topicGroups: Record<string, VocabularyItem[]> = {
    family: [],
    food: [],
    time: [],
    colors: [],
    numbers: [],
    body: [],
    weather: [],
    places: [],
    actions: [],
    descriptions: [],
    common: [],
  }
  
  // Categorize vocabulary by keywords in English translation or category field
  vocabWords.forEach(item => {
    const english = item.english.toLowerCase()
    const category = item.category?.toLowerCase() || ''
    
    if (english.includes('family') || english.includes('mother') || english.includes('father') || 
        english.includes('parent') || english.includes('sister') || english.includes('brother') ||
        english.includes('child') || english.includes('son') || english.includes('daughter')) {
      topicGroups.family.push(item)
    } else if (english.includes('food') || english.includes('eat') || english.includes('drink') ||
               english.includes('rice') || english.includes('water') || english.includes('bread') ||
               english.includes('meat') || english.includes('fish') || english.includes('fruit') ||
               english.includes('vegetable') || category === 'food') {
      topicGroups.food.push(item)
    } else if (english.includes('time') || english.includes('day') || english.includes('night') ||
               english.includes('morning') || english.includes('evening') || english.includes('hour') ||
               english.includes('minute') || english.includes('week') || english.includes('month') ||
               english.includes('year') || category === 'time') {
      topicGroups.time.push(item)
    } else if (english.includes('color') || english.includes('red') || english.includes('blue') ||
               english.includes('green') || english.includes('yellow') || english.includes('black') ||
               english.includes('white')) {
      topicGroups.colors.push(item)
    } else if (english.includes('number') || english.includes('one') || english.includes('two') ||
               english.includes('three') || english.includes('four') || english.includes('five') ||
               english.includes('six') || english.includes('seven') || english.includes('eight') ||
               english.includes('nine') || english.includes('ten') || category === 'numbers') {
      topicGroups.numbers.push(item)
    } else if (english.includes('body') || english.includes('head') || english.includes('hand') ||
               english.includes('foot') || english.includes('eye') || english.includes('ear') ||
               english.includes('nose') || english.includes('mouth')) {
      topicGroups.body.push(item)
    } else if (english.includes('weather') || english.includes('rain') || english.includes('snow') ||
               english.includes('sun') || english.includes('wind') || english.includes('cloud')) {
      topicGroups.weather.push(item)
    } else if (english.includes('place') || english.includes('home') || english.includes('house') ||
               english.includes('school') || english.includes('store') || english.includes('restaurant') ||
               english.includes('station') || english.includes('park')) {
      topicGroups.places.push(item)
    } else if (category === 'verbs' || english.includes('go') || english.includes('come') ||
               english.includes('do') || english.includes('make') || english.includes('see') ||
               english.includes('say') || english.includes('know') || english.includes('think')) {
      topicGroups.actions.push(item)
    } else if (category === 'adjectives' || english.includes('big') || english.includes('small') ||
               english.includes('good') || english.includes('bad') || english.includes('new') ||
               english.includes('old') || english.includes('hot') || english.includes('cold')) {
      topicGroups.descriptions.push(item)
    } else {
      topicGroups.common.push(item)
    }
  })
  
  // Sort each group by frequency (if available) or keep original order
  Object.keys(topicGroups).forEach(topic => {
    topicGroups[topic].sort((a, b) => {
      const freqA = a.frequency || 0
      const freqB = b.frequency || 0
      return freqB - freqA // Descending order
    })
  })
  
  // Create 20 sessions with 5 vocabulary items each
  // Prioritize topics with more items, but try to distribute evenly
  const sessions: VocabularySession[] = []
  const topicOrder: VocabularyTopic[] = ['family', 'food', 'time', 'colors', 'numbers', 'body', 'weather', 'places', 'actions', 'descriptions', 'common']
  
  let sessionNumber = 1
  const usedItems = new Set<number>()
  
  // First pass: Fill sessions with items from each topic
  for (const topic of topicOrder) {
    const items = topicGroups[topic].filter(item => !usedItems.has(item.id))
    
    while (items.length >= 5 && sessionNumber <= 20) {
      const sessionItems = items.splice(0, 5)
      sessionItems.forEach(item => usedItems.add(item.id))
      
      sessions.push({
        id: `vocabulary_top100_${sessionNumber}`,
        batchNumber: sessionNumber,
        type: 'vocabulary_top100',
        vocabulary: sessionItems,
        topic: topic as VocabularyTopic,
        jlptLevel: 'N5',
      })
      sessionNumber++
    }
  }
  
  // Second pass: Fill remaining sessions with any remaining vocabulary
  const remainingVocab = vocabWords
    .filter(item => !usedItems.has(item.id))
    .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
    .slice(0, (20 - sessions.length) * 5)
  
  for (let i = 0; i < remainingVocab.length && sessionNumber <= 20; i += 5) {
    const sessionItems = remainingVocab.slice(i, i + 5)
    sessions.push({
      id: `vocabulary_top100_${sessionNumber}`,
      batchNumber: sessionNumber,
      type: 'vocabulary_top100',
      vocabulary: sessionItems,
      topic: 'common',
      jlptLevel: 'N5',
    })
    sessionNumber++
  }
  
  return sessions
}

/**
 * Get vocabulary session by batch number and type
 */
export function getVocabularySessionByBatch(
  batchNumber: number,
  type: 'vocabulary_top100' | 'vocabulary'
): VocabularySession | null {
  if (type === 'vocabulary_top100') {
    const sessions = getTop100VocabularySessions()
    return sessions.find(s => s.batchNumber === batchNumber) || null
  }
  
  // For post-top-100 vocabulary sessions, we'll implement this later
  // when we have the repeating pattern logic
  return null
}

/**
 * Get total number of vocabulary sessions for a type
 */
export function getTotalVocabularySessions(type: 'vocabulary_top100' | 'vocabulary'): number {
  if (type === 'vocabulary_top100') {
    return 20 // Top 100 vocabulary = 20 sessions
  }
  
  // For post-top-100, this will be dynamic based on vocabulary available
  return 0
}

/**
 * Get vocabulary by JLPT level, grouped by topic
 */
export function getVocabularyByLevelAndTopic(
  level: string,
  topic?: VocabularyTopic
): VocabularyItem[] {
  let vocab = getVocabByLevel(level).filter(item => item.type === 'word')
  
  if (topic && topic !== 'common') {
    // Filter by topic keywords (similar logic to getTop100VocabularySessions)
    // This is a simplified version - can be enhanced
    vocab = vocab.filter(item => {
      const english = item.english.toLowerCase()
      // Add topic-specific filtering logic here
      return true // Placeholder
    })
  }
  
  // Sort by frequency
  return vocab.sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
}

/**
 * Get topic name for display
 */
export function getTopicName(topic: VocabularyTopic): string {
  const names: Record<VocabularyTopic, string> = {
    family: 'Family',
    food: 'Food & Dining',
    time: 'Time & Dates',
    colors: 'Colors',
    numbers: 'Numbers',
    body: 'Body Parts',
    weather: 'Weather',
    places: 'Places & Locations',
    actions: 'Actions & Verbs',
    descriptions: 'Descriptions & Adjectives',
    common: 'Common Words',
  }
  return names[topic]
}

