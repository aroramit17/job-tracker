import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  if (!url.includes('linkedin.com/jobs') && !url.includes('linkedin.com/job')) {
    return NextResponse.json({ error: 'Please provide a valid LinkedIn job URL' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `LinkedIn returned status ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();

    // Extract from LinkedIn's public job page HTML classes
    const title = extractByClass(html, 'top-card-layout__title')
      ?? extractMeta(html, 'og:title')?.replace(/\s*\|.*$/, '').replace(/\s*hiring\s+/, '');

    const company = extractByClass(html, 'topcard__org-name-link')
      ?? extractByClass(html, 'topcard__flavor')
      ?? extractCompanyFromOg(html);

    const location = extractByClass(html, 'topcard__flavor--bullet');

    // Job description from the show-more-less section
    const description = extractDescription(html);

    // Salary
    const salarySection = extractByClass(html, 'salary-main-rail__data-body')
      ?? extractByClass(html, 'compensation__salary');
    const salaryFromDesc = !salarySection && description ? parseSalaryFromText(description) : null;
    const salaryParsed = salarySection ? parseSalaryFromText(salarySection) : null;

    const result = {
      title: title?.trim() ?? null,
      company: company?.trim() ?? null,
      description: description?.trim() ?? null,
      location: location?.trim() ?? null,
      salaryRaw: salaryParsed?.raw ?? salaryFromDesc?.raw ?? salarySection?.trim() ?? null,
      salaryMin: salaryParsed?.min ?? salaryFromDesc?.min ?? null,
      salaryMax: salaryParsed?.max ?? salaryFromDesc?.max ?? null,
    };

    if (!result.title && !result.company && !result.description) {
      return NextResponse.json(
        { error: 'Could not parse job details from that URL' },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Fetch failed: ${message}` }, { status: 502 });
  }
}

function extractByClass(html: string, className: string): string | null {
  const pattern = new RegExp(`${escapeRegex(className)}[^>]*>([^<]+)`, 'i');
  const match = html.match(pattern);
  return match ? decodeEntities(match[1].trim()) : null;
}

function extractDescription(html: string): string | null {
  const match = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div/i);
  if (!match) return null;
  return stripHtml(match[1]).trim() || null;
}

function extractMeta(html: string, property: string): string | null {
  const p = escapeRegex(property);
  const m1 = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i'));
  if (m1) return decodeEntities(m1[1]);
  const m2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, 'i'));
  return m2 ? decodeEntities(m2[1]) : null;
}

function extractCompanyFromOg(html: string): string | null {
  const desc = extractMeta(html, 'og:description');
  if (!desc) return null;
  // LinkedIn og:description often starts with "Company · Location"
  const match = desc.match(/^(.+?)\s*·/);
  return match ? match[1].trim() : null;
}

function parseSalaryFromText(text: string): { min: number; max: number; raw: string } | null {
  // Range with K suffix: "$120K - $150K"
  const kRange = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (kRange) {
    return {
      min: Math.round(parseFloat(kRange[1].replace(/,/g, '')) * 1000),
      max: Math.round(parseFloat(kRange[2].replace(/,/g, '')) * 1000),
      raw: kRange[0].trim(),
    };
  }

  // Full number range: "$120,000 - $150,000"
  const fullRange = text.match(/\$([\d,]+)\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+)/);
  if (fullRange) {
    const min = parseInt(fullRange[1].replace(/,/g, ''));
    const max = parseInt(fullRange[2].replace(/,/g, ''));
    if (min >= 10000 && max >= 10000) {
      return { min, max, raw: fullRange[0].trim() };
    }
  }

  // Single value with K: "$130K"
  const singleK = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (singleK) {
    const val = Math.round(parseFloat(singleK[1].replace(/,/g, '')) * 1000);
    return { min: val, max: val, raw: singleK[0].trim() };
  }

  // Single full value: "$130,000"
  const single = text.match(/\$([\d,]+)/);
  if (single) {
    const val = parseInt(single[1].replace(/,/g, ''));
    if (val >= 10000) {
      return { min: val, max: val, raw: single[0].trim() };
    }
  }

  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
