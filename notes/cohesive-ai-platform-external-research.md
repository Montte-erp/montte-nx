# Research: cohesive AI-native ERP platform architecture

## Summary
A cohesive AI-native ERP should not be a set of disconnected copilots. Best practice is to expose every module as governed business capabilities, connect those capabilities through business events and durable processes, and let a single agent/runtime dynamically load domain skills/tools while all actions remain auditable, evaluated, and policy-bound. SAP frames this as an AI-native stack where UX becomes intent-driven, the process layer becomes agentic, the foundation becomes a semantic system of context, and the platform supplies runtime, sandbox, observability, and governance; PostHog offers a pragmatic product pattern: one shared AI platform, single-loop agent, dynamic modes/skills, common tools, shared MCP/API surface, traces, evals, and feedback loops.

## Findings
1. **Use a process layer as the connective tissue, not module-to-module point integrations.** SAP’s AI-native architecture says business logic moves from being embedded inside applications to a process layer where applications, workflows, integrations, and agents collaborate to deliver outcomes. Applications become capability providers exposing stable APIs, events, and data that agents can discover and invoke. [SAP Process Layer](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer)

2. **Model the platform as four coordinated layers: experience, process, foundation/context, and platform/runtime.** SAP’s North Star states: UX evolves from static navigation to adaptive intent-driven execution; process evolves from predefined to agentic; foundation evolves from system of record to system of context; platform evolves from hosting apps to running governed enterprise agents with lifecycle, identity, routing, sandbox, observability, and governance. [SAP AI-native Vision](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision)

3. **The semantic/capability layer is what lets modules “talk.”** SAP emphasizes that context grounded in business data and semantics makes reasoning relevant, and that the process layer connects applications, APIs, events, and business capabilities so agents can reason across them. For a cohesive ERP, each module should publish a capability contract: domain objects, business verbs, events, permissions, approvals, invariants, and evidence requirements. [SAP AI-native Vision](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision)

