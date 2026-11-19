// Curated worked examples. Product capabilities were checked against the linked
// primary sources on 2026-11-19. No customer interviews or demand tests took place.
const checkedAt = '2026-11-19';
const exampleLabel = 'Curated worked example — hypotheses, not validated demand';
const source = (url, title) => ({ url, title });
const references = {
  uber: source('https://help.uber.com/en-GB/ubereats/restaurants/article/how-to-place-a-group-order?nodeId=886fdace-3cee-4658-9d3c-7cadfbec5280', 'Uber Help: How to Place a Group Order'),
  doordash: source('https://help.doordash.com/en-us/business/article/guide-to-group-orders', 'DoorDash for Business: Group Orders Guide'),
  slack: source('https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack', 'Slack Help: Use a canvas in Slack'),
  teams: source('https://support.microsoft.com/en-us/teams/shifts/schedule-staff-shifts', 'Microsoft Support: Schedule staff shifts'),
  calendly: source('https://calendly.com/help/payments-faq', 'Calendly Help: Payments FAQs'),
  google: source('https://support.google.com/calendar/answer/13762729?hl=en', 'Google Calendar Help: Require payments for appointments'),
};

const stories = {
  'office-lunch': {
    startingPoint: '“An Uber Eats for office lunches.” A familiar product with a different audience, but no clear reason to switch.',
    turningPoint: 'Uber Eats already documents group orders, deadlines, spending limits and repeat routines. The possible opportunity is the administrator’s recurring coordination work, not another shared cart.',
    finalWedge: 'A fixed weekly lunch service for three nearby offices: one cutoff, existing suppliers and a human handling exceptions. Sell less coordination work before attempting a delivery marketplace.',
    whoItServes: 'The office administrator does the job; an office or operations budget owner would pay. A proposed route is direct introductions through managers of one office cluster—not a city-wide consumer launch.',
    whyItCouldWin: 'Hypothesis: predictable recurring lunches let a small operator reuse a roster and resolve exceptions with less administrator effort. Keeping existing suppliers avoids assuming that a new courier network is necessary. Neither savings nor profitable delivery has been demonstrated.',
    biggestRisk: 'Configured group ordering or a standing caterer may already be enough. Exception handling could cost more than the fee an office will pay.',
    firstTest: 'Offer three qualified offices a priced two-cycle pilot. Measure their current coordination time, every support minute and full supplier costs. Proposed pass gate: 50% less administrator time, two paid repeats and non-negative contribution. Stop or change the model if these fail.',
    learningPath: [
      { title: 'Reject the shared-cart clone', change: 'From a general office-delivery app to a recurring coordination job.', why: 'The named incumbents already document group ordering and budget controls; those features alone do not create a reason to buy.' },
      { title: 'Change the delivery model', change: 'From owning delivery to coordinating one weekly window with existing suppliers.', why: 'The first useful question is whether repeated coordination is valuable enough to pay for; a courier network would obscure that test with extra cost.' },
      { title: 'Sell a small service before building', change: 'From a feature roadmap to a three-office concierge pilot.', why: 'Only observed effort, costs and actual paid continuation can resolve the central business assumptions.' },
    ],
    comparison: [
      { dimension: 'What already exists', incumbent: 'Uber documents group orders with deadlines, spending limits and recurring routines; DoorDash documents a group cart and per-person budget.', proposal: 'Reuse available ordering capabilities; do not sell the shared cart as a new invention.' },
      { dimension: 'The job being tested', incumbent: 'An available group-order workflow is the baseline to configure and compare.', proposal: 'Reduce the administrator’s repeated exception handling for one predictable weekly lunch.' },
      { dimension: 'How the business might start', incumbent: 'The example does not assume it can outspend or replace established delivery platforms.', proposal: 'Recruit three nearby offices through direct introductions and agree a pilot fee with the budget owner.' },
      { dimension: 'Reason to stop', incumbent: 'Existing settings or a standing caterer may already satisfy the office.', proposal: 'Stop if added coordination does not save time, attract paid repeats and cover all pilot costs.' },
    ],
    suggestedInput: {
      idea: 'A fixed weekly lunch coordination service for three nearby offices, using existing food suppliers, one selection cutoff and a human exception handler instead of building a delivery marketplace.',
      audience: 'Office administrators coordinating 20–40 meals at one location each week, with an identified operations budget owner',
      market: 'One dense office district in a US city; verify local supplier coverage',
      goal: 'Find whether less recurring coordination is worth a separate paid service after comparing configured group-order tools and standing catering.',
    },
  },
  'shift-handover': {
    startingPoint: '“A simpler Slack or Microsoft Teams.” A broad replacement asks a whole team to change tools before a specific problem is clear.',
    turningPoint: 'Slack already documents shared canvas content, and Teams Shifts documents staff scheduling. A narrower question is whether unresolved work has an agreed owner when one shift hands over to the next.',
    finalWedge: 'A handover receipt for one facilities team: an unresolved item, its existing source link and an incoming owner. Keep the current messenger and test a single shift transition.',
    whoItServes: 'Outgoing and incoming workers use it; the facilities operations manager would pay. The proposed route is one consenting maintenance operator reached directly, with worker agreement before any pilot.',
    whyItCouldWin: 'Hypothesis: focusing on the moment responsibility changes may reduce unowned work without replacing everyday communication. A receipt is useful only if it outperforms a shared checklist and avoids duplicate entry; the incumbent tools may already be configurable to do the job.',
    biggestRisk: 'This could be a team practice or template rather than a business. A separate record can add work, and workers may experience receipt tracking as surveillance.',
    firstTest: 'Observe ten baseline handovers, then compare a minimal board with an existing-tool checklist for two weeks. Proposed gate: 50% fewer unowned items, at most two added minutes per handover, worker agreement and one paid continuation. Keep the template or stop if it performs as well.',
    learningPath: [
      { title: 'Choose a moment, not a messenger', change: 'From general communication to transfer of unresolved work across shifts.', why: 'A specific handover has an observable trigger, incoming owner and outcome; “simpler chat” does not define a business wedge.' },
      { title: 'Remove the switching demand', change: 'From replacing Slack or Teams to linking their existing context in a minimal receipt.', why: 'The proposed mechanism should reduce ambiguity without moving every conversation or asking workers to enter the same information twice.' },
      { title: 'Compare against the simplest alternative', change: 'From building integrations to a one-site comparison against a checklist.', why: 'If a worker-approved checklist produces the same result, another software product may have no incremental value.' },
    ],
    comparison: [
      { dimension: 'What already exists', incumbent: 'Slack canvas supports shared formatted content; Teams Shifts supports creating schedules, assigning shifts and handling shift requests.', proposal: 'Treat those tools as useful baselines, not as proven feature gaps.' },
      { dimension: 'The job being tested', incumbent: 'The team’s configured collaboration workflow may already meet its needs.', proposal: 'Make acceptance of unresolved work visible at one daily shift transition.' },
      { dimension: 'What the buyer might pay for', incumbent: 'Do not assume existing collaboration access creates demand for an additional subscription.', proposal: 'A proposed paid pilot measures fewer unowned items and acceptable handover effort for one operations manager.' },
      { dimension: 'Reason to stop', incumbent: 'A shared checklist or a clear ownership rule may be sufficient.', proposal: 'Stop if the board adds duplicate work, lacks worker agreement or fails to beat the configured baseline.' },
    ],
    suggestedInput: {
      idea: 'A minimal shift-handover receipt for a facilities team: unresolved task, existing source link and incoming owner. It sits beside Slack or Microsoft Teams rather than replacing the messenger.',
      audience: 'Facilities-maintenance teams with 8–25 workers across two daily shifts, with worker agreement and an operations buyer',
      market: 'One non-regulated UK facilities-maintenance site',
      goal: 'Test whether ownership is clearer than with an existing-tool checklist without extra duplicate work or inappropriate monitoring.',
    },
  },
  'consultation-booking': {
    startingPoint: '“Calendly, but clients pay when they book.” The apparent differentiator is already documented by existing scheduling products.',
    turningPoint: 'Calendly documents Stripe and PayPal payments; eligible Google Calendar accounts can require Stripe payment too. The possible job moves from collecting payment to making a paid consultation ready to begin.',
    finalWedge: 'A status-only preparation checklist for three independent CV-review consultants. Keep their current scheduler and payment processor; do not store client CVs in a new system.',
    whoItServes: 'The independent career consultant is both the user and proposed buyer. Reach a few qualified consultants directly or through an accessible professional community; access to that channel is an assumption to verify.',
    whyItCouldWin: 'Hypothesis: an exception view of missing preparation reduces chasing before paid CV reviews. This is a workflow experiment, not a claim that Calendly lacks intake features. A configured booking tool and manual checklist must be tested first.',
    biggestRisk: 'Extra preparation steps may lose more bookings than they improve. Low-volume consultants may prefer a reusable email checklist and see no reason to pay or migrate.',
    firstTest: 'Agree a priced pilot with three consultants and compare twenty eligible sessions with their baseline. Proposed gate: 30% less preparation-chasing time, no more than five percentage points worse completion and two paid continuations. Stop if the simpler checklist wins or client friction exceeds the benefit.',
    learningPath: [
      { title: 'Discard the payment-feature clone', change: 'From paid scheduling links to the job of preparing for a useful session.', why: 'Payment at booking already has direct alternatives; a niche label alone does not make that feature differentiated.' },
      { title: 'Keep the valuable existing tools', change: 'From a scheduler replacement to a checklist beside the consultant’s current booking and payment setup.', why: 'The proposed value is less preparation chasing, so replacing calendars or handling CV files would add scope before that value is demonstrated.' },
      { title: 'Measure the net effect', change: 'From adding intake features to comparing saved time, booking completion and paid continuation.', why: 'A process can improve preparation while harming sales. Both outcomes and the manual alternative matter.' },
    ],
    comparison: [
      { dimension: 'What already exists', incumbent: 'Calendly documents Stripe/PayPal payment at booking; Google documents Stripe-paid appointments for eligible Workspace subscriptions.', proposal: 'Use incumbent scheduling and payment capabilities instead of treating them as an invention.' },
      { dimension: 'The job being tested', incumbent: 'A configured scheduler and intake checklist may already be adequate.', proposal: 'Show preparation exceptions before one specific paid service: a CV review.' },
      { dimension: 'Scope and buyer', incumbent: 'The example makes no claim about an incumbent’s missing forms or its customers’ dissatisfaction.', proposal: 'Test with three independent consultants; retain completion status without collecting CV documents.' },
      { dimension: 'Reason to stop', incumbent: 'A reusable email checklist may have lower effort at small volumes.', proposal: 'Stop if paid continuation is absent or added intake friction outweighs the measured time saved.' },
    ],
    suggestedInput: {
      idea: 'A status-only pre-session checklist for independent career consultants selling paid CV reviews. Keep their current calendar and payment processor, show missing preparation and do not store CV files.',
      audience: 'Independent career consultants with enough paid CV-review sessions to compare preparation time and booking completion',
      market: 'Independent UK career consultants',
      goal: 'Find whether reduced preparation chasing produces enough net value to pay for, compared with configured booking tools and a manual checklist.',
    },
  },
};

