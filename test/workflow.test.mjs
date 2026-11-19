import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIterationInput, generateMvpPrompt } from '../public/workflow.mjs';
import { examples, createExample } from '../public/examples.mjs';
import { problemSchema, marketSchema, validateSchema, validateRelations } from '../lib/analysis-schema.mjs';

test('the selected refinement drives the next round without losing market and learning goal', () => {
  const analysis = createExample('office-lunch').rounds[0];
  analysis.iteration.selectedRefinementId = analysis.refinements[1].id;
  const selected = analysis.refinements[1];
  const next = buildIterationInput(analysis);
  assert.ok(next.idea.includes(selected.title));
  assert.ok(next.idea.includes(selected.problem));
  assert.equal(next.audience, selected.audience);
  assert.equal(next.market, analysis.input.market);
  assert.equal(next.goal, analysis.input.goal);
  assert.ok(next.context.includes(selected.experiment));
  assert.ok(next.context.includes(selected.successCriterion));
});

test('iteration context retains dissent, sources and user observations as unverified evidence', () => {
  const analysis = createExample('shift-handover').rounds[1];
  analysis.evidence.push({ id: 'user-observation', claim: 'Two workers said duplicate entry is a burden.', status: 'supported', sourceUrl: '', observedAt: '2026-11-19', note: 'Informal conversation, not independently checked.', userProvided: true });
  const next = buildIterationInput(analysis);
  assert.match(next.context, /USER-REPORTED; not independently verified/);
  assert.match(next.context, /Two workers said duplicate entry is a burden/);
  assert.ok(next.context.includes(analysis.counterIdeas[0].title));
  assert.ok(next.context.includes(analysis.counterIdeas[0].falsificationTest));
  assert.match(next.context, /LIMITATIONS AND UNRESOLVED RISKS/);
  assert.match(next.context, /hypotheses|unvalidated/i);
  assert.ok(next.context.includes(analysis.sources[0].url));
  assert.match(next.context, /proposed success criterion \(not achieved\)/i);
  assert.match(next.context, /curated worked example/i);
});

test('provider-reported source provenance survives abbreviation into the next round', () => {
  const analysis = createExample('office-lunch').rounds[0];
  analysis.mode = 'live';
  analysis.provider = { id: 'codex', provenance: 'provider_reported' };
  analysis.evidence = Array.from({ length: 30 }, (_, index) => ({ id: `source-${index}`, claim: 'A capability reported by a model.', status: 'supported', sourceProvenance: 'provider_reported', sourceUrl: 'https://example.test', note: 'Long scope note. '.repeat(2000) }));
  const next = buildIterationInput(analysis);
  assert.match(next.context, /Research source provenance: provider_reported/);
  assert.match(next.context, /not server-corroborated/);
  assert.match(next.context, /\[supported; source provenance: provider_reported\]/);
  assert.ok(next.context.length <= 8000);
});

test('large prior rounds stay within the API context limit without dropping entire dissent categories', () => {
  const analysis = createExample('consultation-booking').rounds[0];
  analysis.input.context = 'earlier context '.repeat(3000);
  analysis.counterIdeas = Array.from({ length: 40 }, (_, index) => ({ id: `objection-${index}`, title: `Objection ${index}`, argument: 'Unverified concern. '.repeat(600), falsificationTest: 'Observe the current workflow and report failure.' }));
  analysis.evidence = Array.from({ length: 40 }, (_, index) => ({ id: `observation-${index}`, claim: `Observation ${index} ${'uncertain '.repeat(1000)}`, status: 'hypothesis', note: 'No independent verification.', userProvided: index % 2 === 0 }));
  const next = buildIterationInput(analysis);
  assert.ok(next.context.length <= 8000);
  assert.match(next.context, /COUNTERIDEAS THAT MUST BE REVISITED/);
  assert.match(next.context, /USER OBSERVATIONS/);
  assert.match(next.context, /LIMITATIONS AND UNRESOLVED RISKS/);
  assert.match(next.context, /abbreviated|shortened/);
});

