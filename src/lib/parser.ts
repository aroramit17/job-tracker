export interface ParsedJob {
  title: string | null;
  company: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryRaw: string | null;
}

function normalizeAmount(raw: string, hasK: boolean): number {
  let num = parseFloat(raw.replace(/,/g, ''));
  if (hasK) num *= 1000;
  return Math.round(num);
}

function parseSalary(text: string): { min: number; max: number; raw: string } | null {
  // Range with K suffix: "$120K - $150K"
  const kRangePattern = /\$([\d,]+(?:\.\d+)?)\s*[Kk]\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+(?:\.\d+)?)\s*[Kk]\s*(?:\/\s*(?:yr|year|hr|hour))?/;
  const kMatch = text.match(kRangePattern);
  if (kMatch) {
    return {
      min: normalizeAmount(kMatch[1], true),
      max: normalizeAmount(kMatch[2], true),
      raw: kMatch[0].trim(),
    };
  }

  // Range with full numbers: "$120,000 - $150,000"
  const rangePattern = /\$([\d,]+(?:\.\d+)?)\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+(?:\.\d+)?)\s*(?:\/\s*(?:yr|year|hr|hour))?/;
  const rangeMatch = text.match(rangePattern);
  if (rangeMatch) {
    return {
      min: normalizeAmount(rangeMatch[1], false),
      max: normalizeAmount(rangeMatch[2], false),
      raw: rangeMatch[0].trim(),
    };
  }

  // Single value with K: "$130K"
  const singleKPattern = /\$([\d,]+(?:\.\d+)?)\s*[Kk]\s*(?:\/\s*(?:yr|year))?/;
  const singleKMatch = text.match(singleKPattern);
  if (singleKMatch) {
    const val = normalizeAmount(singleKMatch[1], true);
    return { min: val, max: val, raw: singleKMatch[0].trim() };
  }

  // Single full value: "$130,000"
  const singlePattern = /\$([\d,]+(?:\.\d+)?)\s*(?:\/\s*(?:yr|year))?/;
  const singleMatch = text.match(singlePattern);
  if (singleMatch) {
    const val = normalizeAmount(singleMatch[1], false);
    if (val >= 10000) {
      return { min: val, max: val, raw: singleMatch[0].trim() };
    }
  }

  return null;
}

function parseTitle(text: string): string | null {
  const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 120 && !trimmed.startsWith('http')) {
      return trimmed;
    }
  }
  return null;
}

function parseCompany(text: string): string | null {
  // Try "at <Company>" pattern
  const atPattern = /\bat\s+([A-Z][\w\s&.'-]+)/;
  const atMatch = text.match(atPattern);
  if (atMatch) return atMatch[1].trim();

  // Try "Company · Location" pattern (common in LinkedIn pastes)
  const dotPattern = /^(.+?)\s*·/m;
  const dotMatch = text.match(dotPattern);
  if (dotMatch && dotMatch[1].trim().length < 80) return dotMatch[1].trim();

  // Fallback: second non-empty line
  const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length >= 2 && lines[1].trim().length < 80) {
    return lines[1].trim();
  }
  return null;
}

export function parseJobDescription(text: string): ParsedJob {
  const salary = parseSalary(text);
  return {
    title: parseTitle(text),
    company: parseCompany(text),
    salaryMin: salary?.min ?? null,
    salaryMax: salary?.max ?? null,
    salaryRaw: salary?.raw ?? null,
  };
}
