---
name: job-search-report
description: "Use this skill whenever the user wants to run a job search and receive a structured, professionally formatted Word (.docx) report of matching roles. Triggers include phrases like 'find me jobs', 'look for open roles', 'search for [title] positions', 'run my job search', 'generate a job report', 'find new postings for me this week', or any request that combines role discovery with a written deliverable. Also use when the user references this skill directly (e.g., 'use the job search report skill') or mentions their recurring job-search workflow. This skill orchestrates the full pipeline: gathering required inputs from the user, running searches across available job-board connectors, filtering by hard requirements, and generating a branded Word document of ranked role profiles. Do NOT use for resume tailoring, interview prep, or salary research requests that don't involve active job discovery."
---

# Job Search Report

Run a multi-connector job search for the user and deliver the results as a branded Word (.docx) report. The skill is deliberately generic — it works for any role type, location preference, and compensation level, because the user provides the filters at runtime.

## When to use this skill

Trigger whenever the user wants active role discovery plus a written deliverable. Don't use it for resume work, interview prep, or questions that don't involve searching live job listings.

## Bundled resources

| File | Purpose |
|------|---------|
| `scripts/generate_report.js` | The canonical docx-js report generator. Read the SCHEMA comment at the top for the full JSON input structure. Run: `node scripts/generate_report.js <input.json> <output.docx>` |
| `assets/sample_input.json` | Worked example of the JSON input — use this as a template when building the input file |
| `references/report_spec.md` | Section-by-section content specification — what goes in each field and why |
| `references/docx_styling.md` | Visual design rules — colors, typography, table patterns, status coding |

## Workflow at a glance

There are five phases. Do not skip any of them, and do not interleave them.

1. **Collect inputs** — five required categories (see Phase 1 below).
2. **Verify connectors** — check what job-search tools are available in the current session.
3. **Present query plan & get approval** — show the user a table of every query + filters before any search runs. Do not proceed until the user approves.
4. **Run the search** — two-stage fetch (screening pass → detail pass), plus a hybrid location pass where relevant.
5. **Generate the report** — produce a branded .docx file using `scripts/generate_report.js`. Read `references/report_spec.md` and `references/docx_styling.md` before building the JSON input.

Each phase should be completed before starting the next. Do not run any search until the query plan has been explicitly approved by the user.

---

## Phase 1 — Collect required inputs

Before any searching happens, gather these five input categories from the user.

1. **Hard Requirements** — compensation floor, location (remote / hybrid metro / onsite), role-title keywords, active-status (always enforced).
2. **Soft Criteria / Quality Ranking** — stability, culture rating, innovation/AI-forward preference, work-life balance. These do not filter results out; they are surfaced per role in the report.
3. **Search Query Terms** — list of role-title keyword strings (max 10 recommended) that get run as separate queries. **Keywords must contain only role title and specialization variations — never embed location, city names, state names, or workplace type (hybrid/remote/onsite) in the keyword string.** Location and workplace type are always applied as separate structured filter parameters by the connector, not as text in the query. Each keyword surfaces different roles, so don't collapse them into one broad query.

   Good examples:
   - `"Senior Technical Program Manager"`
   - `"Technical Program Manager CRM"`
   - `"TPM customer experience analytics"`

   Bad examples (location/type embedded — do not do this):
   - `"Senior Technical Program Manager Denver hybrid"` ✗
   - `"Technical Program Manager remote Colorado"` ✗

4. **Date Filter** — how recent postings should be. Valid options: `TODAY` (last 24h), `THREE` (3 days), `SEVEN` (7 days), `FOURTEEN` (14 days), `THIRTY` (30 days). Default to `SEVEN` if the user has no preference.
5. **Role Specialization** — free-form candidate profile covering Identity, Priorities, and Filters (ideal vs. avoid). This is used for the per-role alignment assessment in the report, not for filtering.

Ask for all five categories before searching. Use the `AskUserQuestion` tool where the question has a small set of discrete options (e.g., date filter, location type), and use plain prose prompts for the open-ended ones (keywords, role specialization).

Once collected, echo the inputs back as a short confirmation summary before moving on. This catches mistakes before any expensive searching runs.

---

## Phase 2 — Verify search connectors

