/**
 * generate_report.js — Job Search Report Generator
 *
 * Usage:
 *   node generate_report.js <input.json> <output.docx>
 *
 * <input.json> must conform to the schema described at the top of this file.
 * See assets/sample_input.json for a worked example.
 *
 * Dependencies: docx (npm install docx)
 * Compatible: docx@8.x
 */

'use strict';

// ─── SCHEMA ─────────────────────────────────────────────────────────────────
/*
INPUT JSON SCHEMA:

{
  "reportMeta": {
    "title":            string,   // e.g. "QA Engineering Job Search Report"
    "subtitle":         string,   // e.g. "Senior Quality Engineer | Amazon Background"
    "date":             string,   // e.g. "April 22, 2026"
    "candidateProfile": string,   // one-line profile for metadata table
    "candidateNote":    string,   // left-aligned footer text e.g. "Confidential — Senior QA Engineer Job Search"
  },
  "searchCriteria": {
    "hardRequirements": [         // rows for the Hard Requirements table
      { "requirement": string, "value": string }
    ],
    "softCriteria": [             // rows for the Soft Criteria table
      { "criterion": string, "definition": string }
    ],
    "candidateRolePreferences": string  // prose paragraph(s) — may contain \n for paragraph breaks
  },
  "roles": [                      // ordered by priority (1 = highest)
    {
      "priority":       number,
      "company":        string,
      "title":          string,
      "location":       string,
      "compensation":   string,   // e.g. "$120,000 - $150,000" or "Not Listed"
      "salaryNotes":    string,
      "employmentType": string,   // e.g. "Full-Time" | "Contract" | "Contract to Hire"
      "contractTerm":   string,   // optional — only needed for contract roles
      "industry":       string,
      "datePosted":     string,
      "applyLink":      string,
      "careersPage":    string,
      "classification": string,   // e.g. "Mixed — Quality Strategy + Automation"
      "summary":        string,
      "hardReqs": {
        "salary":       [statusKey, noteString],
        "location":     [statusKey, noteString],
        "roleTitle":    [statusKey, noteString],
        "activeStatus": [statusKey, noteString]
      },
      "softCriteria": {
        "stability":    [statusKey, noteString],
        "culture":      [statusKey, noteString],
        "aiForward":    [statusKey, noteString],
        "wlb":          [statusKey, noteString]
      },
      "aligned":    string[],     // bullet points for the Aligned column
      "misaligned": string[]      // bullet points for the Misaligned column
    }
  ],
  "searchHealth": [               // one row per connector
    {
      "connector":      string,
      "queriesRun":     string,   // e.g. "10 queries × 3 passes"
      "status":         "Full" | "Partial" | "Rate Limited" | "Error" | "Unavailable",
      "issueNoted":     string,   // "No issues" if clean
      "recommendation": string    // "No action needed" if clean
    }
  ],
  "sources": [                    // numbered list of platforms used
    { "name": string, "url": string }
  ]
}

statusKey values: "Met" | "Active" | "Partial" | "Unlisted" | "Gap"
*/

// ─── DEPS ─────────────────────────────────────────────────────────────────────
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, ExternalHyperlink, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber,
  PageBreak, LevelFormat
} = require('docx');
const fs = require('fs');

// ─── COLORS ───────────────────────────────────────────────────────────────────
const NAVY         = "1B2A4A";
const NAVY_MEDIUM  = "2E4070";   // classification badge background
const TEAL         = "0D7377";
const GOLD         = "C8A951";
const SILVER       = "E8EDF3";
const WHITE        = "FFFFFF";
const LIGHT_TEAL   = "E0F2F3";

const STATUS_MET       = { color: "155724", bg: "D4EDDA" };
const STATUS_PARTIAL   = { color: "856404", bg: "FFF3CD" };
const STATUS_GAP       = { color: "721C24", bg: "F8D7DA" };
const STATUS_UNLISTED  = { color: "856404", bg: "FFF3CD" };