test('the MVP assignment contains the selected scope, acceptance metrics, risks and safe run requirements', () => {
  const analysis = createExample('consultation-booking').rounds[2];
  const prompt = generateMvpPrompt(analysis, { stack: 'Node.js and SQLite', platform: 'Responsive web', notes: 'Keep the pilot local.' });
  assert.ok(prompt.includes(analysis.refinements[0].title));
  assert.ok(prompt.includes(analysis.requirements[0].metric));
  assert.ok(prompt.includes(analysis.counterIdeas[0].title));
  assert.match(prompt, /Node\.js and SQLite/);
  assert.match(prompt, /Keep the pilot local/);
  assert.match(prompt, /one runnable Docker container/i);
  assert.match(prompt, /acceptance criteria/i);
  assert.match(prompt, /non-root container user/i);
  assert.match(prompt, /validate inputs at the server/i);
  assert.match(prompt, /dedicated settings form/i);
  assert.match(prompt, /never persist them in browser storage or return saved values/i);
  assert.match(prompt, /clearly labeled demo or manual mode/i);
  assert.match(prompt, /do not report unrun checks as passing/i);
  assert.match(prompt, /do not automatically deploy/i);
  assert.match(prompt, /curated worked example/i);
});

test('a stopped idea is gated in the builder assignment and empty research remains explicit', () => {
  const analysis = createExample('office-lunch').rounds[2];
  analysis.iteration.decision = 'stop';
  analysis.iteration.selectedRefinementId = '';
  const prompt = generateMvpPrompt(analysis);
  assert.match(prompt, /If decision is STOP, do not build the rejected business/);
  assert.match(prompt, /"decision": "stop"/);
  assert.doesNotThrow(() => buildIterationInput({}));
  const empty = buildIterationInput({ input: { idea: 'An original, unvalidated idea', market: 'UK', goal: 'Test one job' }, refinements: [] });
  assert.equal(empty.idea, 'An original, unvalidated idea');
  assert.match(empty.context, /None recorded/);
});

test('all curated examples contain three complete rounds, cited bounded capabilities and an unvalidated test gate', () => {
  assert.equal(examples.length, 3);
  for (const item of examples) {
    const project = createExample(item.id);
    assert.equal(project.rounds.length, 3);
    assert.equal(project.rounds.at(-1).iteration.decision, 'test');
    assert.match(item.label, /not validated demand/);
    for (const round of project.rounds) {
      assert.equal(round.mode, 'example');
      assert.ok(round.jtbd.length >= 3 && round.requirements.length >= 3);
      assert.ok(round.counterIdeas.length >= 3 && round.refinements.length >= 2);
      assert.ok(round.evidence.some(entry => entry.status === 'hypothesis'));
      for (const entry of round.evidence.filter(entry => entry.status === 'supported')) {
        assert.ok(round.sources.some(reference => reference.url === entry.sourceUrl));
      }
      validateSchema(Object.fromEntries(Object.keys(problemSchema.properties).map(key => [key, round[key]])), problemSchema);
      validateSchema(Object.fromEntries(Object.keys(marketSchema.properties).map(key => [key, round[key]])), marketSchema);
      validateRelations(round, round);
    }
    project.rounds[0].evidence[0].claim = 'Changed locally';
    assert.notEqual(createExample(item.id).rounds[0].evidence[0].claim, 'Changed locally');
  }
  assert.throws(() => createExample('missing-case'), RangeError);
});

test('every example tells the business change, comparison, buyer hypothesis and a concrete first test', () => {
  const fields = ['startingPoint', 'turningPoint', 'finalWedge', 'whoItServes', 'whyItCouldWin', 'biggestRisk', 'firstTest'];
  for (const item of examples) {
    const project = createExample(item.id);
    assert.deepEqual(project.story, item.story);
    for (const field of fields) assert.ok(typeof item.story[field] === 'string' && item.story[field].length >= 30, `${item.id}: ${field}`);
    assert.equal(item.story.learningPath.length, 3);
    for (const step of item.story.learningPath) {
      for (const field of ['title', 'change', 'why']) assert.ok(typeof step[field] === 'string' && step[field].trim());
    }
    assert.ok(item.story.comparison.length >= 3);
    for (const row of item.story.comparison) {
      for (const field of ['dimension', 'incumbent', 'proposal']) assert.ok(typeof row[field] === 'string' && row[field].trim());
    }
    assert.match(item.story.whyItCouldWin, /hypothesis/i);
    assert.match(item.story.firstTest, /proposed gate|proposed pass gate/i);
    assert.match(item.story.firstTest, /stop/i);
    assert.deepEqual(Object.keys(item.story.suggestedInput).sort(), ['audience', 'goal', 'idea', 'market']);
    assert.ok(item.story.suggestedInput.idea.length >= 20);
    project.story.learningPath[0].change = 'Local edit';
    assert.notEqual(createExample(item.id).story.learningPath[0].change, 'Local edit');
  }
});