export const examples = [
  { id: 'office-lunch', title: 'Competing with Uber Eats', category: 'Marketplace', description: 'From another delivery app to a test of office-lunch coordination.', rounds: 3, label: exampleLabel, story: stories['office-lunch'] },
  { id: 'shift-handover', title: 'Competing with Slack & Teams', category: 'B2B collaboration', description: 'From another team messenger to accountable shift handovers.', rounds: 3, label: exampleLabel, story: stories['shift-handover'] },
  { id: 'consultation-booking', title: 'Competing with Calendly', category: 'Vertical SaaS', description: 'From paid booking links to consultation-readiness checks.', rounds: 3, label: exampleLabel, story: stories['consultation-booking'] },
];

const job = (id, situation, motivation, outcome, priority = 'high') => ({ id, situation, motivation, outcome, priority });
const requirement = (id, title, why, metric, jobId) => ({ id, title, why, metric, jobIds: [jobId] });
const objection = (id, title, argument, falsificationTest, severity = 'high') => ({ id, title, argument, severity, falsificationTest });
const refinement = (id, title, audience, problem, differentiation, experiment, successCriterion) => ({ id, title, audience, problem, differentiation, experiment, successCriterion });
function alternative(id, name, type, description, strength, gap, reference, requirementIds) {
  return { id, name, type, description, strength, gap, sourceUrl: reference?.url || '', sourceTitle: reference?.title || '', requirementIds };
}
function evidence(id, claim, status, reference, note) {
  return { id, claim, status, sourceUrl: reference?.url || '', sourceTitle: reference?.title || '', observedAt: reference ? checkedAt : '', note };
}

