# DOCX Styling Reference

This document defines the visual design rules for the QA Job Search Report. When generating the report, follow these rules exactly. Do not override them with ad-hoc styles.

---

## Color Palette

| Name         | Hex       | Where Used                                                      |
|--------------|-----------|-----------------------------------------------------------------|
| Navy         | `1B2A4A`  | H1 headings, cover banner, header/footer, summary table header  |
| Navy Medium  | `2E4070`  | Classification badge background (slightly lighter than Navy)    |
| Teal         | `0D7377`  | H2 headings, H3 headings, table header rows, footer border      |
| Gold         | `C8A951`  | Role card title text, classification badge text, header date    |
| Silver       | `E8EDF3`  | Alternating table rows (even rows), label cells                 |
| White        | `FFFFFF`  | Base row background, body text cells                            |
| Light Teal   | `E0F2F3`  | Apply Link / Careers Page rows in job details table             |

### Status Colors

| Status   | Background | Text Color |
|----------|------------|------------|
| ✓ Met    | `D4EDDA`   | `155724`   |
| ⚠ Partial| `FFF3CD`   | `856404`   |
| ✗ Gap    | `F8D7DA`   | `721C24`   |
| ✓ Active | `D4EDDA`   | `155724`   |
| ⚠ Unlisted| `FFF3CD`  | `856404`   |

Search Health status colors:

| Status      | Background | Text Color |
|-------------|------------|------------|
| Full        | `D4EDDA`   | `155724`   |
| Partial     | `FFF3CD`   | `856404`   |
| Rate Limited| `FFF3CD`   | `856404`   |
| Error       | `F8D7DA`   | `721C24`   |
| Unavailable | `F8D7DA`   | `721C24`   |

---

## Typography

- **Font**: Arial throughout, all elements.
- **Body text**: 18 half-points (9pt), color `333333`.
- **Heading 1**: 32 half-points (16pt), bold, Navy `1B2A4A`, spacing before 320 / after 160, outlineLevel 0.
- **Heading 2**: 28 half-points (14pt), bold, Teal `0D7377`, spacing before 240 / after 120, outlineLevel 1.
- **Heading 3**: 24 half-points (12pt), bold, Teal `0D7377`, spacing before 200 / after 80, outlineLevel 2.
- All three heading styles must be defined in `Document.styles.paragraphStyles` so they appear in Word's navigation pane.

---

## Page Layout

- **Size**: US Letter — 12240 DXA wide × 15840 DXA tall (8.5" × 11").
- **Margins**: 1440 DXA (1 inch) on all sides.
- **Content width**: 9360 DXA.

---

## Header

A full-width two-column table (no visible borders) with navy background:

- **Left cell** (6000 DXA): Report title in white, 18 half-points, bold.
- **Right cell** (3360 DXA): Report date in gold, 18 half-points, right-aligned.

---

## Footer

A single paragraph with a teal top border line:

- **Left**: Candidate note (e.g., "Confidential — Senior QA Engineer Job Search"), gray `666666`, 16 half-points.
- **Right** (tab-stopped to right margin): "Page X of Y" with `PageNumber.CURRENT` and `PageNumber.TOTAL_PAGES`, gray, 16 half-points.

---

## Cover Block

1. **Navy banner** (full-width, one-column table): 
   - Title: white, 48 half-points, bold, centered.
   - Subtitle: gold, 24 half-points, centered.
   - Date: gold, 22 half-points, bold, centered.
2. **Metadata table** (two columns: 2800 / 6560 DXA): Report Date, Candidate Profile, Total Roles Found, Search Date.
3. **AI disclosure paragraph**: `⚠ AI Disclosure:` in bold Navy, followed by body text in `555555`.
4. **Page break**.

---

## Role Card Header (Heading 2 with Navy Background)

**Critical**: The role card header is a **Heading 2 paragraph** with navy background shading applied directly to the paragraph — NOT a separate table. This ensures it appears in Word's navigation pane AND serves as the visual navy banner.

```
Heading 2 paragraph:
  shading: { fill: "1B2A4A" }
  children:
    TextRun "#N  "         — white, bold, 28 half-points
    TextRun "[Role Title]" — gold, bold, 28 half-points
    TextRun "  —  "        — white, bold, 28 half-points
    TextRun "[Company]"    — white, bold, 28 half-points
```

Format: `#1  Senior QA Engineer  —  Acme Corp`

---

## Classification Badge

Sits immediately below the role card header. A single-row, single-column table:

- **Background**: `2E4070` (Navy Medium — slightly lighter than the header)
- **Text**: `★ Classification: [classification text]`, italic, Gold `C8A951`, 20 half-points.
- **No visible borders**.

---

## Role Card Sub-Section Labels

Use **Heading 3** (`HeadingLevel.HEADING_3`) for all sub-section labels within a role card:
- "Job Details"
- "Role Summary"
- "Hard Requirement Verification"
- "Soft Criteria Assessment"
- "Profile Alignment"

Do NOT use plain Normal paragraphs with bold styling for these — Heading 3 must be used so they appear in the document navigation pane.

---

## Job Details Table

Two columns: 2520 DXA (label) and 6840 DXA (value). Alternating Silver / White rows.

- **Label column**: Navy bold text on Silver/White background.
- **Value column**: Dark gray `333333` text on White/Silver background.
- **Apply Link / Careers Page rows**: Light Teal `E0F2F3` background; clickable hyperlink text in `0563C1`.

Row order: Company → Role Title → Location → Compensation → Salary Notes → Employment Type → [Contract Term, if applicable] → Industry / Domain → Date Posted → Apply Link → Monitor / Careers Page.

---

## Verification / Assessment Tables (Hard Reqs + Soft Criteria)

Three columns: 2200 / 1300 / (remainder) DXA.

- **Header row**: Teal background, white bold text.
- **Criterion column**: Navy bold text, alternating Silver/White background.
- **Status column**: Status color background (see Status Colors above), status label centered, bold.
- **Note column**: `FAFAFA` background, dark gray text.

---

## Profile Alignment Table

Two columns (equal width: 4680 / 4680 DXA):

- **Header left**: Dark green `1A5C1A` background, white bold text: "✓ ALIGNED WITH CANDIDATE PROFILE"
- **Header right**: Dark red `721C24` background, white bold text: "✗ MISALIGNED / GAPS TO CONSIDER"
- **Body left**: `F0FAF0` (light green) background, bulleted list items.
- **Body right**: `FFF8F8` (light red/pink) background, bulleted list items.

---

## Summary Comparison Table

Eight columns. Navy header row with gold bold text.

Column widths (DXA): 700 / 1900 / 2200 / 1300 / 900 / 790 / 790 / 780 = 9360 total.

- **Priority #**: centered, Navy bold.
- **Company**: clickable hyperlink.
- **Title, Salary, Location**: plain text.
- **Stability, Culture, AI**: ✓ / ⚠ / ✗ symbols with status color backgrounds.

Legend below the table: "✓ Met = Meets criteria | ⚠ Partial = Partial match or insufficient data | ✗ Gap = Does not meet criteria".

---

## Search Health Table

Five columns: 2000 / 1500 / 1100 / 2300 / 2460 DXA.

- Teal header row.
- Status column uses color-coded labels (see Search Health status colors above).
- Alternating Silver/White rows.

---

## General Table Rules

- All tables span the full content width (9360 DXA).
- Border color: `CCCCCC` (light gray), single line, size 4.
- Cell margins: 80 top/bottom, 150 left/right (default).
- Vertical alignment: center (default).
