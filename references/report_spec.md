# Report Content Specification

This file defines the exact content and structure of each section of the Job Search Report. Use it alongside `docx_styling.md` when building the JSON input for `generate_report.js`.

---

## File Naming

`Job_Search_Report_YYYYMMDD_HHMM.docx` — timestamp reflects when the report was generated.

For QA-specific searches, the report title should be: **"QA Engineering Job Search Report"**

---

## Section 1 — Cover Block

Populate `reportMeta` in the JSON input:

| Field              | Content                                                               |
|--------------------|-----------------------------------------------------------------------|
| `title`            | Role-specific title, e.g. "QA Engineering Job Search Report"         |
| `subtitle`         | One-line candidate profile summary for display in the banner         |
| `date`             | Human-readable date, e.g. "April 22, 2026"                          |
| `candidateProfile` | Metadata table version of the candidate summary (short, pipe-delimited) |
| `candidateNote`    | Left-aligned footer text, e.g. "Confidential — Senior QA Engineer Job Search" |

The metadata table shows: Report Date, Candidate Profile, Total Roles Found (auto-populated from roles array length), Search Date.

---

## Section 2 — Search Criteria

### Hard Requirements

Populate `searchCriteria.hardRequirements` as an array of `{ requirement, value }` objects.

Standard rows for a QA search:

| Requirement   | Value / Filter Applied                                                                         |
|---------------|-----------------------------------------------------------------------------------------------|
| Min. Salary   | $120,000 base minimum. If salary not listed, include if all other criteria met.               |
| Location      | 100% Remote (US) or Hybrid within Denver metro area.                                          |
| Role Title    | Must include keywords: Quality, Test, QAE, SDET, or QA.                                       |
| Active Status | Posting must be currently accepting applications. Apply link verified — 404/error = excluded. |
| Date Filter   | Last 3 days (posted_date: THREE).                                                              |

### Soft Criteria / Quality Ranking

Populate `searchCriteria.softCriteria` as an array of `{ criterion, definition }` objects.

Standard rows:

| Criterion        | Definition                                                                                   |
|------------------|----------------------------------------------------------------------------------------------|
| Stability        | No mass layoffs in the past 12 months. Prefer established or growing companies.              |
| Culture          | Glassdoor / sentiment rating of 4.0 or higher. High scores for autonomy and management.     |
| AI-Forward       | Engineering culture that values or allows AI-assisted dev tools (Cline, Kiro, Cursor, etc.) |
| Work-Life Balance| Positive sentiment for sustainable hours and healthy team culture. Avoid burnout companies.  |

### Candidate Role Preferences

`searchCriteria.candidateRolePreferences` — one or more prose paragraphs (separated by `\n` in the JSON string) describing the candidate's identity, priorities, and filters. Pull this directly from the user's role specialization input. Do NOT split it into labelled sub-sections (no "Identity & Impact:", "Priority & Methodology:", etc.) — write it as flowing prose.

---

## Section 3 — Role Profiles

One card per role, in priority order. Populate the `roles` array.

### Role Card Fields

| Field           | Notes                                                                                             |
|-----------------|---------------------------------------------------------------------------------------------------|
| `priority`      | Integer 1–N. 1 = top recommendation.                                                             |
| `company`       | Company name as it appears on the posting.                                                       |
| `title`         | Exact job title from the posting.                                                                |
| `location`      | e.g. "Remote (US)", "Hybrid — Denver, CO"                                                        |
| `compensation`  | Salary range if listed, or "Not Listed".                                                         |
| `salaryNotes`   | One-sentence explanation (e.g., "Listed range; above $120k minimum").                            |
| `employmentType`| "Full-Time", "Contract", "Contract to Hire", etc.                                               |
| `contractTerm`  | Optional. Only include for contract roles (e.g., "6-month contract, renewal possible").          |
| `industry`      | Short domain description (e.g., "Fintech / Payment Infrastructure").                            |
| `datePosted`    | Human-readable date (e.g., "April 20, 2026") or "~April 2026" if exact date unknown.           |
| `applyLink`     | Direct URL to the apply page. Must be verified as live before inclusion.                        |
| `careersPage`   | Company careers page URL for ongoing monitoring.                                                |
| `classification`| One of: "Manual QA", "Automation-Focused", or "Mixed — [short description]"                    |
| `summary`       | 2–3 sentences describing what the role involves. Plain language, no bullet points.              |

### Hard Requirement Verification (`hardReqs`)

Each field is a `[statusKey, noteString]` tuple.

| Field          | Label in table                  | Status keys allowed             |
|----------------|---------------------------------|---------------------------------|
| `salary`       | Min. Salary ($120k+)            | Met, Partial, Unlisted, Gap     |
| `location`     | Location (Remote/Denver)        | Met, Partial, Gap               |
| `roleTitle`    | Role Title (QA/Test/SDET)       | Met, Partial, Gap               |
| `activeStatus` | Active Status                   | Active, Partial, Gap            |

**Salary status decision rules:**