The skill works with whatever job-search connectors are available in the current session. Before searching:

1. Check what job-search tools are available in the current tool list.
2. Recommended layers: Dice/LinkedIn, Indeed, an ATS aggregator like Job Bot, and a web search like Apify RAG Browser or WebSearch.
3. Tell the user which connectors you'll use and flag any missing layers as a coverage gap.
4. **If no job-search connectors are available at all, stop and warn the user.** Do not attempt to fabricate results.

---

## Connector Rules

The connectors available for a search session depend on which tools the user
has enabled. Before searching, verify which connectors are active (Phase 2).
Apply the rules below only for connectors that are available in the session.

---

### Date Filter

At the start of each session, confirm the date range with the user. Valid
values:

| Value | Meaning |
|-------|---------|
| `ONE` | Posted in the last 24 hours |
| `THREE` | Posted in the last 3 days |
| `SEVEN` | Posted in the last 7 days |
| `FOURTEEN` | Posted in the last 14 days |
| `THIRTY` | Posted in the last 30 days |

The selected value is a global filter applied across all connectors and all
keyword queries for the session. It is confirmed once at session start and does
not change mid-run.

---

### Per-Connector Date Filter Formatting

Each connector accepts the date range parameter differently. Apply the session
filter value using the format for each connector:

| Connector | Parameter name | Format example (for SEVEN) | Notes |
|---|---|---|---|
| Dice / LinkedIn MCP | `posted_date` | `"SEVEN"` | Enum string: ONE, THREE, SEVEN, etc. — enforced server-side |
| Indeed MCP | `posted_date` | `"SEVEN"` | Does not support ONE or THREE; see fallback rule below |
| Job Bot MCP | `datePosted` | `"7days"` | String format: "1days", "3days", "7days", etc. |
| Apify RAG Browser | N/A | Not supported | Exempt from date filter; see Apify rule below |

---

### Connector-Specific Rules

#### Dice / LinkedIn MCP
No additional constraints. Apply the session date filter using `posted_date`
as an enum string. All other Stage 1 prohibited filters apply as documented in
the Data Fetch Strategy section.

#### Indeed MCP

Indeed requires `location`, `country_code`, and `posted_date` as parameters on
every call. Because `location` is a mandatory input rather than an optional
filter, Indeed cannot be queried in a single pass. Run **two passes per
keyword**, derived from the user's location hard requirements collected in
Phase 1:

| Pass | `query` | `location` | `country_code` | `posted_date` | Purpose |
|------|---------|------------|----------------|---------------|---------|
| A | `[keyword]` | `[user's remote value]` | `[user's country code]` | See date rule below | Surfaces remote roles |
| B | `[keyword]` | `[user's hybrid metro city]` | `[user's country code]` | See date rule below | Surfaces hybrid and local roles |

Pass B only applies if the user has specified a hybrid metro location in their
hard requirements. If the user is remote-only, run Pass A only.

Use the city name only for metro location values — job posters are not required
to enter a state, so including the state may exclude valid postings.

`country_code` should be confirmed with the user during Phase 1 input
collection.

**Date filter rule for Indeed:**
Indeed does not support `ONE` or `THREE` as native `posted_date` values. Map
the session filter as follows:

| Session filter | `posted_date` value to pass |
|----------------|-----------------------------|
| `ONE` | `"SEVEN"` |
| `THREE` | `"SEVEN"` |
| `SEVEN` | `"SEVEN"` |
| `FOURTEEN` | `"FOURTEEN"` |
| `THIRTY` | `"THIRTY"` |

These behaviors are permanent connector constraints and should never be flagged
as issues in the Search Health table. When all keyword queries completed using
these workarounds, set Indeed MCP status to **Full** with a standing
informational note. Reserve **Partial** or **Error** only for cases where
queries failed or returned no results despite correct parameters.

#### Job Bot MCP

Job Bot covers ATS-hosted postings across Greenhouse, Lever, Ashby, and
SmartRecruiters. Apply `query` and `datePosted` only at Stage 1 — no other
parameters. Job Bot has historically returned zero qualifying results for QA
and similar role types within tight date windows (3 days or fewer). If it
returns zero results across all keywords, log it as **Error** in the Search
Health table and note the pattern. Consider the connector unreliable for
time-sensitive searches until a clean result is observed in a fresh session.

