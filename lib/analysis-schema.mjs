const text = { type: 'string' };
const choice = (...values) => ({ type: 'string', enum: values });
const list = (items) => ({ type: 'array', items });
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const problemSchema = object({
  jtbd: list(object({ id: text, situation: text, motivation: text, outcome: text, priority: choice('high', 'medium', 'low') })),
  requirements: list(object({ id: text, title: text, why: text, metric: text, jobIds: list(text) })),
});

export const marketSchema = object({
  summary: object({ title: text, thesis: text, verdict: text, nextStep: text }),
  competitors: list(object({
    id: text, name: text, type: choice('direct', 'indirect', 'status_quo'), description: text,
    strength: text, gap: text, sourceUrl: text, sourceTitle: text, requirementIds: list(text),
  })),
  counterIdeas: list(object({ id: text, title: text, argument: text, severity: choice('high', 'medium'), falsificationTest: text })),
  refinements: list(object({ id: text, title: text, audience: text, problem: text, differentiation: text, experiment: text, successCriterion: text })),
  evidence: list(object({
    id: text, claim: text, status: choice('supported', 'hypothesis', 'contradicted'),
    sourceUrl: text, sourceTitle: text, observedAt: text, note: text,
  })),
  limitations: list(text),
  iteration: object({
    decision: choice('continue', 'test', 'stop', 'pivot'),
    rationale: text,
    weakestAssumption: text,
    changeSummary: text,
    selectedRefinementId: text,
    newInformation: text,
    remainingRisks: list(text),
  }),
});

// Validate provider output as untrusted data, even when strict output is requested.
export function validateSchema(value, schema, location = 'analysis') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${location}`);
    if (Object.keys(value).some((key) => !Object.hasOwn(schema.properties, key))) throw new Error(`Unexpected field at ${location}`);
    for (const key of schema.required) {
      if (!Object.hasOwn(value, key)) throw new Error(`Missing ${location}.${key}`);
      validateSchema(value[key], schema.properties[key], `${location}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > 60) throw new Error(`Invalid list at ${location}`);
    value.forEach((item, index) => validateSchema(item, schema.items, `${location}[${index}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length > 12000) throw new Error(`Invalid text at ${location}`);
    if (schema.enum && !schema.enum.includes(value)) throw new Error(`Invalid choice at ${location}`);
  }
  return value;
}

export function validateRelations(problem, market) {
  const jobs = new Set(problem.jtbd.map((item) => item.id));
  const requirements = new Set(problem.requirements.map((item) => item.id));
  if (!problem.jtbd.length || !problem.requirements.length) throw new Error('The problem analysis is empty');
  for (const collection of [problem.jtbd, problem.requirements, market.competitors, market.counterIdeas, market.refinements, market.evidence]) {
    if (new Set(collection.map((item) => item.id)).size !== collection.length || collection.some((item) => !item.id.trim())) {
      throw new Error('Analysis identifiers must be unique and nonempty');
    }
  }
  if (problem.requirements.some((item) => !item.jobIds.length || item.jobIds.some((id) => !jobs.has(id)))) throw new Error('Invalid job reference');
  if (market.competitors.some((item) => item.requirementIds.some((id) => !requirements.has(id)))) throw new Error('Invalid requirement reference');
  if (!market.counterIdeas.length || !market.refinements.length) throw new Error('The critique or refinement is empty');
  const selected = market.iteration.selectedRefinementId;
  if (selected && !market.refinements.some((item) => item.id === selected)) throw new Error('Invalid selected refinement reference');
  if (['continue', 'pivot'].includes(market.iteration.decision) && !selected) throw new Error('A continuing iteration must select a refinement');
}