const cases = {
  'office-lunch': {
    title: 'Office lunch without another delivery marketplace',
    market: 'One dense office district in a US city; local supplier coverage must be checked',
    goal: 'Test whether coordinating a recurring group lunch saves enough administrator time to pay for a separate service.',
    sources: [references.uber, references.doordash],
    competitors: [
      alternative('c1', 'Uber Eats group orders', 'direct', 'Shared group orders support deadlines and spending limits.', 'An existing way to collect individual choices.', 'Hypothesis to test: a narrow office workflow needs additional coordination; the cited page does not establish a missing feature.', references.uber, ['r1', 'r2']),
      alternative('c2', 'DoorDash for Business', 'direct', 'Group orders combine participant selections and let the creator set a per-person budget.', 'An existing business group-order workflow.', 'Hypothesis to test: a separate coordinator offers value after configuring existing group-order options.', references.doordash, ['r1', 'r2']),
      alternative('c3', 'A recurring arrangement with a local caterer', 'indirect', 'Proposed alternative: negotiate a standing menu and headcount directly.', 'Could reduce the need for a new marketplace; this is a comparison hypothesis.', 'Supplier availability, reliability and terms require local research.', null, ['r2', 'r3']),
      alternative('c4', 'Spreadsheet, chat and individual orders', 'status_quo', 'Baseline alternative to observe during discovery.', 'Requires no migration to a new product; comparative effort has not been measured.', 'Measure coordination time before assuming this baseline is painful.', null, ['r1', 'r3']),
    ],
    evidence: [
      evidence('e1', 'Uber documents group-order deadlines, spending limits and repeat routines.', 'supported', references.uber, 'Documented capability only. Availability and exact account configuration still need checking.'),
      evidence('e2', 'DoorDash documents a collective group cart and a creator-set per-person budget.', 'supported', references.doordash, 'Documented capability only; no claim about performance or local coverage.'),
      evidence('e3', 'Office administrators would pay separately to reduce recurring lunch coordination.', 'hypothesis', null, 'No interviews, paid commitments or delivery pilots have been conducted.'),
    ],
    counterIdeas: [
      objection('x1', 'The incumbents already cover the apparent feature gap', 'Group ordering and budgets are documented. A group cart alone is not a defensible differentiation.', 'Configure both available incumbent workflows with two administrators. Stop if they solve the job with acceptable effort.'),
      objection('x2', 'Operational costs could erase the value', 'A proposed coordinator still depends on restaurant capacity, fulfilment and exception handling. Better unit economics have not been demonstrated.', 'Run a costed concierge simulation using supplier quotes and all support time; reject the model if contribution is negative at a realistic pilot fee.'),
      objection('x3', 'Less coordination may not create willingness to pay', 'An administrator might accept the current process or prefer a caterer to another subscription.', 'Present a priced pilot to ten qualified administrators and record actual commitments, including refusals and reasons.'),
    ],
    snapshots: [
      {
        title: 'Another delivery app is an overly broad starting point',
        idea: 'Build an office food-delivery app that competes with Uber Eats by making group lunches easier.',
        audience: 'Office administrators coordinating team lunches',
        thesis: 'Group coordination is a possible job, but existing ordering features substantially overlap the initial idea.',
        nextStep: 'Separate food delivery from the administrator coordination job.',
        jobs: [
          ['When a team lunch is announced', 'Collect choices without chasing everyone', 'Measure minutes spent collecting a complete order'],
          ['When the office pays for lunch', 'Keep the order within a clear allowance', 'Measure exceptions requiring administrator intervention'],
          ['When people expect to eat together', 'Align the meal with the meeting window', 'Measure late or incomplete meals during a pilot'],
        ],
        requirements: [
          ['A shared order deadline', 'Support the collection job already served by group-order products', 'Administrator collection time per lunch'],
          ['Visible per-person allowance', 'Make exceptions visible before an order is submitted', 'Budget corrections per order'],
          ['A stated delivery window and exception owner', 'Avoid promising fulfilment the software cannot guarantee', 'Meals outside the agreed pilot window'],
        ],
        refinements: [
          ['Recurring office-lunch coordination', 'Administrators running the same weekly lunch', 'Repeated collection and exception handling', 'Test a narrow coordination service on top of existing suppliers', 'Observe three existing lunch workflows and map time spent', 'Proposed gate: at least two offices show repeated coordination work worth a priced pilot'],
          ['Configure existing tools first', 'Administrators who have not tried group-order settings', 'The pain may be a setup issue', 'Offer a setup service rather than a replacement app', 'Complete two tool-configuration sessions', 'Stop building if existing settings remove the observed friction'],
        ],
        change: 'Rejected the assumption that a shared cart is novel. Selected recurring coordination as a narrower hypothesis.',
        weakest: 'The current workflow consumes enough repeated administrator time to matter.',
      },
      {
        title: 'A recurring lunch is narrower, but still has substitutes',
        idea: 'Lunch Window is a proposed coordination service for one weekly office lunch, using existing local food suppliers rather than building a courier network.',
        audience: 'Office administrators coordinating 20–40 meals at one location on a fixed weekly day',
        thesis: 'The testable wedge is a repeated coordination job; owning delivery would add an unproven operational burden.',
        nextStep: 'Reduce the pilot to one office cluster and one menu-cutoff workflow.',
        jobs: [
          ['Before the same weekly lunch', 'Reuse the expected headcount and collect exceptions', 'Measure administrator minutes per recurring cycle'],
          ['Before sending a supplier the final order', 'Resolve missing choices and budget exceptions', 'Measure unresolved choices at cutoff'],
          ['When a supplier or participant changes plans', 'Know who handles the exception', 'Measure manual intervention time and cost'],
        ],
        requirements: [
          ['Reusable roster and explicit cutoff', 'Test repeat coordination without claiming automatic demand', 'Collection minutes compared with the current process'],
          ['Exception queue before supplier submission', 'Expose missing choices rather than silently replacing them', 'Unresolved exceptions at cutoff'],
          ['Named operator and cost log', 'Reveal the true concierge effort', 'Support minutes and contribution per lunch'],
        ],
        refinements: [
          ['One cluster, one fixed lunch window', 'Three nearby offices with a predictable weekly lunch', 'Repeated headcount changes before a fixed deadline', 'A minimal exception board with a human operator', 'Run two weekly cycles only after supplier feasibility and office commitments', 'Proposed gate: administrator time falls by 50%, and all pilot costs fit the agreed fee'],
          ['A local catering coordination service', 'Offices already comfortable with a fixed menu', 'Headcount changes rather than individual choice', 'Coordinate an existing caterer without new ordering software', 'Compare a fixed-menu concierge workflow with the order board', 'Choose the simpler workflow if outcomes are equivalent'],
        ],
        change: 'Removed the courier-network scope and restricted the concept to a recurring workflow at one site.',
        weakest: 'A coordination layer is better than configuring an incumbent or using a standing caterer.',
      },
      {
        title: 'Stop researching and price a tightly scoped concierge pilot',
        idea: 'Lunch Window is a proposed exception board for a fixed weekly lunch across three nearby offices, with one supplier submission cutoff and a human operator.',
        audience: 'Three office administrators in one local cluster, each coordinating 20–40 weekly meals',
        thesis: 'A small service pilot can test coordination value and support costs before any marketplace investment.',
        nextStep: 'Recruit qualified offices, record the current baseline and request priced pilot commitments.',
        jobs: [
          ['During the weekly collection period', 'See only missing or changed meal choices', 'Compare administrator active minutes with baseline'],
          ['At the supplier cutoff', 'Submit a complete and acknowledged headcount', 'Record completeness and submission errors'],
          ['After the lunch', 'Decide whether the saved effort justifies the fee', 'Record payment, repeat commitment and full operating cost'],
        ],
        requirements: [
          ['Minimal roster and exception board', 'Build only what the pilot needs to measure effort', 'Target at least 50% less administrator time; proposed, not achieved'],
          ['Manual supplier acknowledgment', 'Keep fulfilment responsibility explicit', 'Record every missed acknowledgement and late meal'],
          ['Pilot fee and cost ledger', 'Test willingness to pay and contribution honestly', 'Proposed gate: two of three offices pay to repeat and pilot contribution is non-negative'],
        ],
        refinements: [
          ['Run the concierge test', 'Three qualified offices that agree to a priced pilot', 'Unproven recurring coordination burden', 'A measured service experiment, not a claim to beat delivery platforms', 'Two lunch cycles with baseline timing, visible exception logging and a pre-agreed fee', 'Proposed gate: 50% less administrator time, two paid repeats and non-negative contribution; stop or pivot otherwise'],
          ['Stop if the baseline is already adequate', 'Offices whose current tools meet the job', 'There may be no material unsolved problem', 'Preserve the evidence and avoid unnecessary software', 'Try configured group ordering or a standing caterer before a custom build', 'Stop if administrators prefer the existing workflow at its current cost'],
        ],
        change: 'Replaced additional desk research with a bounded real-world experiment and explicit failure gates.',
        weakest: 'Time savings survive real exception handling and justify a separate paid service.',
      },
    ],
  },
  'shift-handover': {
    title: 'Shift handovers beside Slack and Microsoft Teams',
    market: 'Small non-regulated facilities-maintenance teams in the UK; workflow and procurement access unverified',
    goal: 'Test whether a structured shift handover reduces missed ownership compared with configured collaboration tools.',
    sources: [references.slack, references.teams],
    competitors: [
      alternative('c1', 'Slack canvas', 'direct', 'Slack provides a built-in surface for formatted content and shared notes.', 'Existing shared context within a collaboration tool.', 'Hypothesis to test: a handover-specific record improves on a configured canvas. No missing capability is established.', references.slack, ['r1', 'r2']),
      alternative('c2', 'Microsoft Teams Shifts', 'indirect', 'Shifts creates and manages team schedules and supports worker shift requests.', 'An existing shift-oriented workflow in Teams.', 'Scheduling is not identical to handover, but an existing Teams setup may be sufficient; test it before claiming a gap.', references.teams, ['r2', 'r3']),
      alternative('c3', 'A shared handover document', 'indirect', 'Proposed substitute: a shared checklist with a named incoming owner.', 'Might satisfy the job without another application; comparative performance is unknown.', 'Observe whether ownership and updates remain clear in the actual workflow.', null, ['r1', 'r2']),
      alternative('c4', 'Verbal handover and existing chat', 'status_quo', 'Baseline to observe with the team before proposing a replacement.', 'No new tool adoption; actual reliability has not been measured.', 'Do not assume handovers are failing without baseline records.', null, ['r1', 'r3']),
    ],
    evidence: [
      evidence('e1', 'Slack documents canvas as a built-in place to create and share formatted content.', 'supported', references.slack, 'This does not prove a handover product would outperform a canvas template.'),
      evidence('e2', 'Microsoft documents Shifts for creating schedules, assigning shifts and handling shift requests.', 'supported', references.teams, 'This establishes a related incumbent workflow, not a claim about its handover coverage.'),
      evidence('e3', 'Small facilities teams will adopt and pay for a dedicated handover board.', 'hypothesis', null, 'No missed-handover baseline, buyer interviews or paid pilot results exist.'),
    ],
    counterIdeas: [
      objection('x1', 'This may be a template rather than a product', 'A disciplined shared document or Slack canvas could provide the needed context without a new application.', 'Run the same handover checklist in an existing tool and in a prototype; stop if the configured baseline performs as well.'),
      objection('x2', 'A new board could create duplicate work', 'Workers may need to update both their existing tool and the proposed board, increasing errors and effort.', 'Observe a complete shift change and count duplicate entries, minutes and missed updates before and during a pilot.'),
      objection('x3', 'Accountability can become surveillance', 'Receipt tracking may be resisted or interpreted as monitoring. Adoption and appropriate access are unresolved.', 'Co-design a minimal receipt with workers and managers; do not proceed without agreement on purpose, access and retention.'),
    ],
    snapshots: [
      {
        title: 'Another general team messenger has no clear wedge',
        idea: 'Build a simpler workplace messenger to compete with Slack and Microsoft Teams.',
        audience: 'Small teams with workers on different shifts',
        thesis: 'General messaging is broad. A specific transfer-of-responsibility job is a more testable starting point.',
        nextStep: 'Describe one shift transition and compare it with existing shared-content tools.',
        jobs: [
          ['When the incoming shift starts', 'Understand unresolved work quickly', 'Time needed to identify the next action'],
          ['When handing work to another person', 'Make responsibility explicit', 'Unassigned items after handover'],
          ['When an item remains open', 'Find the original context', 'Time spent asking the previous shift for details'],
        ],
        requirements: [
          ['A concise handover summary', 'Test the context-transfer job before replacing chat', 'Time to identify open work'],
          ['A named owner for each open item', 'Make responsibility observable', 'Items without an agreed owner'],
          ['A link to the source context', 'Avoid creating another disconnected conversation', 'Follow-up requests for missing details'],
        ],
        refinements: [
          ['Facilities shift handovers', 'Small facilities-maintenance teams with a shift change', 'Open work changes owner across shifts', 'A structured handover record beside existing communication tools', 'Observe five shift changes and map the current baseline', 'Proposed gate: repeated ownership ambiguity with a manager willing to trial a change'],
          ['An existing-tool template', 'Teams already using Slack or Teams successfully', 'Inconsistent handover structure', 'Offer a checklist and team practice before custom software', 'Trial a shared template for one week', 'Stop building if the template meets the measured job'],
        ],
        change: 'Dropped the general messenger scope and isolated transfer of open work between shifts.',
        weakest: 'Ownership ambiguity is frequent and costly enough to justify intervention.',
      },
      {
        title: 'Narrow to open-work ownership without replacing chat',
        idea: 'Shift Receipt is a proposed handover board for small facilities teams: open item, incoming owner and source link, alongside Slack or Teams.',
        audience: 'Facilities-maintenance teams with 8–25 workers across two daily shifts',
        thesis: 'A handover record could focus on ownership, but must beat a configured template and avoid duplicate entry.',
        nextStep: 'Limit the prototype to one team, one shift change and unresolved items only.',
        jobs: [
          ['At the end of a facilities shift', 'List only unresolved work for the next shift', 'Outgoing-worker entry time'],
          ['At the start of the next shift', 'Accept responsibility for a specific open item', 'Open items with an acknowledged owner'],
          ['When details are unclear', 'Reach the existing source rather than repeat it', 'Duplicate data entry and clarification requests'],
        ],
        requirements: [
          ['An unresolved-items-only view', 'Reduce entry overhead and keep the scope narrow', 'Median handover entry time'],
          ['A minimal handover receipt', 'Test ownership clarity without inventing a monitoring requirement', 'Unacknowledged items after the agreed window'],
          ['Source links and explicit access rules', 'Reuse context with appropriate visibility', 'Duplicate entries and inappropriate-access incidents'],
        ],
        refinements: [
          ['One-site ownership pilot', 'One facilities team with two daily shifts', 'Unclear acceptance of unresolved work', 'A minimal receipt compared against a shared checklist', 'Alternate an existing-tool checklist and prototype over comparable shift changes', 'Proposed gate: fewer unowned items without adding more than two minutes per handover'],
          ['Handover practice improvement', 'A team whose tooling is already adequate', 'Unclear process rather than missing software', 'Agree an ownership rule using current tools', 'Run a facilitated process trial before product development', 'Choose the process-only option if it delivers equivalent outcomes'],
        ],
        change: 'Reduced the concept to unresolved work and removed any plan to replace the team messenger.',
        weakest: 'Structured ownership adds value beyond a template without creating duplicate work.',
      },
      {
        title: 'Test adoption and ownership clarity before integrations',
        idea: 'Shift Receipt is a proposed one-site pilot for unresolved facilities tasks, recording a source link, incoming owner and handover receipt with minimal retained data.',
        audience: 'One consenting facilities team with two daily shift changes and an identified operations buyer',
        thesis: 'A controlled workflow comparison can test adoption and ownership clarity before building integrations or expanding to regulated settings.',
        nextStep: 'Agree worker access and retention, record ten baseline handovers and run a two-week comparison.',
        jobs: [
          ['When closing a shift', 'Hand over unresolved work with minimal extra effort', 'Entry minutes per handover'],
          ['When accepting the next shift', 'Confirm the owner and next action', 'Unowned items after the handover window'],
          ['When evaluating the pilot', 'Choose whether to keep the workflow and fund it', 'Repeated use, buyer payment and worker acceptance'],
        ],
        requirements: [
          ['A three-field handover form', 'Keep the pilot easy to compare with a shared template', 'Proposed cap: two added minutes per handover'],
          ['Owner receipt and source-context link', 'Measure responsibility rather than message volume', 'Proposed target: 50% fewer unowned items relative to baseline'],
          ['Role access, deletion and a pilot cost log', 'Test appropriate use and commercial feasibility', 'Proposed gate: agreed worker acceptance and one paid continuation'],
        ],
        refinements: [
          ['Run the one-site comparison', 'One consenting facilities team and its operations buyer', 'Unproven ownership gaps across shifts', 'A minimal experiment against the configured existing-tool baseline', 'Ten baseline handovers followed by a two-week trial; report adverse effects and duplicated work', 'Proposed gate: 50% fewer unowned items, at most two added minutes, worker agreement and one paid continuation'],
          ['Stop or keep the template', 'Teams whose current process performs equally well', 'No demonstrated incremental product value', 'Retain a useful process improvement without another tool', 'Compare the same checklist in existing collaboration software', 'Stop the product if the baseline matches it or workers reject the additional record'],
        ],
        change: 'Stopped feature expansion and defined a comparison, adoption gate and data-access boundaries.',
        weakest: 'The team accepts a separate receipt and the buyer pays for measurable incremental value.',
      },
    ],
  },
  'consultation-booking': {
    title: 'Consultation readiness beyond a paid booking link',
    market: 'Independent UK career consultants offering paid remote consultations; demand not validated',
    goal: 'Test whether reducing unprepared consultations creates value beyond configured scheduling and payment tools.',
    sources: [references.calendly, references.google],
    competitors: [
      alternative('c1', 'Calendly Payments', 'direct', 'Calendly documents payment collection at booking through Stripe and PayPal, with plan-dependent access.', 'Paid booking already exists; payment alone is not a new wedge.', 'Hypothesis to test: a readiness workflow improves outcomes beyond a configured Calendly setup. Do not assume existing intake options are insufficient.', references.calendly, ['r1', 'r2']),
      alternative('c2', 'Google Calendar paid appointments', 'direct', 'Eligible Google Workspace accounts can require Stripe payment for appointment bookings.', 'An existing paid-appointment alternative.', 'Hypothesis to test: a separate readiness process adds value after configuring the current booking workflow.', references.google, ['r1', 'r2']),
      alternative('c3', 'Intake form, email and current booking tool', 'indirect', 'Proposed substitute: add an intake form and manual readiness check to the existing scheduler.', 'Might satisfy the job without migration; this has not been tested.', 'Compare total preparation effort before adding a separate product.', null, ['r2', 'r3']),
      alternative('c4', 'Manual email scheduling and invoicing', 'status_quo', 'Baseline alternative to observe during consultant discovery.', 'No new application to learn; actual time and error costs are unknown.', 'A low booking volume may make this baseline entirely adequate.', null, ['r1', 'r3']),
    ],
    evidence: [
      evidence('e1', 'Calendly documents collecting payment at booking using Stripe or PayPal; access depends on plan.', 'supported', references.calendly, 'This rebuts payment collection as a novel differentiator. It does not measure buyer demand.'),
      evidence('e2', 'Google Calendar documents Stripe-based paid appointments for eligible Workspace subscriptions.', 'supported', references.google, 'Feature eligibility must be checked for each account; no pricing or superiority claim is made.'),
      evidence('e3', 'Career consultants would pay for a separate consultation-readiness workflow.', 'hypothesis', null, 'No consultant interviews, booking experiments or paid commitments have taken place.'),
    ],
    counterIdeas: [
      objection('x1', 'Paid scheduling is already an incumbent feature', 'Both named alternatives document payment at booking. Repackaging this feature is weak differentiation.', 'Configure paid booking and intake in available existing tools; stop if they meet the complete consultant workflow.'),
      objection('x2', 'Extra intake could lower conversion', 'A readiness gate might reduce unprepared sessions while losing more bookings than it saves.', 'Compare completed bookings and preparation quality with the current process; track abandonment and net value together.'),
      objection('x3', 'Low-volume consultants may prefer a manual process', 'The time saved might not justify migration, subscription cost or additional handling of client documents.', 'Offer ten qualified consultants a priced pilot and compare against a manual intake checklist; record actual commitments.'),
    ],
    snapshots: [
      {
        title: 'A paid booking link already has direct competition',
        idea: 'Build a Calendly alternative that lets independent consultants take payment when clients book.',
        audience: 'Independent consultants selling remote sessions',
        thesis: 'Payment at booking is already documented by incumbents. A more specific unmet job is needed.',
        nextStep: 'Investigate preparation quality rather than claiming payment is a feature gap.',
        jobs: [
          ['When a client asks for a consultation', 'Agree a time and payment expectation', 'Time spent arranging one confirmed session'],
          ['Before the consultation', 'Receive the context needed to prepare', 'Sessions beginning without necessary context'],
          ['When a client is not ready', 'Decide whether to proceed or reschedule', 'Preparation-related rescheduling and lost time'],
        ],
        requirements: [
          ['A clear booking and payment state', 'Recognize the baseline already offered by incumbents', 'Manual follow-ups per confirmed booking'],
          ['A small pre-session checklist', 'Test preparation as a separate job', 'Sessions missing agreed preparation items'],
          ['An explicit readiness decision', 'Avoid silently confirming an unsuitable workflow', 'Time spent resolving unprepared sessions'],
        ],
        refinements: [
          ['Career-consultation readiness', 'Independent career consultants using an existing booking tool', 'A session starts without useful preparation context', 'Test a minimal preparation checklist before considering a scheduler replacement', 'Interview six qualified consultants and inspect anonymized workflow examples with consent', 'Proposed gate: repeated preparation problems and interest in a priced pilot'],
          ['Configure existing booking and forms', 'Consultants who need payment and basic intake', 'An incomplete setup may be the whole problem', 'Use existing scheduling and payment options', 'Complete two configuration walkthroughs', 'Stop building if the full job can be met with acceptable effort'],
        ],
        change: 'Rejected payment collection as the differentiator and selected preparation readiness for investigation.',
        weakest: 'Unprepared sessions are a repeated material problem for a specific consultant segment.',
      },
      {
        title: 'Focus on readiness, while preserving the existing scheduler',
        idea: 'Session Ready is a proposed checklist and readiness decision for independent career consultants, alongside their existing scheduler and payment processor.',
        audience: 'Independent career consultants selling paid CV-review sessions',
        thesis: 'A narrowly scoped preparation workflow might help, but a form and existing scheduler may already be sufficient.',
        nextStep: 'Test a manual checklist before building integrations or storing client documents.',
        jobs: [
          ['After a CV-review session is booked', 'Explain exactly what the client should prepare', 'Preparation completion before the deadline'],
          ['Before spending time on review', 'See whether the session is ready', 'Consultant minutes spent chasing missing context'],
          ['When preparation is incomplete', 'Choose a fair next action with the client', 'Extra handling time and booking abandonment'],
        ],
        requirements: [
          ['A concise checklist beside the existing booking', 'Test the proposed readiness job without replacing payments', 'Checklist completion and abandonment rate'],
          ['A manual ready/not-ready decision', 'Keep the pilot transparent and avoid opaque eligibility scoring', 'Chasing minutes per session'],
          ['Client-visible next steps and minimal data retention', 'Make added friction and privacy cost measurable', 'Reschedules, client complaints and retained sensitive documents'],
        ],
        refinements: [
          ['Document-free readiness pilot', 'Three independent CV-review consultants', 'Chasing preparation status before paid sessions', 'Track completion without uploading CVs into a new system', 'Use a checklist with status-only records for twenty sessions and compare with baseline', 'Proposed gate: 30% less chasing time without a material increase in abandonment'],
          ['Manual checklist service', 'Consultants with low booking volume', 'A process problem rather than a software gap', 'Keep a reusable email checklist in the existing tool', 'Compare the manual checklist against the proposed board', 'Choose the manual process if net effort is equal or lower'],
        ],
        change: 'Retained incumbent scheduling and payments, removed document storage and narrowed to paid CV reviews.',
        weakest: 'Readiness visibility saves more effort than the extra client steps cost.',
      },
      {
        title: 'Test the net value of a readiness workflow',
        idea: 'Session Ready is a proposed status-only pre-session checklist for three CV-review consultants, using their existing booking tools and storing no CV files.',
        audience: 'Three independent career consultants with enough paid CV-review volume for a twenty-session pilot',
        thesis: 'A small comparison can measure chasing time, client friction and paid continuation before any scheduler is built.',
        nextStep: 'Agree a priced pilot and deletion policy, record the baseline and compare twenty eligible sessions.',
        jobs: [
          ['When a client receives preparation instructions', 'Understand the minimum next step', 'Client completion rate and reported confusion'],
          ['When reviewing the upcoming diary', 'Identify sessions needing attention', 'Preparation-chasing minutes per session'],
          ['When deciding whether to retain the service', 'Compare total value with a configured scheduler and manual checklist', 'Net time saved, booking conversion and paid continuation'],
        ],
        requirements: [
          ['A simple completion-status checklist', 'Avoid unnecessary intake fields and document handling', 'Track completion and abandonment against baseline'],
          ['A consultant exception view', 'Measure the proposed time-saving mechanism', 'Proposed target: 30% less preparation-chasing time'],
          ['Manual next steps, deletion and a pilot fee', 'Make commercial and privacy assumptions explicit', 'Proposed gate: two of three consultants pay to continue, with no material conversion loss'],
        ],
        refinements: [
          ['Run the twenty-session comparison', 'Three consenting CV-review consultants', 'Unproven preparation-chasing overhead', 'A minimal readiness experiment alongside incumbent tools', 'Compare twenty eligible sessions with baseline; measure chasing time, abandonment, complaints and total handling cost', 'Proposed gate: 30% less chasing, no more than five percentage points worse completion and two paid continuations; thresholds must be agreed before testing'],
          ['Stop if the existing setup is enough', 'Consultants whose configured booking and checklist already work', 'No demonstrated incremental value', 'Keep the simpler existing workflow', 'Repeat the same measurement with an existing-tool checklist', 'Stop if net value is equal, demand is absent or client friction outweighs savings'],
        ],
        change: 'Replaced feature expansion with a paid comparison and explicit conversion and privacy constraints.',
        weakest: 'Consultants pay for incremental value after accounting for added intake friction.',
      },
    ],
  },
};