// ─── PAGE LAYOUT (DXA units: 1 inch = 1440) ──────────────────────────────────
const PAGE_W    = 12240;   // 8.5"
const PAGE_H    = 15840;   // 11"
const MARGIN    = 1440;    // 1"
const CONTENT_W = PAGE_W - (MARGIN * 2);  // 9360

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────
function statusDisplay(key) {
  const map = {
    Met:      { label: "✓ Met",     ...STATUS_MET },
    Active:   { label: "✓ Active",  ...STATUS_MET },
    Partial:  { label: "⚠ Partial", ...STATUS_PARTIAL },
    Unlisted: { label: "⚠ Unlisted",...STATUS_PARTIAL },
    Gap:      { label: "✗ Gap",     ...STATUS_GAP },
  };
  return map[key] || { label: key, color: "333333", bg: "F0F0F0" };
}

function softSymbol(key) {
  if (key === "Met" || key === "Active") return { sym: "✓", ...STATUS_MET };
  if (key === "Gap")                     return { sym: "✗", ...STATUS_GAP };
  return                                        { sym: "⚠", ...STATUS_PARTIAL };
}

// ─── BORDER HELPERS ──────────────────────────────────────────────────────────
function borders(color) {
  const b = { style: BorderStyle.SINGLE, size: 4, color: color || "CCCCCC" };
  return { top: b, bottom: b, left: b, right: b };
}

function noBorders() {
  const b = { style: BorderStyle.NONE, size: 0, color: WHITE };
  return { top: b, bottom: b, left: b, right: b };
}

// ─── CELL BUILDERS ───────────────────────────────────────────────────────────
function cell(children, { bg = WHITE, width, borders: bord, margins, colSpan, vAlign } = {}) {
  const props = {
    shading:       { fill: bg, type: ShadingType.CLEAR },
    borders:       bord || borders("CCCCCC"),
    margins:       margins || { top: 80, bottom: 80, left: 150, right: 150 },
    verticalAlign: vAlign || VerticalAlign.CENTER,
    children,
  };
  if (width)   props.width   = { size: width, type: WidthType.DXA };
  if (colSpan) props.columnSpan = colSpan;
  return new TableCell(props);
}

function textCell(text, { bg, width, color = "333333", bold = false, size = 18, align } = {}) {
  return cell([
    new Paragraph({
      alignment: align || AlignmentType.LEFT,
      children: [new TextRun({ text, bold, color, font: "Arial", size })],
    }),
  ], { bg, width });
}

function headerCell(text, { bg = TEAL, width, size = 18 } = {}) {
  return textCell(text, { bg, width, color: WHITE, bold: true, size });
}

function labelCell(label, { bg = SILVER, width = 2520 } = {}) {
  return textCell(label, { bg, width, color: NAVY, bold: true });
}

function valueCell(value, { bg = WHITE, width } = {}) {
  return textCell(value, { bg, width, color: "333333" });
}

function linkCell(text, url, { bg = LIGHT_TEAL, width } = {}) {
  return cell([
    new Paragraph({
      children: [new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text, color: "0563C1", underline: { type: "single" }, font: "Arial", size: 18 })],
      })],
    }),
  ], { bg, width });
}

function statusCell(key, width) {
  const sd = statusDisplay(key);
  return cell([
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: sd.label, bold: true, color: sd.color, font: "Arial", size: 17 })],
    }),
  ], { bg: sd.bg, width, borders: borders("CCCCCC") });
}

// ─── PARAGRAPH BUILDERS ──────────────────────────────────────────────────────
/**
 * Heading 1 — main section titles, Navy, 16pt bold
 * (styling is defined in Document.styles; this just applies the style id)
 */
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: NAVY, font: "Arial", size: 32 })],
  });
}

/**
 * Heading 2 — sub-section titles, Teal, 14pt bold
 * Used for section sub-titles (Hard Requirements, Candidate Role Preferences, etc.)
 */
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: TEAL, font: "Arial", size: 28 })],
  });
}

/**
 * Heading 2 with navy banner — used ONLY for role card headers.
 * Applies navy background shading directly to the paragraph so it serves as
 * both the navigation heading AND the visual card banner in one element.
 *
 * Format: "#N  [Role Title in Gold]  —  [Company in White]"
 */
function roleCardHeading(priority, title, company) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    shading:  { type: ShadingType.CLEAR, fill: NAVY },
    spacing:  { before: 0, after: 0 },
    indent:   { left: 200 },
    children: [
      new TextRun({ text: `#${priority}  `, bold: true, color: WHITE,   font: "Arial", size: 28 }),
      new TextRun({ text: title,            bold: true, color: GOLD,    font: "Arial", size: 28 }),
      new TextRun({ text: "  —  ",          bold: true, color: WHITE,   font: "Arial", size: 28 }),
      new TextRun({ text: company,          bold: true, color: WHITE,   font: "Arial", size: 28 }),
    ],
  });
}

