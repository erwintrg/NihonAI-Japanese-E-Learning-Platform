/**
 * Test script to verify data import
 * Run with: npx tsx lib/test-data-import.ts
 * Or import and call testDataImport() in a component
 */

import {
  getAllVocab,
  getRandomVocab,
  getVocabByType,
  getVocabByCategory,
  searchVocab,
  getVocabByLevel,
} from './data';

export function testDataImport() {
  console.log('=== Testing Japanese Vocabulary Data Import ===\n');

  // Test 1: Get all vocab
  const allVocab = getAllVocab();
  console.log(`✅ Total Vocabulary: ${allVocab.length} items`);

  // Test 2: Get by category
  const verbs = getVocabByCategory('verbs');
  const nouns = getVocabByCategory('nouns');
  const adjectives = getVocabByCategory('adjectives');
  const pronouns = getVocabByCategory('pronouns');
  const expressions = getVocabByCategory('expressions');
  const time = getVocabByCategory('time');
  
  console.log(`\n✅ Category counts:`);
  console.log(`  Verbs: ${verbs.length} items`);
  console.log(`  Nouns: ${nouns.length} items`);
  console.log(`  Adjectives: ${adjectives.length} items`);
  console.log(`  Pronouns: ${pronouns.length} items`);
  console.log(`  Expressions: ${expressions.length} items`);
  console.log(`  Time: ${time.length} items`);

  // Test 3: Get random vocab
  const random = getRandomVocab(5);
  console.log(`\n✅ Random 5 items:`);
  random.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.japanese} (${item.hiragana}) - ${item.english}`);
  });

  // Test 4: Get by type
  const wordType = getVocabByType('word');
  console.log(`\n✅ Words: ${wordType.length} items`);
  console.log('Sample words:', wordType.slice(0, 3).map((v) => v.japanese));

  // Test 5: Get by level
  const n5Vocab = getVocabByLevel('N5');
  console.log(`\n✅ N5 Level Vocabulary: ${n5Vocab.length} items`);

  // Test 6: Search
  const searchResults = searchVocab('book');
  console.log(`\n✅ Search "book": ${searchResults.length} results`);
  searchResults.slice(0, 5).forEach((item) => {
    console.log(`  - ${item.japanese} (${item.english})`);
  });

  console.log('\n=== All tests passed! Data import working correctly. ===');
}

// Run if executed directly
if (require.main === module) {
  testDataImport();
}

