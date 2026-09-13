// Minimal CSV parser for the Talent Intelligence ingestion layer. Handles
// quoted fields with embedded commas; not a full RFC 4180 implementation but
// sufficient for a demo/import connector.

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      // skip
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error("Unclosed quoted CSV field");
  if (field.length > 0 || row.length > 0) pushRow();

  const filtered = rows.filter((r) => r.some((c) => c.trim().length > 0));
  if (filtered.length === 0) return [];
  const headers = filtered[0].map((h) => h.replace(/^\uFEFF/, "").trim());
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length) throw new Error("CSV headers must be nonempty and unique");
  return filtered.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

export const CANDIDATE_CSV_TEMPLATE_HEADERS = [
  "candidateId",
  "name",
  "currentTitle",
  "yearsExperience",
  "education",
  "previousCompanies",
  "startupExperience",
  "technicalDomain",
  "geography",
  "originalSourcingScore",
  "interviewOutcome",
  "hired",
  "retentionMonths",
  "managerRating",
  "promotionVelocityMonths",
];
