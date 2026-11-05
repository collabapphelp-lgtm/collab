/** Connection id for two people: both uids sorted and joined, so either side computes the same id. */
export const pairId = (a: string, b: string) => [a, b].sort().join('_');
