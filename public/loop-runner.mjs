import { buildIterationInput } from './workflow.mjs';

export const MAX_ROUNDS = 5;
const MAX_EVIDENCE = 150;
const decisions = new Set(['continue', 'pivot', 'test', 'stop']);
const defaultId = () => globalThis.crypto?.randomUUID?.() || `round-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function checkAbort(signal) {
  if (!signal?.aborted) return;
  throw new DOMException('Research was stopped. Completed rounds remain saved.', 'AbortError');
}

function nextId(used, createId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = createId();
    if (typeof id === 'string' && id.trim() && !used.has(id)) { used.add(id); return id; }
  }
  throw new Error('A unique identifier could not be created for this research round.');
}

const claimKey = value => typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() : '';

/** Preserve user observations as user-reported hypotheses even when a model
 * omits their metadata or repeats the same claim as supposedly verified. */
function carryUserEvidence(previous, result, createId) {
  const prior = Array.isArray(previous?.evidence) ? previous.evidence.filter(item => item?.userProvided) : [];
  const reported = Array.isArray(result.evidence) ? result.evidence.filter(item => item?.userProvided) : [];
  const incoming = Array.isArray(result.evidence) ? result.evidence : [];
  if (!prior.length && !reported.length) return incoming.slice(0, MAX_EVIDENCE).map(item => ({ ...item }));
  const evidence = [], ids = new Set(), claims = new Set();
  for (const item of [...prior, ...reported]) {
    if (evidence.length >= MAX_EVIDENCE) break;
    const key = claimKey(item.claim);
    if (key && claims.has(key)) continue;
    const copy = { ...item, userProvided: true, status: 'hypothesis', sourceProvenance: 'user_reported' };
    const note = typeof item.note === 'string' ? item.note : '';
    const disclaimer = 'User-reported observation; not independently verified.';
    copy.note = note.includes(disclaimer) ? note : `${note.length > 24900 ? `${note.slice(0, 24800)} [shortened]` : note}${note ? ' ' : ''}${disclaimer}`;
    if (typeof copy.id !== 'string' || !copy.id.trim() || ids.has(copy.id)) copy.id = nextId(ids, createId);
    else ids.add(copy.id);
    if (key) claims.add(key);
    evidence.push(copy);
  }
  for (const item of incoming) {
    if (evidence.length >= MAX_EVIDENCE) break;
    if (item.userProvided || claims.has(claimKey(item.claim))) continue;
    const copy = { ...item };
    if (typeof copy.id !== 'string' || !copy.id.trim() || ids.has(copy.id)) copy.id = nextId(ids, createId);
    else ids.add(copy.id);
    evidence.push(copy);
  }
  return evidence;
}

function checkDecision(result) {
  if (!result?.iteration || !decisions.has(result.iteration.decision)) throw new Error('The AI returned an incomplete round without a usable next-step decision.');
  if (!['continue', 'pivot'].includes(result.iteration.decision)) return;
  const id = result.iteration.selectedRefinementId;
  if (!id || !Array.isArray(result.refinements) || !result.refinements.some(item => item.id === id)) {
    throw new Error('The AI recommended another round without choosing a valid direction. Your completed work remains saved.');
  }
}

/** Execute bounded research independently of the UI. Every onRound callback is
 * awaited before moving on, so callers can persist each finished round at once.
 * A previous round resumes the same investigation; steps counts only new work.
 * Explicit user permission to revisit a previous test/stop gate belongs to UI. */
export async function runResearchLoop({ input, previous = null, runId, title, maxRounds, steps = 1, provider, signal, analyze, onRoundStart = () => {}, onRound = () => {}, isValid = () => true, createId = defaultId } = {}) {
  if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > MAX_ROUNDS) throw new RangeError(`Research must have a total limit between 1 and ${MAX_ROUNDS} rounds.`);
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_ROUNDS) throw new RangeError(`Choose between 1 and ${MAX_ROUNDS} new research steps.`);
  if (typeof analyze !== 'function') throw new TypeError('A research operation is required.');
  const previousNumber = previous ? previous.loop?.round ?? 1 : 0;
  if (!Number.isInteger(previousNumber) || previousNumber < 0 || (previous && previousNumber < 1)) throw new Error('The saved research round number is invalid.');
  const usedIds = new Set(previous?.id ? [previous.id] : []);
  const investigationId = runId || previous?.loop?.runId || createId();
  const investigationTitle = title || previous?.loop?.title || input?.idea?.slice(0, 110) || previous?.input?.idea?.slice(0, 110) || 'Software idea';
  const completed = [];
  let lastRound = previous;
  let nextInput = previous ? buildIterationInput(previous) : { ...input };
  checkAbort(signal);
  if (previousNumber >= maxRounds) return { reason: 'limit', completed, lastRound };

  for (let offset = 0; offset < steps && previousNumber + offset < maxRounds; offset++) {
    checkAbort(signal);
    const round = previousNumber + offset + 1;
    await onRoundStart({ round, maxRounds, input: nextInput, previous: lastRound });
    checkAbort(signal);
    const response = await analyze(nextInput, { provider, signal, round, maxRounds });
    checkAbort(signal);
    if (!response || typeof response !== 'object' || Array.isArray(response) || !(await isValid(response))) throw new Error('The AI returned an incomplete round. Earlier rounds and your idea remain saved.');
    checkAbort(signal);
    checkDecision(response);
    const id = typeof response.id === 'string' && response.id.trim() && !usedIds.has(response.id) ? response.id : nextId(usedIds, createId);
    usedIds.add(id);
    const result = { ...response, id, evidence: carryUserEvidence(lastRound, response, createId), loop: { runId: investigationId, round, maxRounds, parentId: lastRound?.id || '', title: investigationTitle } };
    checkAbort(signal);
    await onRound(result);
    completed.push(result);
    lastRound = result;
    checkAbort(signal);
    const decision = result.iteration.decision;
    if (decision === 'test' || decision === 'stop') return { reason: decision, completed, lastRound };
    if (round >= maxRounds) return { reason: 'limit', completed, lastRound };
    nextInput = buildIterationInput(result);
  }
  return { reason: 'review', completed, lastRound };
}