- **Met** — salary is listed and the entire range is at or above the minimum (e.g., $130K–$160K vs. $120K floor).
- **Unlisted** — no salary information is present in the posting. Include the role; note "Salary not disclosed."
- **Partial** — salary is listed but the floor of the range falls below the minimum while the ceiling clears it (e.g., $107K–$160K vs. $120K floor). Include the role but flag it: the candidate should confirm the target band before applying. Note verbatim in `salaryNotes`: "Listed floor ($X) is below $120K minimum; range extends to $Y — confirm target band before applying."
- **Gap** — salary is listed and the entire range falls below the minimum (e.g., $80K–$110K). Drop the role; do not include it in the report.

**Location status decision rules:**

- **Met** — posting explicitly confirms 100% remote US, or hybrid with an eligible metro.
- **Partial** — remote status is ambiguous (e.g., conflicting structured metadata and description text, or "remote with occasional office visits" without clarity on frequency). Include but flag; note the specific ambiguity so the candidate can investigate before applying.
- **Gap** — posting requires on-site attendance at a location that is neither remote nor in the candidate's hybrid metro. Drop the role.

### Soft Criteria Assessment (`softCriteria`)

Same `[statusKey, noteString]` format.

| Field       | Label in table            | Status keys allowed         |
|-------------|---------------------------|-----------------------------|
| `stability` | Stability (No Mass Layoffs) | Met, Partial, Gap          |
| `culture`   | Culture (4.0+ Glassdoor)  | Met, Partial, Gap           |
| `aiForward` | AI-Forward Culture        | Met, Partial, Gap           |
| `wlb`       | Work-Life Balance         | Met, Partial, Gap           |

**Staffing agency / anonymous employer handling:**

When a role is posted through a staffing or consulting firm and the actual end-client employer is not named, soft criteria cannot be assessed for the real employer. In this case:

- Set all four soft criteria fields to `Partial`.
- Use a consistent note for each: *"Actual employer is anonymous — assessed for [Agency Name] as employer of record only; underlying client culture unverifiable."*
- In the `misaligned` array, add a bullet: *"Employer identity is undisclosed — company culture, stability, and long-term fit cannot be independently verified before accepting."*

This is distinct from a role posted directly by a company with limited public information (e.g., an early-stage startup). For those, use `Partial` only on criteria where data is genuinely unavailable, and note the specific gap.

### Profile Alignment

- `aligned`: Array of bullet-point strings for the green "Aligned" column. Typically 3–6 bullets.
- `misaligned`: Array of bullet-point strings for the red "Misaligned / Gaps" column. Typically 2–5 bullets.

### Priority Ordering Rules

- **Priority 1**: Roles meeting most or all hard + soft criteria.
- **Priority 2**: Roles with strong hard criteria but partial soft criteria gaps.
- **Priority 3**: Roles with notable culture, stability, or WLB concerns — include for visibility but flag clearly.

---

## Section 4 — Summary Comparison Table

Auto-populated from the `roles` array. No additional input needed.

Columns: Priority # | Company (linked to careersPage) | Title | Salary | Location | Stability | Culture | AI-Forward

---

## Section 5 — Search Health & Warnings

Populate `searchHealth` as an array, one entry per connector.

| Field            | Values                                                              |
|------------------|---------------------------------------------------------------------|
| `connector`      | Platform name (e.g., "Dice / LinkedIn MCP", "Indeed MCP")         |
| `queriesRun`     | e.g., "10 queries × 3 passes (Remote + keyword + Denver hybrid)"   |
| `status`         | "Full", "Partial", "Rate Limited", "Error", or "Unavailable"       |
| `issueNoted`     | Brief description or "No issues"                                    |
| `recommendation` | Action item or "No action needed"                                   |

**Status definitions:**

- **Full** — All queries ran and returned results. This includes cases where rate limits occurred but were resolved through retries and all queries ultimately completed. Use `issueNoted` to mention rate-limiting as informational context if relevant, but do not downgrade to a lower status solely because retries were needed.
- **Partial** — Some queries returned empty result sets, fewer results than expected, or were skipped due to connector limitations. Do NOT use Partial simply because retries were required — only use it when actual coverage gaps remain after all retry attempts.
- **Rate Limited** — Throttling occurred and one or more queries were abandoned or produced incomplete results that could not be recovered through retries. Use only when throttling caused a real, unresolved coverage gap.
- **Error** — Connector returned an error, timed out, or returned zero results for all queries with no recoverable path.
- **Unavailable** — Connector was not loaded or accessible this session.

If all connectors are "Full", the script will automatically print: "All connectors ran successfully. No known gaps in this report." Otherwise it prints the standard disclaimer.

---

## Section 6 — Sources & Platforms Used

Populate `sources` as an array of `{ name, url }` objects. Include every platform, MCP, or tool used — job boards, ATS systems, research tools, company culture lookups.

---

## Content Quality Guidelines

- **Role summary**: Write for someone who hasn't read the job description. Focus on what the candidate will actually do day-to-day, not just the company pitch.
- **Verification notes**: Be specific. "Greenhouse page confirmed active — apply button present, no closed language" is better than "Active".
- **Aligned bullets**: Lead with the strongest match. Quality strategy and upstream collaboration should be first if present.
- **Misaligned bullets**: Be honest but constructive. State the concern, not a judgment.
- **Classification**: When in doubt, call it "Mixed" and add a short descriptor. This is the most useful signal for the candidate at a glance.
- **Contract roles**: Always call out contract duration and the agency name in the role card. Candidates need this to assess continuity risk before applying.
