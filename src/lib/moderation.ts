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

export function hasBlockedLanguage(...texts: (string | undefined | null)[]) {
  return texts.some((t) => !!t && matcher.hasMatch(t));
}

export const BLOCKED_LANGUAGE_MESSAGE = 'That includes language that isn’t allowed on Collab. Please rephrase it.';