#### Apify RAG Browser

Apify has no structured date parameter. All title-matched Apify results pass
through to Stage 2, where the posting date is read from the full page content.
Apify-sourced roles are exempt from the session date filter but must have their
posting date noted clearly in the role card. Apify serves two purposes:
- Run Google search queries targeting job boards not covered by other
  connectors (e.g., Greenhouse, Remotive, Himalayas, Wellfound)
- Fetch any job posting URLs that are blocked by WebFetch (LinkedIn,
  Glassdoor, certain ATS pages)

#### WebSearch / WebFetch

Used for company research, Glassdoor lookups, posting date verification, and
active status confirmation. Not a primary search connector — do not use for
keyword job queries.

---

## Phase 3 — Present query plan & get approval

**Do not run any searches until the user explicitly approves the query plan.**

After collecting inputs and verifying connectors, build the full query plan and present it as a table. Each row is one keyword query — location, workplace type, date, and salary are global filters applied to every row via the connector's structured parameters, not embedded in the keyword string.

### Query plan table format

| # | Role Keywords (query string) | Location | Workplace | Date Filter | Salary Floor |
|---|------------------------------|----------|-----------|-------------|--------------|
| 1 | Senior Technical Program Manager | Denver, CO | Hybrid | Today | $150,000 |
| 2 | Technical Program Manager CRM | Denver, CO | Hybrid | Today | $150,000 |
| 3 | TPM customer experience analytics | Denver, CO | Hybrid | Today | $150,000 |
| … | … | … | … | … | … |

**Rules for building the table:**
- The **Role Keywords** column contains only role-title and specialization terms. No city names, state names, or workplace type words (hybrid/remote/onsite).
- The **Location**, **Workplace**, **Date Filter**, and **Salary Floor** columns are identical on every row — they are global filters, not per-query variations.
- Derive 8–10 keyword variations from the user's role title and specialization inputs. Cover: seniority variants, specialization terms (e.g., CRM, analytics, customer experience), abbreviated titles (e.g., TPM), and adjacent titles the user might be qualified for.

After presenting the table, ask the user:
- Do the keyword queries look right, or would you like to add, remove, or change any?
- Do the global filters look correct?

**Only proceed to Phase 4 once the user has confirmed the query plan.** If the user requests changes, update the table and re-present before proceeding.

---

## Phase 4 — Run the search

The search runs in two sequential stages. Complete all Stage 1 queries across every connector before beginning any Stage 2 work.

---

### Stage 1 — Screening pass (title + date only)

Query every connector for every keyword using **keyword + date filter only**. No other filters.

**Stage 1 permitted parameters:**
- Keyword query string (role title and specialization terms only)
- Date filter (e.g., `posted_date: THREE`)

**Stage 1 prohibited parameters — do not apply any of these at Stage 1:**
- `workplace_types` / Remote structured filter
- `salaryMin` / salary floor
- `location` / city or metro filter

Applying location or workplace filters at Stage 1 causes silent under-inclusion: roles tagged inconsistently by employers are dropped before you can read the description and confirm eligibility. All three filters belong in Stage 2.

> **Exception:** The Hybrid Metro Pass (described below) is a separate, dedicated pass that intentionally includes a location parameter. It is not part of the standard Stage 1 keyword loop.

Apply two filters to the raw Stage 1 results immediately:
1. **Title filter** — keep only roles whose title contains a qualifying keyword. Apply loosely; err on the side of inclusion.
2. **Date filter** — keep only roles posted within the date window. Apply per-connector rules (some connectors enforce this server-side; others require client-side filtering).

Roles that fail either filter are dropped. Do not proceed to Stage 2 for them.

---

### Stage 2 — Detail pass (full descriptions + location/salary/active-status verification)

For each role that survived Stage 1, fetch the full job description and apply the remaining filters in this order:

1. **Location** — confirm the role meets the user's location requirement (see below).
2. **Salary** — check the disclosed range against the compensation floor. Retain if unlisted. Apply the Partial/Gap rules from `references/report_spec.md`.
3. **Active status** — verify the apply URL loads and is not a 404, closed, or expired page. Drop any role whose apply page is no longer live.

