// Top ~10,000 most common English words, used as a free local signal to tell
// generic query words apart from specific/identifying ones (brand, player,
// model names) without any external API call.
//
// Source: first20hours/google-10000-english (google-10000-english-no-swears.txt),
// derived from Peter Norvig's frequency analysis of Google's Trillion Word
// Corpus: https://github.com/first20hours/google-10000-english
import words from './commonWords.json';

export const COMMON_WORDS: ReadonlySet<string> = new Set(words as string[]);
