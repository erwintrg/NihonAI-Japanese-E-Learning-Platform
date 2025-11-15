# Japanese Vocabulary Database

This directory contains categorized Japanese vocabulary data for the NihonAI Tutor app.

## Structure

- `categories/` - Vocabulary organized by category
  - `expressions.json` - Common expressions and greetings
  - `pronouns.json` - Pronouns (私, あなた, etc.)
  - `verbs.json` - Common verbs
  - `nouns.json` - Common nouns
  - `adjectives.json` - Adjectives
  - `phrases.json` - Common phrases and sentences
- `jlpt-n5-vocab.json` - Original JLPT N5 vocabulary (legacy)
- `anime-terms.json` - Anime-specific vocabulary (legacy)

## Data Sources

1. **Hirakan JLPT N5 Vocabulary List** - 748 essential N5 words
   - Source: https://hirakan.com/en-de/blogs/japanese/jlpt-n5-vocabulary-list
   
2. **Core2.3k Version 3** - 2,300 most common Japanese words
   - Format: Tab-separated with example sentences
   
3. **Jlab's Beginner Course** - Grammar-focused with anime examples
   - Follows Tae Kim's Grammar Guide
   
4. **WaniKani Ultimate** - Kanji and vocabulary with mnemonics
   - Comprehensive kanji learning resource

## Learning Methodology

The vocabulary is organized to support:
1. **Hiragana/Katakana** - Basic writing systems
2. **Basic words** - Foundation vocabulary
3. **Grammar snippets** - From Cure Dolly's Organic Japanese / Tae Kim
4. **Common readings** - Natural kanji learning through phrases
5. **Interest-based learning** - Vocabulary by topic/interest

## Categories

- **expressions**: Greetings, common phrases (こんにちは, ありがとう, etc.)
- **pronouns**: Personal pronouns (私, あなた, これ, etc.)
- **verbs**: Action words (食べる, 行く, 来る, etc.)
- **nouns**: Objects, people, places (本, 水, 学校, etc.)
- **adjectives**: Descriptive words (大きい, 小さい, etc.)
- **phrases**: Multi-word expressions and common sentences
- **time**: Time-related vocabulary (今日, 明日, etc.)
- **numbers**: Counting and numbers
- **particles**: Grammar particles (は, が, を, etc.)

## Usage

Import vocabulary using the utilities in `lib/data.ts`:

```typescript
import { getVocabByCategory, getAllVocab } from '@/lib/data';

// Get all expressions
const expressions = getVocabByCategory('expressions');

// Get all vocabulary
const allVocab = getAllVocab();
```