#### Confirming remote eligibility (when user location = Remote)

Employers apply the Remote structured tag inconsistently. To avoid dropping valid remote roles, confirm eligibility using **two complementary methods** — both operating on the Stage 1 survivor pool. No new connector queries are issued.

**Pass A — Structured tag check:** Confirm whether the connector's `workplace_types: ["Remote"]` tag (or equivalent) is present on the role. Roles with this tag confirmed are remote-eligible.

**Pass B — Description text scan:** For roles that did *not* have the Remote tag, read the job description body for explicit remote language ("remote", "telecommute", "work from home", "fully distributed"). A role passes if the description unambiguously describes remote work.

A role passes the location check if it clears **either** Pass A or Pass B. A role that has neither the Remote structured tag nor any remote language in the description is dropped.

> **Resolving contradictory signals:** If the structured metadata and the description text conflict (e.g., `isRemote: true` alongside `workFromHomeAvailability: FALSE`), the **description text is the source of truth**. Read the description body for an explicit statement and use that to decide. If the description is also ambiguous, mark `location` as `Partial` and note the conflict clearly so the candidate can clarify before applying.

#### Hybrid Metro Pass (when user location includes a metro)

The Remote workplace-type filter excludes hybrid roles entirely. To surface hybrid roles in the user's metro, run one additional dedicated pass per keyword with `location: "[Metro, State]"` and `workplace_types: ["Remote", "Hybrid"]`. Evaluate results against all hard requirements as normal.

---

### Handling large WebFetch responses

Many ATS and job-board pages return HTML files large enough to exceed the context window. When WebFetch saves a file to disk instead of returning inline content:

1. **Use targeted grep or Python extraction** — do not attempt to read the full file. Extract only the signals needed: salary patterns (`\$[\d,]+`), location keywords (`remote`, `hybrid`, `telecommute`, city names), and active-status indicators (`apply`, `closed`, `no longer accepting`). A Python regex like `.{0,150}(remote|salary|\$[\d,]+|closed|apply).{0,150}` gives clean, bounded context without loading the whole file.
2. **Spawn a subagent for multiple large files in parallel** — if several files need parsing at once, dispatch a subagent with the exact file paths and extraction goals. This keeps the main context clean and allows parallel processing.
3. **Never read an oversized file raw** — loading 300K+ chars of HTML into context risks exhausting the token budget before the report is generated.

### Handling SPA / React ATS pages

Some ATS platforms (Rippling, certain Greenhouse embeds, some Lever configurations) serve a JavaScript React shell as their raw HTTP response. WebFetch captures only this empty shell — the actual job content is loaded client-side and is absent from the saved file.

**Detection:** If a fetched file is large (100K+ chars) but targeted grep returns zero hits for salary, location, or any job-description keywords, the page is almost certainly a React SPA.

**Resolution:** Re-fetch using **Apify RAG Browser** instead of WebFetch. Apify executes JavaScript and returns the fully rendered page content as Markdown. Do not retry WebFetch on the same URL — it will produce the same empty shell.

### Staffing agency and contract role handling

When a role is posted by a staffing or consulting firm and the actual end-client employer is anonymous:

- **Employment type:** Always mark as "Contract — W2 Through [Agency Name]". Never leave the contract nature implicit.
- **Soft criteria:** Cannot be assessed for the unnamed client. Set all four soft criteria fields to `Partial` with the note: *"Actual employer is anonymous — soft criteria assessed for [Agency] as employer of record only; underlying client culture unverifiable."*
- **Alignment:** Include a Misaligned bullet noting that culture, stability, and long-term fit cannot be verified without knowing the client.

### Rate-limit handling

**Proactive pacing — do this before any rate limit error occurs:** Wait 2–3 seconds between consecutive keyword queries on the same connector. Dice enforces a 200-requests-per-minute global limit shared across all clients; rapid back-to-back calls will exhaust the budget before all 10 keywords complete. Apply this pacing at the start of every connector loop, not only after a limit error occurs.

If a connector throttles mid-search despite pacing, continue with other connectors and retry the throttled one after 1–2 minutes. Make at least two retry attempts before marking the connector as `Rate Limited` in the Search Health log.

Keep a running log of which connectors returned results for which queries — you'll need it for the Search Health section of the report.

