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

Applying location or workplace filters at Stage 1 causes silent under-inclusion: roles tagged inconsistently by employers are dropped before you can read the description and confirm eligibility. All three fil