/**
 * Heading 3 — role card sub-section labels (Job Details, Role Summary, etc.)
 * Teal, 12pt bold — shows in document navigation pane.
 */
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, color: TEAL, font: "Arial", size: 24 })],
  });
}

function prose(text, { color = "333333", size = 18 } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, color, font: "Arial", size })],
  });
}

function spacer() {
  return new Paragraph({ children: [new TextRun({ text: "", size: 20 })] });
}

function bullet(text, numRef) {
  return new Paragraph({
    numbering: { reference: numRef, level: 0 },
    children:  [new TextRun({ text, font: "Arial", size: 18, color: "333333" })],
  });
}

// ─── TABLE BUILDERS ──────────────────────────────────────────────────────────
function twoColTable(rows, { colWidths = [2520, CONTENT_W - 2520] } = {}) {
  return new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

function threeColTable(rows, { colWidths } = {}) {
  return new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

// ─── CLASSIFICATION BADGE ────────────────────────────────────────────────────
/**
 * The classification badge sits directly below the role card header.
 * Uses a slightly lighter navy (NAVY_MEDIUM) background to visually separate
 * it from the main header, with italic gold text and a ★ prefix.
 */
function classificationBadge(classification) {
  return new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({
      children: [new TableCell({
        shading:  { fill: NAVY_MEDIUM, type: ShadingType.CLEAR },
        borders:  noBorders(),
        margins:  { top: 60, bottom: 60, left: 200, right: 200 },
        children: [new Paragraph({
          children: [new TextRun({
            text:    `★ Classification: ${classification}`,
            italics: true,
            color:   GOLD,
            font:    "Arial",
            size:    20,
          })],
        })],
      })],
    })],
  });
}