4. **Prefer a single shared AI platform over per-module AI widgets.** PostHog warns against “death by random AI widgets” and uses one AI platform with shared architecture, reusable tools, consistent UX, and platform-level improvements that benefit all products. The core pattern is a single-loop agent extended by product/domain modes rather than separate black-box agents per feature. [PostHog AI Platform](https://posthog.com/handbook/engineering/ai/ai-platform)

5. **Use dynamic domain skills/modes instead of isolated product agents.** PostHog’s single-loop agent maintains full conversation context, has always-available core tools, and dynamically loads modes containing domain tools, prompts, and workflow trajectories. This preserves context and makes cross-module work explainable while still allowing domain expertise. [PostHog AI Platform Architecture](https://posthog.com/handbook/engineering/ai/architecture)

6. **Always provide universal discovery tools so the agent checks reality before acting.** PostHog highlights tools like search, read_data, read_taxonomy, enable_mode, and todo_write to avoid hallucinating product concepts and to track long-running tasks. In ERP terms, the agent should be able to discover modules, capabilities, schemas, permissions, entity relationships, open tasks, approvals, and business events before proposing actions. [PostHog AI Platform Architecture](https://posthog.com/handbook/engineering/ai/architecture)

7. **Expose product capabilities at the abstraction level where agents reason best.** PostHog’s agent-first guidance says if a human can do something in the product, an agent should usually be able to do it too, but not necessarily through one endpoint per UI action. Their v2 approach generates typed schemas from APIs, requires explicit opt-in before exposure, and exposes more semantic surfaces such as SQL where appropriate. [PostHog Golden Rules](https://posthog.com/newsletter/agent-first-product-engineering)

8. **Business events should be first-class, semantically named signals.** Microsoft Fabric defines a business event as a meaningful change in state that downstream workflows should act on, distinct from raw logs/metrics. It stresses real-time responsiveness, decoupling, consistent schema registry, and end-to-end observability. For ERP, events like `ContractActivated`, `InvoiceOverdue`, `PaymentFailed`, `FiscalDocumentAuthorized`, and `CustomerRiskChanged` are the language modules use to coordinate. [Microsoft Fabric Business Events](https://learn.microsoft.com/en-us/fabric/real-time-hub/business-events/business-events-overview)

9. **Event-driven architecture decouples modules and gives AI timely context.** SAP’s EDA reference describes API-first + event-first strategy, event brokers/meshes, publisher/consumer decoupling, event mediation, and integration between SAP and non-SAP systems. For an AI-native ERP, events should feed workflows, inboxes, analytics, eval datasets, memories, and agent context, but deterministic domain procedures still own writes. [SAP Designing Event-Driven Applications](https://architecture.learning.sap.com/docs/ref-arch/fbdc46aaae)

10. **Governed action is mandatory: gateway, identity, tool policy, HITL.** SAP says autonomous agents must operate through a single governed gateway with landscape boundaries, fine-grained tool access down to parameters, unified tool catalog, and human-in-the-loop routing for critical decisions. It also treats agents as first-class principals with scoped authorizations and records actions for accountability. [SAP Integration, Security, Ethics & Governance](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/integration-security-ethics-governance)

11. **Separate reasoning from deterministic execution.** SAP’s process layer recommends a deliberate mix: AI handles complex reasoning and orchestration, while deterministic execution ensures reliability for specific processes. In ERP this means the agent can frame, draft, analyze, route, and propose, but final financial/fiscal/billing writes go through typed procedures, workflows, approvals, and audit receipts. [SAP Process Layer](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer)

12. **Observability/evals must cover traces, events, and outcomes, not only final answers.** PostHog describes manual trace reviews, converting discoveries into evals, and using feedback from shipped changes to close the loop. SAP’s platform layer explicitly includes observability and governance as responsibilities of the agent runtime. ERP evals should include trajectory correctness, permission boundary compliance, evidence/citation, numeric grounding, approval behavior, event emission, and post-action outcome checks. [PostHog Golden Rules](https://posthog.com/newsletter/agent-first-product-engineering), [SAP AI-native Vision](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision)

## Compact architecture principles
1. **One platform brain, many domain skills.** One main AI runtime with domain skills/modes for finance, relationships, contracts, billing, payments, fiscal, workflows, inbox, integrations, and support.
2. **Modules are capability providers.** Every module exposes typed business verbs, read models, events, permissions, and approval policies.
3. **Process layer owns cross-module outcomes.** Cross-domain flows live as durable processes/workflows, not ad hoc calls hidden in UI components.
4. **Business events are the shared language.** All meaningful state transitions publish versioned events with schema, actor, tenant, correlation id, evidence, and causality.
5. **Semantic layer maps nouns and verbs.** Maintain canonical entities, relationships, metrics, lifecycle states, synonyms, policies, and tool contracts so AI and humans speak the same platform language.
6. **Agent plans; procedures execute.** AI proposes and orchestrates; deterministic procedures/workflows perform writes and emit receipts.
7. **Governed gateway before action.** Every tool/action passes auth, tenant isolation, parameter validation, risk tier, approval requirement, and audit.
8. **Observability is product infrastructure.** Capture prompt/model/tool versions, traces, event chains, approvals, outcomes, user feedback, and eval results.
9. **Evals are module contracts.** Each capability ships with offline/CI evals and production eval hooks for expected behavior, refusal boundaries, evidence, and regression protection.
10. **Interfaces adapt, contracts stay stable.** Chat, editor, inbox, dashboards, automations, desktop, and external MCP-like surfaces can vary, but they all consume the same capability/event/approval backbone.

## Suggested reference architecture
```text
Experience layer
  Chat / assistant panel / contract editor / inbox / dashboards / automation builder
  -> sends intent + frontend context, never authority

AI platform layer
  Single Montte agent runtime
  Core tools: discover_capabilities, load_skill, read_context, search_knowledge, todo/write_plan, request_approval
  Domain skills/modes: finance, relationships, contracts, billing, payments, fiscal, workflows, inbox, integrations
  Structured outputs + OpenUI cards + trace/eval hooks

Semantic & capability layer
  Capability catalog
  Business glossary and canonical entities
  Tool contracts and risk tiers
  Metrics/terms/policies
  Entity graph and evidence index

Process layer
  Durable workflows for cross-module outcomes
  Approval routes
  Human tasks
  Recovery/compensation
  Receipts

Domain module layer
  Finance, relationships, contracts, billing, payments, fiscal, workflows, inbox, integrations
  Typed procedures own writes
  Read models expose evidence and summaries
  Events publish state changes

Event layer
  business_events table/stream
  schema registry/versioning
  event consumers: inbox, workflows, AI memory, analytics, notifications, eval datasets

Governance & observability
  Agent identity, scoped permissions, audit logs
  Prompt/tool/model versions
  Traces, generations, evaluations
  Outcome feedback loop
```

## Sources
- Kept: SAP AI-native Vision (https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision) — primary architecture reference for layers, system of context, observability/governance responsibilities.
- Kept: SAP Process Layer (https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer) — primary source for capability-provider applications and agentic process orchestration.
- Kept: SAP Integration, Security, Ethics & Governance (https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/integration-security-ethics-governance) — primary source for governed gateway, agent identity, parameter-level policy, HITL.
- Kept: SAP Designing Event-Driven Applications (https://architecture.learning.sap.com/docs/ref-arch/fbdc46aaae) — primary source for API-first/event-first and event-driven integration.
- Kept: PostHog AI Platform (https://posthog.com/handbook/engineering/ai/ai-platform) — practical product architecture for shared AI infrastructure vs fragmented widgets.
- Kept: PostHog AI Platform Architecture (https://posthog.com/handbook/engineering/ai/architecture) — practical source for single-loop agent, dynamic modes, core discovery tools, MCP/shared capabilities.
- Kept: PostHog Golden Rules of Agent-first Product Engineering (https://posthog.com/newsletter/agent-first-product-engineering) — practical source for agent-capable APIs, semantic abstraction, context front-loading, trace review/evals.
- Kept: Microsoft Fabric Business Events (https://learn.microsoft.com/en-us/fabric/real-time-hub/business-events/business-events-overview) — concise definition of business events, schema consistency, observability, and decoupling.
- Dropped: Generic composable ERP blog posts — useful directional support, but less authoritative than SAP/PostHog/Microsoft primary docs.
- Dropped: ERA/ERPEDIA and vendor marketing posts — repeated the event-driven/AI-native thesis but with less implementation detail and less primary-source weight.
- Dropped: Academic event-driven ERP paper result — relevant but not needed for compact principles once primary architecture docs covered the point.

## Gaps
- Public sources give strong architectural patterns but not ERP-specific implementation details for Brazilian finance/fiscal/billing modules.
- More work is needed to map each Montte domain capability to exact events, tools, approvals, evals, and ownership boundaries.
- Next step: create a Montte capability/event matrix and a first PR sequence for `business_events`, `capability_catalog`, `approval_requests`, and AI skill/tool contracts.
