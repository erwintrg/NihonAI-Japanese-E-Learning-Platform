/**
 * Data utilities for Japanese vocabulary
 * Imports and manages categorized vocabulary lists with phrases and sentences
 */

// Legacy imports (will be migrated to categories)
import jlptN5Vocab from '../data/jlpt-n5-vocab.json';
import animeTerms from '../data/anime-terms.json';

// Category imports
import expressions from '../data/categories/expressions.json';
import pronouns from '../data/categories/pronouns.json';
import verbs from '../data/categories/verbs.json';
import nouns from '../data/categories/nouns.json';
import adjectives from '../data/categories/adjectives.json';
import phrases from '../data/categories/phrases.json';
import time from '../data/categories/time.json';

export interface ExampleSentence {
  japanese: string;
  hiragana: string;
  romaji: string;
  english: string;
}

export interface VocabularyItem {
  id: number;
  japanese: string;
  hiragana: string;
  romaji: string;
  english: string;
  level: string;
  type: string; // 'word', 'phrase', 'sentence'
  category?: string; // 'pronouns', 'verbs', 'nouns', 'adjectives', 'expressions', etc.
  frequency?: number; // 1-10, higher = more common
  example_sentences?: ExampleSentence[];
  notes?: string;
  kanji_breakdown?: string;
  anime_context?: string; // Legacy field
}

/**
 * Get all vocabulary from a specific category
 */
export function getVocabByCategory(category: string): VocabularyItem[] {
  switch (category) {
    case 'expressions':
      return expressions as VocabularyItem[];
    case 'pronouns':
      return pronouns as VocabularyItem[];
    case 'verbs':
      return verbs as VocabularyItem[];
    case 'nouns':
      return nouns as VocabularyItem[];
    case 'adjectives':
      return adjectives as VocabularyItem[];
    case 'phrases':
      return phrases as VocabularyItem[];
    case 'time':
      return time as VocabularyItem[];
    default:
      return [];
  }
}

/**
 * Get all JLPT N5 vocabulary (legacy)
 */
export function getJLPTN5Vocab(): VocabularyItem[] {
  return jlptN5Vocab as VocabularyItem[];
}

/**
 * Get all anime terms (legacy)
 */
export function getAnimeTerms(): VocabularyItem[] {
  return animeTerms as VocabularyItem[];
}

/**
 * Get all vocabulary (combined from all sources)
 */
export function getAllVocab(): VocabularyItem[] {
  return [
    ...expressions,
    ...pronouns,
    ...verbs,
    ...nouns,
    ...adjectives,
    ...phrases,
    ...time,
    ...jlptN5Vocab,
    ...animeTerms,
  ] as VocabularyItem[];
}

/**
 * Get vocabulary by type (word, phrase, sentence)
 */
export function getVocabByType(type: string): VocabularyItem[] {
  return getAllVocab().filter((item) => item.type === type);
}

/**
 * Get random vocabulary items
 * @param count Number of items to return
 * @param category Optional category filter
 * @param minFrequency Minimum frequency (1-10)
 */
export function getRandomVocab(
  count: number = 5,
  category?: string,
  minFrequency: number = 1
): VocabularyItem[] {
  let vocab = category
    ? getVocabByCategory(category)
    : getAllVocab();

  // Filter by frequency if specified
  if (minFrequency > 1) {
    vocab = vocab.filter(
      (item) => (item.frequency || 1) >= minFrequency
    );
  }

  const shuffled = [...vocab].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Get vocabulary by JLPT level
 */
export function getVocabByLevel(level: string): VocabularyItem[] {
  return getAllVocab().filter((item) => item.level === level);
}

/**
 * Search vocabulary by Japanese, English, or romaji
 */
export function searchVocab(query: string): VocabularyItem[] {
  const lowerQuery = query.toLowerCase();
  return getAllVocab().filter(
    (item) =>
      item.japanese.includes(query) ||
      item.hiragana.includes(query) ||
      item.romaji.toLowerCase().includes(lowerQuery) ||
      item.english.toLowerCase().includes(lowerQuery) ||
      item.notes?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get phrases (multi-word expressions)
 */
export function getPhrases(): VocabularyItem[] {
  return getAllVocab().filter((item) => item.type === 'phrase');
}

/**
 * Get example sentences for a vocabulary item
 */
export function getExampleSentences(itemId: number): ExampleSentence[] {
  const item = getAllVocab().find((v) => v.id === itemId);
  return item?.example_sentences || [];
}

/**
 * Get vocabulary sorted by frequency (most common first)
 */
export function getVocabByFrequency(
  category?: string,
  limit?: number
): VocabularyItem[] {
  let vocab = category ? getVocabByCategory(category) : getAllVocab();
  
  vocab = vocab.sort((a, b) => {
    const freqA = a.frequency || 0;
    const freqB = b.frequency || 0;
    return freqB - freqA; // Descending order
  });

  return limit ? vocab.slice(0, limit) : vocab;
}
