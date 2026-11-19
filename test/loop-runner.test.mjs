import test from 'node:test';
import assert from 'node:assert/strict';
import { runResearchLoop, MAX_ROUNDS } from '../public/loop-runner.mjs';
import { createExample } from '../public/examples.mjs';

const input = { idea: 'Coordinate one predictable office lunch window without building another delivery marketplace.', audience: 'Small office coordinators', market: 'UK', goal: 'Test a real payment commitment' };
const ids = () => { let index = 0; return () => `generated-${++index}`; };
function round(id, decision = 'continue') {
  const result = createExample('office-lunch').rounds[0];
  result.id = id;
  result.mode = 'live';
  result.input = { ...input };
  result.iteration.decision = decision;
  result.iteration.selectedRefinementId = result.refinements[1].id;
  return result;
}

test('multiple real orchestration steps feed the selected direction and evidence into the next request, saving each round first', async () => {
  const events = [], requests = [], saved = [];
  const first = round('first'), second = round('second', 'test');
  const selected = first.refinements[1];
  const result = await runResearchLoop({
    input, runId: 'investigation', title: 'Lunch test', maxRounds: 3, steps: 3,
    provider: 'openai', createId: ids(),
    onRoundStart: info => events.push(`start:${info.round}`),
    analyze: async (next, info) => {
      requests.push({ input: next, info });
      events.push(`analyze:${info.round}`);
      assert.equal(saved.length, info.round - 1);
      return info.round === 1 ? first : second;
    },
    onRound: async value => { saved.push(value); events.push(`saved:${value.loop.round}`); },
  });
  assert.equal(result.reason, 'test');
  assert.equal(result.completed.length, 2);
  assert.equal(result.lastRound.id, 'second');
  assert.deepEqual(events, ['start:1', 'analyze:1', 'saved:1', 'start:2', 'analyze:2', 'saved:2']);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].info.provider, 'openai');
  assert.ok(requests[1].input.idea.includes(selected.title));
  assert.ok(requests[1].input.idea.includes(selected.differentiation));
  assert.equal(requests[1].input.audience, selected.audience);
  assert.equal(requests[1].input.market, input.market);
  assert.equal(requests[1].input.goal, input.goal);
  assert.ok(requests[1].input.context.includes(first.counterIdeas[0].title));
  assert.ok(requests[1].input.context.includes(first.evidence[0].claim));
  assert.ok(requests[1].input.context.includes(selected.experiment));
  assert.deepEqual(saved[1].loop, { runId: 'investigation', round: 2, maxRounds: 3, parentId: 'first', title: 'Lunch test' });
  assert.equal(first.loop?.runId === 'investigation', false, 'provider results must not be mutated');
});

test('stop gates, per-click review, and total investigation budget end for different reasons', async () => {
  let calls = 0;
  const stopped = await runResearchLoop({ input, maxRounds: 5, steps: 5, analyze: async () => { calls++; return round('stopped', 'stop'); } });
  assert.equal(calls, 1);
  assert.equal(stopped.reason, 'stop');
  const review = await runResearchLoop({ input, maxRounds: 3, analyze: async () => round('review') });
  assert.equal(review.reason, 'review');
  assert.equal(review.completed.length, 1);
  const limit = await runResearchLoop({ input, maxRounds: 1, steps: 5, analyze: async () => round('last') });
  assert.equal(limit.reason, 'limit');
  const exhausted = await runResearchLoop({ input, previous: { ...round('already-done'), loop: { runId: 'old', round: 3 } }, maxRounds: 3, analyze: () => { throw new Error('Must not rerun a completed budget'); } });
  assert.equal(exhausted.reason, 'limit');
  assert.deepEqual(exhausted.completed, []);
  assert.equal(exhausted.lastRound.id, 'already-done');
  assert.equal(MAX_ROUNDS, 5);
});

test('an abort before execution or after a provider ignores the signal never saves a late result', async () => {
  const before = new AbortController();
  before.abort();
  let calls = 0, saves = 0;
  await assert.rejects(runResearchLoop({ input, maxRounds: 3, signal: before.signal, analyze: async () => { calls++; return round('unused'); }, onRound: () => saves++ }), error => error.name === 'AbortError');
  assert.equal(calls, 0);
  const late = new AbortController();
  await assert.rejects(runResearchLoop({ input, maxRounds: 3, signal: late.signal, analyze: async (_input, { signal }) => { calls++; assert.equal(signal, late.signal); late.abort(); return round('late'); }, onRound: () => saves++ }), error => error.name === 'AbortError');
  assert.equal(calls, 1);
  assert.equal(saves, 0);
});

test('cancelling between rounds preserves the completed callback and never starts another request', async () => {
  const controller = new AbortController(), saved = [];
  let calls = 0;
  await assert.rejects(runResearchLoop({ input, maxRounds: 3, steps: 3, signal: controller.signal,
    analyze: async () => { calls++; return round('finished'); },
    onRound: result => { saved.push(result); controller.abort(); },
  }), error => error.name === 'AbortError');
  assert.equal(calls, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 'finished');
});