// ─── ROLE CARD ───────────────────────────────────────────────────────────────
function buildRoleCard(role) {
  const LABEL_W = 2520;
  const VALUE_W = CONTENT_W - LABEL_W;

  const CRIT_W  = 2200;
  const STAT_W  = 1300;
  const NOTE_W  = CONTENT_W - CRIT_W - STAT_W;

  const elements = [];

  // Page break before all cards except the first
  if (role.priority > 1) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── Card header: Heading 2 WITH navy background shading ──────────────────
  elements.push(roleCardHeading(role.priority, role.title, role.company));

  // ── Classification badge ─────────────────────────────────────────────────
  elements.push(classificationBadge(role.classification));
  elements.push(spacer());

  // ── Job Details (Heading 3 + metadata table) ─────────────────────────────
  elements.push(h3("Job Details"));

  const metaRows = [
    ["Company",          role.company],
    ["Role Title",       role.title],
    ["Location",         role.location],
    ["Compensation",     role.compensation],
    ["Salary Notes",     role.salaryNotes],
    ["Employment Type",  role.employmentType],
  ];
  if (role.contractTerm) metaRows.push(["Contract Term", role.contractTerm]);
  metaRows.push(
    ["Industry / Domain", role.industry],
    ["Date Posted",        role.datePosted],
  );

  const metaTableRows = metaRows.map((r, i) => {
    const bg = i % 2 === 0 ? WHITE : SILVER;
    return new TableRow({ children: [labelCell(r[0], { bg, width: LABEL_W }), valueCell(r[1], { bg, width: VALUE_W })] });
  });
  metaTableRows.push(
    new TableRow({ children: [labelCell("Apply Link",           { bg: LIGHT_TEAL, width: LABEL_W }), linkCell("Apply Now",    role.applyLink,   { bg: LIGHT_TEAL, width: VALUE_W })] }),
    new TableRow({ children: [labelCell("Monitor / Careers Page",{ bg: LIGHT_TEAL, width: LABEL_W }), linkCell("Careers Page", role.careersPage, { bg: LIGHT_TEAL, width: VALUE_W })] }),
  );

  elements.push(twoColTable(metaTableRows, { colWidths: [LABEL_W, VALUE_W] }));
  elements.push(spacer());

  // ── Role Summary ──────────────────────────────────────────────────────────
  elements.push(h3("Role Summary"));
  elements.push(prose(role.summary));
  elements.push(spacer());

  // ── Hard Requirement Verification ─────────────────────────────────────────
  elements.push(h3("Hard Requirement Verification"));
  const hardRows = [
    ["Min. Salary ($120k+)",      role.hardReqs.salary],
    ["Location (Remote/Denver)",   role.hardReqs.location],
    ["Role Title (QA/Test/SDET)",  role.hardReqs.roleTitle],
    ["Active Status",              role.hardReqs.activeStatus],
  ];
  elements.push(threeColTable([
    new TableRow({ children: [headerCell("Criterion", { width: CRIT_W }), headerCell("Status", { width: STAT_W }), headerCell("Verification Note", { width: NOTE_W })] }),
    ...hardRows.map(([label, [statusKey, note]], i) => {
      const bg = i % 2 === 0 ? WHITE : SILVER;
      return new TableRow({ children: [
        labelCell(label,  { bg, width: CRIT_W }),
        statusCell(statusKey, STAT_W),
        valueCell(note,   { bg: "FAFAFA", width: NOTE_W }),
      ]});
    }),
  ], { colWidths: [CRIT_W, STAT_W, NOTE_W] }));
  elements.push(spacer());

  // ── Soft Criteria Assessment ──────────────────────────────────────────────
  elements.push(h3("Soft Criteria Assessment"));
  const softRows = [
    ["Stability (No Mass Layoffs)", role.softCriteria.stability],
    ["Culture (4.0+ Glassdoor)",    role.softCriteria.culture],
    ["AI-Forward Culture",          role.softCriteria.aiForward],
    ["Work-Life Balance",           role.softCriteria.wlb],
  ];
  elements.push(threeColTable([
    new TableRow({ children: [headerCell("Criterion", { width: CRIT_W }), headerCell("Status", { width: STAT_W }), headerCell("Assessment Note", { width: NOTE_W })] }),
    ...softRows.map(([label, [statusKey, note]], i) => {
      const bg = i % 2 === 0 ? WHITE : SILVER;
      return new TableRow({ children: [
        labelCell(label, { bg, width: CRIT_W }),
        statusCell(statusKey, STAT_W),
        valueCell(note,  { bg: "FAFAFA", width: NOTE_W }),
      ]});
    }),
  ], { colWidths: [CRIT_W, STAT_W, NOTE_W] }));
  elements.push(spacer());

  // ── Profile Alignment ─────────────────────────────────────────────────────
  elements.push(h3("Profile Alignment"));
  const HALF = Math.floor(CONTENT_W / 2);

  const GREEN_HDR_BG = "1A5C1A";
  const RED_HDR_BG   = "721C24";
  const GREEN_ROW_BG = "F0FAF0";
  const RED_ROW_BG   = "FFF8F8";

  elements.push(new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [HALF, CONTENT_W - HALF],
    rows: [
      new TableRow({ children: [
        textCell("✓ ALIGNED WITH CANDIDATE PROFILE",     { bg: GREEN_HDR_BG, width: HALF,              color: WHITE, bold: true, size: 17 }),
        textCell("✗ MISALIGNED / GAPS TO CONSIDER",      { bg: RED_HDR_BG,   width: CONTENT_W - HALF,  color: WHITE, bold: true, size: 17 }),
      ]}),
      new TableRow({ children: [
        cell(role.aligned.map(t   => bullet(t, "bulletsA")), { bg: GREEN_ROW_BG, width: HALF,             margins: { top: 100, bottom: 100, left: 200, right: 120 } }),
        cell(role.misaligned.map(t => bullet(t, "bulletsB")), { bg: RED_ROW_BG,   width: CONTENT_W - HALF, margins: { top: 100, bottom: 100, left: 200, right: 120 } }),
      ]}),
    ],
  }));

  return elements;
}

// ─── HEADER / FOOTER ─────────────────────────────────────────────────────────
function buildHeader(meta) {
  return new Header({
    children: [new Table({
      width:        { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [6000, 3360],
      rows: [new TableRow({ children: [
        new TableCell({
          shading: { fill: NAVY, type: ShadingType.CLEAR },
          borders: noBorders(),
          margins: { top: 80, bottom: 80, left: 200, right: 100 },
          width:   { size: 6000, type: WidthType.DXA },
          children: [new Paragraph({
            children: [new TextRun({ text: meta.title, bold: true, color: WHITE, font: "Arial", size: 18 })],
          })],
        }),
        new TableCell({
          shading: { fill: NAVY, type: ShadingType.CLEAR },
          borders: noBorders(),
          margins: { top: 80, bottom: 80, left: 100, right: 200 },
          width:   { size: 3360, type: WidthType.DXA },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: meta.date, color: GOLD, font: "Arial", size: 18 })],
          })],
        }),
      ]})],
    })],
  });
}

