import { DataSet, englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';

/**
 * Blocks slurs, hate speech and sexually explicit terms in anything other members can read
 * (messages, names, prompt answers, the collab-partner note, snippet titles).
 * Everyday swearing is allowed: this is a music app. Catches disguised spellings (f4g, n1g…)
 * and ignores innocent words that contain a flagged word (Scunthorpe, assassin, therapist).
 */
const ALLOWED = new Set(['arse', 'ass', 'bastard', 'bitch', 'bollocks', 'dick', 'fuck', 'piss', 'prick', 'shit', 'sex', 'boob', 'tit', 'turd']);

const dataset = new DataSet<{ originalWord: string }>()
  .addAll(englishDataset)
  .removePhrasesIf((p) => ALLOWED.has(p.metadata?.originalWord ?? ''));

const matcher = new RegExpMatcher({ ...dataset.build(), ...englishRecommendedTransformers });

// Private chats (1:1 between two people who both chose to connect, or a group everyone joined) allow
// the "-a" spelling of the n-word, which is everyday language in a lot of the music on here. The hard-r
// spelling, every other slur and sexual terms stay blocked everywhere. Anything public (names, bios,
// prompts, snippet titles, group names, events) keeps the full filter, and anyone can still report a chat.
const privateMatcher = new RegExpMatcher({
  ...new DataSet<{ originalWord: string }>()
    .addAll(dataset)
    .removePhrasesIf((p) => p.metadata?.originalWord === 'nigger')
    .build(),
  ...englishRecommendedTransformers,
});
const HARD_R = /n[\W_]*[i1!|l][\W_]*g[\W_]*g+[\W_]*[e3][\W_]*r/i;

export function hasBlockedLanguage(...texts: (string | undefined | null)[]) {
  return texts.some((t) => !!t && (matcher.hasMatch(t) || HARD_R.test(t)));
}

/** For chat messages only. */
export function hasBlockedLanguageInChat(text: string) {
  return privateMatcher.hasMatch(text) || HARD_R.test(text);
}

export const BLOCKED_LANGUAGE_MESSAGE = 'That includes language that isn’t allowed on Collab. Please rephrase it.';