export function createExample(id) {
  const selected = cases[id];
  if (!selected) throw new RangeError(`Unknown worked example: ${id}`);
  const createdAt = new Date().toISOString();
  const rounds = selected.snapshots.map((snapshot, index) => {
    const isFinal = index === selected.snapshots.length - 1;
    const refinements = snapshot.refinements.map((item, itemIndex) => refinement(`f${itemIndex + 1}`, ...item));
    return {
      id: `example-${id}-round-${index + 1}`,
      createdAt,
      mode: 'example',
      input: {
        idea: snapshot.idea,
        audience: snapshot.audience,
        market: selected.market,
        goal: selected.goal,
        context: `${exampleLabel}. Round ${index + 1} of 3. ${index ? selected.snapshots[index - 1].change : 'Starting concept: no customer validation exists.'}`,
      },
      summary: { title: snapshot.title, thesis: snapshot.thesis, verdict: isFinal ? 'Ready for a bounded experiment; demand remains unvalidated.' : 'A narrower hypothesis to investigate, not a validated opportunity.', nextStep: snapshot.nextStep },
      jtbd: snapshot.jobs.map((item, itemIndex) => job(`j${itemIndex + 1}`, ...item)),
      requirements: snapshot.requirements.map((item, itemIndex) => requirement(`r${itemIndex + 1}`, ...item, `j${itemIndex + 1}`)),
      competitors: structuredClone(selected.competitors),
      counterIdeas: structuredClone(selected.counterIdeas),
      refinements,
      evidence: structuredClone(selected.evidence),
      sources: structuredClone(selected.sources),
      limitations: [
        exampleLabel,
        'These are three curated reasoning rounds, not an autonomous AI run or completed customer research.',
        `Primary-source product capabilities checked on ${checkedAt}; features, account eligibility and local availability may change.`,
        'Competitor gaps and superiority claims are hypotheses. The linked pages do not establish that a capability is absent.',
        'No interviews, baseline observations, transactions, delivery results or pilot outcomes were collected. All success thresholds are proposed experiment gates.',
        'A narrow segment can still have substantial competition or insufficient demand. A small pilot cannot establish market-wide absence of competition.',
      ],
      iteration: {
        decision: isFinal ? 'test' : 'continue',
        rationale: isFinal ? 'Further desk-based narrowing cannot resolve the remaining demand and workflow assumptions. Run the proposed experiment and accept a stop outcome.' : 'The initial scope overlaps documented incumbent capabilities. Narrow the job and compare the configured baseline before investing.',
        weakestAssumption: snapshot.weakest,
        changeSummary: snapshot.change,
        selectedRefinementId: refinements[0].id,
        newInformation: `Curated reasoning change only: ${snapshot.change} No new customer evidence was collected in this round.`,
        remainingRisks: [snapshot.weakest, ...selected.counterIdeas.map(item => item.title)],
      },
    };
  });
  return { title: selected.title, story: structuredClone(stories[id]), rounds };
}