function buildFooter(meta) {
  return new Footer({
    children: [new Paragraph({
      border:    { top: { style: BorderStyle.SINGLE, size: 6, color: TEAL, space: 1 } },
      tabStops:  [{ type: "right", position: CONTENT_W }],
      children:  [
        new TextRun({ text: meta.candidateNote || "Confidential — Job Search Report", color: "666666", font: "Arial", size: 16 }),
        new TextRun({ text: "\t",    font: "Arial", size: 16 }),
        new TextRun({ text: "Page ", color: "666666", font: "Arial", size: 16 }),
        new TextRun({ children: [PageNumber.CURRENT], color: "666666", font: "Arial", size: 16 }),
        new TextRun({ text: " of ",  color: "666666", font: "Arial", size: 16 }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "666666", font: "Arial", size: 16 }),
      ],
    })],
  });
}

// ─── COVER BLOCK ─────────────────────────────────────────────────────────────
function buildCover(meta, roles) {
  const elements = [];

  // Navy banner with title, subtitle, date
  elements.push(new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      shading: { fill: NAVY, type: ShadingType.CLEAR },
      borders: noBorders(),
      margins: { top: 300, bottom: 200, left: 360, right: 360 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.title,    bold: true, color: WHITE, font: "Arial", size: 48 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.subtitle,            color: GOLD,  font: "Arial", size: 24 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.date,    bold: true, color: GOLD,  font: "Arial", size: 22 })] }),
      ],
    })]})],
  }));

  elements.push(spacer());

  // Metadata table
  elements.push(twoColTable([
    new TableRow({ children: [labelCell("Report Date",       { bg: SILVER }), valueCell(meta.date,                             { bg: WHITE })] }),
    new TableRow({ children: [labelCell("Candidate Profile", { bg: SILVER }), valueCell(meta.candidateProfile || "",           { bg: WHITE })] }),
    new TableRow({ children: [labelCell("Total Roles Found", { bg: SILVER }), valueCell(`${roles.length} qualifying roles (active, verified)`, { bg: WHITE })] }),
    new TableRow({ children: [labelCell("Search Date",       { bg: SILVER }), valueCell(meta.date,                             { bg: WHITE })] }),
  ], { colWidths: [2800, CONTENT_W - 2800] }));

  elements.push(spacer());

  // AI disclosure
  elements.push(new Paragraph({
    children: [
      new TextRun({ text: "⚠ AI Disclosure: ", bold: true, font: "Arial", size: 18, color: NAVY }),
      new TextRun({ text: "This report was generated with AI-assisted job search tools. All postings were independently verified for active application status at the time of generation. Glassdoor ratings, culture assessments, and stability notes reflect publicly available data at the time of search. Verify all details independently before applying.", font: "Arial", size: 18, color: "555555" }),
    ],
  }));

  elements.push(new Paragraph({ children: [new PageBreak()] }));
  return elements;
}

// ─── SEARCH CRITERIA ─────────────────────────────────────────────────────────
function buildSearchCriteria(criteria) {
  const elements = [h1("Search Criteria"), spacer()];

  // Hard Requirements
  elements.push(h2("Hard Requirements"));
  elements.push(twoColTable([
    new TableRow({ children: [headerCell("Requirement", { width: 2400 }), headerCell("Value / Filter Applied", { width: CONTENT_W - 2400 })] }),
    ...criteria.hardRequirements.map((r, i) => {
      const bg = i % 2 === 0 ? WHITE : SILVER;
      return new TableRow({ children: [labelCell(r.requirement, { bg, width: 2400 }), valueCell(r.value, { bg, width: CONTENT_W - 2400 })] });
    }),
  ], { colWidths: [2400, CONTENT_W - 2400] }));

  elements.push(spacer());

  // Soft Criteria / Quality Ranking
  elements.push(h2("Soft Criteria / Quality Ranking"));
  elements.push(twoColTable([
    new TableRow({ children: [headerCell("Criterion", { width: 2400 }), headerCell("Definition", { width: CONTENT_W - 2400 })] }),
    ...criteria.softCriteria.map((r, i) => {
      const bg = i % 2 === 0 ? WHITE : SILVER;
      return new TableRow({ children: [labelCell(r.criterion, { bg, width: 2400 }), valueCell(r.definition, { bg, width: CONTENT_W - 2400 })] });
    }),
  ], { colWidths: [2400, CONTENT_W - 2400] }));

  elements.push(spacer());

  // Candidate Role Preferences
  elements.push(h2("Candidate Role Preferences"));
  const preferenceParas = (criteria.candidateRolePreferences || "").split("\n").filter(Boolean);
  preferenceParas.forEach(p => elements.push(prose(p)));
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  return elements;
}

