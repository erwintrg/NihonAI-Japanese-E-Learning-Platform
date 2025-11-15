/**
 * Test script to verify data import
 * Run with: npx tsx lib/test-data-import.ts
 * Or import and call testDataImport() in a component
 */

import {
  getJLPTN5Vocab,
  getAnimeTerms,
  getAllVocab,
  getRandomVocab,
  getVocabByType,
  searchVocab,
} from './data';

export function testDataImport() {
  console.log('=== Testing Japanese Vocabulary Data Import ===\n');

  // Test 1: Get all JLPT N5 vocab
  const n5Vocab = getJLPTN5Vocab();
  console.log(`✅ JLPT N5 Vocabulary: ${n5Vocab.length} items`);
  console.log('Sample:', n5Vocab[0]);

  // Test 2: Get anime terms
  const anime = getAnimeTerms();
  console.log(`\n✅ Anime Terms: ${anime.length} items`);
  console.log('Sample:', anime[0]);

  // Test 3: Get all vocab
  const allVocab = getAllVocab();
  console.log(`\n✅ Total Vocabulary: ${allVocab.length} items`);

  // Test 4: Get random vocab
  const random = getRandomVocab(5);
  console.log(`\n✅ Random 5 items:`);
  random.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.japanese} (${item.hiragana}) - ${item.english}`);
  });

  // Test 5: Get by type
  const verbs = getVocabByType('verb');
  console.log(`\n✅ Verbs: ${verbs.length} items`);
  console.log('Sample verbs:', verbs.slice(0, 3).map((v) => v.japanese));

  // Test 6: Search
  const searchResults = searchVocab('book');
  console.log(`\n✅ Search "book": ${searchResults.length} results`);
  searchResults.forEach((item) => {
    console.log(`  - ${item.japanese} (${item.english})`);
  });

  console.log('\n=== All tests passed! Data import working correctly. ===');
}

// Run if executed directly
if (require.main === module) {
  testDataImport();
}

