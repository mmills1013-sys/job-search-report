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
- **Priority 2**: Roles with str