// ─── SUMMARY COMPARISON TABLE ─────────────────────────────────────────────────
function buildSummaryTable(roles) {
  const elements = [h1("Summary Comparison Table"), spacer()];

  const COL = [700, 1900, 2200, 1300, 900, 790, 790, 780];
  elements.push(new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: COL,
    rows: [
      new TableRow({ children: [
        headerCell("#",        { bg: NAVY, width: COL[0] }),
        headerCell("Company",  { bg: NAVY, width: COL[1] }),
        headerCell("Title",    { bg: NAVY, width: COL[2] }),
        headerCell("Salary",   { bg: NAVY, width: COL[3] }),
        headerCell("Location", { bg: NAVY, width: COL[4] }),
        headerCell("Stab.",    { bg: NAVY, width: COL[5] }),
        headerCell("Culture",  { bg: NAVY, width: COL[6] }),
        headerCell("AI",       { bg: NAVY, width: COL[7] }),
      ]}),
      ...roles.map((role, i) => {
        const bg = i % 2 === 0 ? WHITE : SILVER;
        const ss = softSymbol(role.softCriteria.stability[0]);
        const sc = softSymbol(role.softCriteria.culture[0]);
        const sa = softSymbol(role.softCriteria.aiForward[0]);
        return new TableRow({ children: [
          textCell(String(role.priority), { bg, width: COL[0], color: NAVY, bold: true, align: AlignmentType.CENTER }),
          new TableCell({ shading: { fill: bg, type: ShadingType.CLEAR }, borders: borders("CCCCCC"), margins: { top: 80, bottom: 80, left: 100, right: 100 }, width: { size: COL[1], type: WidthType.DXA }, children: [new Paragraph({ children: [new ExternalHyperlink({ link: role.careersPage, children: [new TextRun({ text: role.company, color: "0563C1", underline: { type: "single" }, font: "Arial", size: 15 })] })] })] }),
          textCell(role.title,        { bg, width: COL[2], size: 15 }),
          textCell(role.compensation, { bg, width: COL[3], size: 14 }),
          textCell("Remote US",       { bg, width: COL[4], size: 15 }),
          textCell(ss.sym, { bg: ss.bg, width: COL[5], color: ss.color, bold: true, size: 15, align: AlignmentType.CENTER }),
          textCell(sc.sym, { bg: sc.bg, width: COL[6], color: sc.color, bold: true, size: 15, align: AlignmentType.CENTER }),
          textCell(sa.sym, { bg: sa.bg, width: COL[7], color: sa.color, bold: true, size: 15, align: AlignmentType.CENTER }),
        ]});
      }),
    ],
  }));

  elements.push(spacer());
  elements.push(new Paragraph({
    children: [
      new TextRun({ text: "Legend: ", bold: true, font: "Arial", size: 18, color: NAVY }),
      new TextRun({ text: "✓ Met = Meets criteria   |   ⚠ Partial = Partial match or insufficient data   |   ✗ Gap = Does not meet criteria", font: "Arial", size: 18, color: "444444" }),
    ],
  }));
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  return elements;
}