---

## Phase 5 — Generate the report

The report is a Word (.docx) file saved to the user's workspace folder.

### Step 1 — Read the spec and styling docs

Before building the JSON input, read:
- `references/report_spec.md` — exact content specification for each section and each role card field
- `references/docx_styling.md` — visual design rules (colors, typography, heading styles, table patterns, status coding)

These two files together define what the report must look like. The `generate_report.js` script implements this spec — feed it the right JSON and it handles all the styling automatically.

### Step 2 — Install dependencies

```bash
cd <path-to-skill>/job-search-report
npm install docx   # install docx-js if node_modules not already present
```

### Step 3 — Build the input JSON

Model your input JSON on `assets/sample_input.json`. The SCHEMA comment at the top of `scripts/generate_report.js` documents every field. Key points:

- `reportMeta.title` — use a role-specific title like "QA Engineering Job Search Report", not a generic one
- `reportMeta.candidateNote` — footer left text, e.g. "Confidential — Senior QA Engineer Job Search"
- `roles` — ordered by priority (1 = best fit). Populate `hardReqs` and `softCriteria` using the status keys: `Met`, `Active`, `Partial`, `Unlisted`, `Gap`
- `searchCriteria.candidateRolePreferences` — write as flowing prose; use `\n` for paragraph breaks. Do NOT split into labelled sections (no "Identity:", "Priority:", etc.)
- `searchHealth` — one row per connector; status must be one of: `Full`, `Partial`, `Rate Limited`, `Error`, `Unavailable`

### Step 4 — Run the generator

```bash
node <path-to-skill>/job-search-report/scripts/generate_report.js input.json <output-path>.docx
```

### Step 5 — Validate

```bash
python <path-to-docx-skill>/scripts/office/validate.py <output-path>.docx
```

If validation fails, inspect the error, fix the JSON input or the script, and regenerate.

### Step 6 — Deliver

Save the final .docx to the user's selected workspace folder and present it with a `computer://` link. Keep the delivery message to one line summarizing how many roles were found.

---

## Critical formatting rules (summary)

These are the most common mistakes — getting them wrong produces output that doesn't match the expected style:

1. **Role card headers use Heading 2 WITH navy background**, not a separate table. The role's `#N  Title  —  Company` text is the Heading 2 paragraph itself, with `shading: { fill: "1B2A4A" }`. This makes it show in Word's nav pane AND serve as the visual banner.

2. **Classification badge uses `2E4070` background** (medium navy, lighter than the header), italic gold text, and must include the `★ Classification:` prefix.

3. **Sub-section labels within role cards use Heading 3**, not plain paragraphs. This means "Job Details", "Role Summary", "Hard Requirement Verification", "Soft Criteria Assessment", and "Profile Alignment" are all Heading 3 elements.

4. **Section name spelling**: "Soft Criteria / Quality Ranking" (not "Quality Ranking (Soft Criteria)"). "Profile Alignment" (not "Aligned / Misaligned").

5. **Hard requirements table columns**: "Requirement" | "Value / Filter Applied" (not "Criterion" | "Value").

The bundled `generate_report.js` implements all of these rules correctly — lean on it rather than hand-rolling the docx structure.

---

## Principles

- **Generic first, specific when needed.** The candidate might be a QA engineer, a product designer, a nurse, or anything else. The skill assumes only that the user wants ranked job listings in a Word document.
- **Confirm before spending cycles.** Echo inputs back, check connector availability, get query plan approval — all before the expensive search phase.
- **Keywords are role-only.** Location, workplace type, date, and salary are always structured filter parameters — never part of the keyword query string.
- **Stage 1 is keyword + date only.** All other filters — workplace type, salary, location — belong in Stage 2.
- **Pass A and Pass B are Stage 2 activities.** They confirm remote eligibility from the Stage 1 result pool. They are not new queries.
- **SPA pages need Apify.** If WebFetch returns an empty React shell (large file, zero job-content matches), switch to Apify RAG Browser immediately.
- **Verify before reporting.** Every role in the final report must have a live apply URL.
- **Lean on the bundled script.** `scripts/generate_report.js` encodes the branded style and section structure. Hand-rolling a docx wastes time and introduces formatting drift.