test('provider failure keeps completed history and retry resumes its next round and parent without repeating it', async () => {
  const saved = [], failure = new Error('A temporary provider outage');
  let attempts = 0;
  await assert.rejects(runResearchLoop({ input, runId: 'persistent-run', title: 'Saved research', maxRounds: 3, steps: 3,
    analyze: async () => { if (++attempts === 2) throw failure; return round('original'); },
    onRound: result => saved.push(result),
  }), error => error === failure);
  assert.equal(saved.length, 1);
  const prior = saved[0];
  const retry = await runResearchLoop({ input, previous: prior, maxRounds: 3, steps: 2, createId: ids(),
    analyze: async (next, info) => {
      assert.equal(info.round, 2);
      assert.ok(next.idea.includes(prior.refinements[1].title));
      return round('original', 'test');
    },
    onRound: result => saved.push(result),
  });
  assert.equal(retry.reason, 'test');
  assert.equal(saved.length, 2);
  assert.equal(saved[0], prior);
  assert.notEqual(saved[1].id, prior.id, 'a repeated provider id must not overwrite the saved parent');
  assert.deepEqual(saved[1].loop, { runId: 'persistent-run', round: 2, maxRounds: 3, parentId: 'original', title: 'Saved research' });
});

test('a continue or pivot recommendation without a selected existing direction is rejected before saving', async () => {
  for (const decision of ['continue', 'pivot']) {
    for (const selectedRefinementId of ['', 'missing-id']) {
      const invalid = round('invalid', decision);
      invalid.iteration.selectedRefinementId = selectedRefinementId;
      let saves = 0;
      await assert.rejects(runResearchLoop({ input, maxRounds: 3, analyze: async () => invalid, onRound: () => saves++ }), /without choosing a valid direction/);
      assert.equal(saves, 0);
    }
  }
});

test('user observations survive all rounds as unverified hypotheses, deduplicated and bounded', async () => {
  const previous = round('previous', 'test');
  previous.loop = { runId: 'observations', round: 1, title: 'Observed research' };
  const observation = { ...previous.evidence[0], id: 'user-note', claim: 'Three coordinators reported late lunch changes.', note: 'Unverified conversations reported by the user.', userProvided: true, status: 'supported', sourceProvenance: 'native_web_search' };
  previous.evidence.push(observation);
  const saved = [];
  const result = await runResearchLoop({ input, previous, maxRounds: 3, steps: 2, createId: ids(),
    analyze: async (next, info) => {
      assert.ok(next.context.includes('USER-REPORTED; not independently verified'));
      const response = round(`round-${info.round}`, info.round === 3 ? 'test' : 'continue');
      response.input = next;
      response.evidence = [{ ...observation, id: 'model-copy', claim: '  THREE COORDINATORS reported late lunch changes.  ', status: 'supported', userProvided: undefined }, ...response.evidence];
      return response;
    },
    onRound: value => saved.push(value),
  });
  assert.equal(result.completed.length, 2);
  for (const analysis of saved) {
    const reports = analysis.evidence.filter(item => item.userProvided);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'user-note');
    assert.equal(reports[0].status, 'hypothesis');
    assert.equal(reports[0].sourceProvenance, 'user_reported');
    assert.match(reports[0].note, /not independently verified/);
    assert.equal(analysis.evidence.some(item => item.id === 'model-copy'), false);
    assert.equal(reports[0].note.match(/User-reported observation/g).length, 1);
  }
  assert.equal(observation.status, 'supported', 'the previous stored round must not be mutated');
  const crowded = round('crowded');
  crowded.evidence = Array.from({ length: 150 }, (_, index) => ({ ...observation, id: `user-${index}`, claim: `Observation ${index}`, note: 'A'.repeat(24999) }));
  crowded.loop = { runId: 'crowded-run', round: 1 };
  const bounded = await runResearchLoop({ previous: crowded, maxRounds: 2, analyze: async () => round('bounded', 'test') });
  assert.equal(bounded.lastRound.evidence.length, 150);
  assert.ok(bounded.lastRound.evidence.every(item => item.userProvided && item.status === 'hypothesis' && item.note.length <= 25000));
});

test('caller validation and callback errors propagate without claiming a completed round', async () => {
  let saves = 0;
  await assert.rejects(runResearchLoop({ input, maxRounds: 3, analyze: async () => round('bad'), isValid: () => false, onRound: () => saves++ }), /incomplete round/);
  assert.equal(saves, 0);
  const failure = new Error('Persistence unavailable');
  await assert.rejects(runResearchLoop({ input, maxRounds: 3, analyze: async () => round('not-saved'), onRound: () => { throw failure; } }), error => error === failure);
});