// ─── SEARCH HEALTH ────────────────────────────────────────────────────────────
function buildSearchHealth(healthRows) {
  const elements = [h1("Search Health & Warnings"), spacer()];

  const statusStyle = {
    Full:          { label: "Full",         color: "155724", bg: "D4EDDA" },
    Partial:       { label: "Partial",       color: "856404", bg: "FFF3CD" },
    "Rate Limited":{ label: "Rate Limited",  color: "856404", bg: "FFF3CD" },
    Error:         { label: "Error",         color: "721C24", bg: "F8D7DA" },
    Unavailable:   { label: "Unavailable",   color: "721C24", bg: "F8D7DA" },
  };

  const COL = [2000, 1500, 1100, 2300, 2460];
  elements.push(new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: COL,
    rows: [
      new TableRow({ children: [
        headerCell("Connector",     { width: COL[0] }),
        headerCell("Queries Run",   { width: COL[1] }),
        headerCell("Status",        { width: COL[2] }),
        headerCell("Issue Noted",   { width: COL[3] }),
        headerCell("Recommendation",{ width: COL[4] }),
      ]}),
      ...healthRows.map((r, i) => {
        const bg = i % 2 === 0 ? WHITE : SILVER;
        const st = statusStyle[r.status] || { label: r.status, color: "333333", bg: "F0F0F0" };
        return new TableRow({ children: [
          labelCell(r.connector,     { bg, width: COL[0] }),
          valueCell(r.queriesRun,    { bg, width: COL[1] }),
          textCell(st.label, { bg: st.bg, width: COL[2], color: st.color, bold: true }),
          valueCell(r.issueNoted,    { bg: "FAFAFA", width: COL[3] }),
          valueCell(r.recommendation,{ bg: "FAFAFA", width: COL[4] }),
        ]});
      }),
    ],
  }));

  elements.push(spacer());
  const allClean = healthRows.every(r => r.status === "Full");
  elements.push(prose(
    allClean
      ? "All connectors ran successfully. No known gaps in this report."
      : "Results may be incomplete where connectors are marked Partial, Rate Limited, Error, or Unavailable. Consider re-running flagged connectors before concluding no roles exist for a given keyword.",
    { color: "555555" }
  ));
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  return elements;
}

// ─── SOURCES LIST ─────────────────────────────────────────────────────────────
function buildSources(sources) {
  const elements = [h1("Sources & Platforms Used"), spacer()];
  sources.forEach((s, i) => {
    elements.push(new Paragraph({
      children: [
        new TextRun({ text: `${i + 1}. `, font: "Arial", size: 18, color: "333333" }),
        ...(s.url
          ? [new ExternalHyperlink({ link: s.url, children: [new TextRun({ text: s.name, color: "0563C1", underline: { type: "single" }, font: "Arial", size: 18 })] })]
          : [new TextRun({ text: s.name, font: "Arial", size: 18, color: "333333" })]
        ),
      ],
    }));
  });
  return elements;
}

// ─── DOCUMENT ASSEMBLY ────────────────────────────────────────────────────────
function buildDocument(data) {
  const { reportMeta: meta, searchCriteria, roles, searchHealth, sources } = data;

  const allChildren = [
    ...buildCover(meta, roles),
    ...buildSearchCriteria(searchCriteria),
    h1("Role Profiles"),
    spacer(),
    ...roles.flatMap(role => [...buildRoleCard(role), spacer()]),
    new Paragraph({ children: [new PageBreak()] }),
    ...buildSummaryTable(roles),
    ...buildSearchHealth(searchHealth),
    ...buildSources(sources),
  ];

  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run:       { size: 32, bold: true, font: "Arial", color: NAVY },
          paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run:       { size: 28, bold: true, font: "Arial", color: TEAL },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          // Heading 3 — used for role card sub-section labels (Job Details, Role Summary, etc.)
          // NOTE: docx-js may inherit default Office theme colors for built-in heading style IDs.
          // Color is therefore set explicitly on every TextRun in h3() to guarantee Teal output.
          id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run:       { size: 24, bold: true, font: "Arial", color: TEAL },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bulletsA",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 300 } }, run: { font: "Arial", size: 18 } } }],
        },
        {
          reference: "bulletsB",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 300 } }, run: { font: "Arial", size: 18 } } }],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size:   { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: { default: buildHeader(meta) },
      footers: { default: buildFooter(meta) },
      children: allChildren,
    }],
  });
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
const [,, inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: node generate_report.js <input.json> <output.docx>");
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
} catch (e) {
  console.error("Failed to read/parse input JSON:", e.message);
  process.exit(1);
}

const doc = buildDocument(data);
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log("Report written to:", outputPath);
}).catch(err => {
  console.error("Error generating report:", err);
  process.exit(1);
});
