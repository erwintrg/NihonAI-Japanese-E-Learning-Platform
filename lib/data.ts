/**
 * Data utilities for Japanese vocabulary
 * Imports and manages JLPT vocabulary lists and anime terms
 */

import jlptN5Vocab from '../data/jlpt-n5-vocab.json';
import animeTerms from '../data/anime-terms.json';

export interface VocabularyItem {
  id: number;
  japanese: string;
  hiragana: string;
  romaji: string;
  english: string;
  level: string;
  type: string;
  anime_context?: string;
}

/**
 * Get all JLPT N5 vocabulary
 */
export function getJLPTN5Vocab(): VocabularyItem[] {
  return jlptN5Vocab as VocabularyItem[];
}

/**
 * Get all anime terms
 */
export function getAnimeTerms(): VocabularyItem[] {
  return animeTerms as VocabularyItem[];
}

/**
 * Get all vocabulary (combined)
 */
export function getAllVocab(): VocabularyItem[] {
  return [...jlptN5Vocab, ...animeTerms] as VocabularyItem[];
}

/**
 * Get random vocabulary items
 * @param count Number of items to return
 * @param includeAnime Whether to include anime terms
 */
export function getRandomVocab(
  count: number = 5,
  includeAnime: boolean = true
): VocabularyItem[] {
  const vocab = includeAnime ? getAllVocab() : getJLPTN5Vocab();
  const shuffled = [...vocab].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Get vocabulary by type (noun, verb, adjective, etc.)
 */
export function getVocabByType(type: string): VocabularyItem[] {
  return getAllVocab().filter((item) => item.type === type);
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
      item.english.toLowerCase().includes(lowerQuery)
  );
}

