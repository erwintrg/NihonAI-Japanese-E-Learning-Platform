# Vocabulary Data Schema

## Structure

### Vocabulary Item
```typescript
{
  id: number;
  japanese: string;        // Kanji/hiragana/katakana
  hiragana: string;        // Hiragana reading
  romaji: string;         // Romanized reading
  english: string;        // English translation
  level: string;          // JLPT level (N5, N4, etc.) or "beginner"
  type: string;           // word, phrase, sentence
  category: string;       // pronouns, verbs, nouns, adjectives, expressions, etc.
  frequency?: number;     // Usage frequency (1-10, higher = more common)
  example_sentences?: Array<{
    japanese: string;
    hiragana: string;
    romaji: string;
    english: string;
  }>;
  notes?: string;         // Learning notes, mnemonics, context
  kanji_breakdown?: string; // Kanji components if applicable
}
```

## Categories

- **pronouns**: 私, あなた, これ, それ, etc.
- **verbs**: 食べる, 行く, 来る, etc.
- **nouns**: 本, 水, 学校, etc.
- **adjectives**: 大きい, 小さい, 新しい, etc.
- **expressions**: こんにちは, ありがとう, すみません, etc.
- **particles**: は, が, を, に, etc.
- **numbers**: 一, 二, 三, etc.
- **time**: 今日, 明日, 昨日, etc.
- **phrases**: Common multi-word expressions
- **sentences**: Example sentences for context

