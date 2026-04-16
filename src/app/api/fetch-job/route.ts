import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
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
        { error: `Page returned status ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();

    // Try structured sources in order of reliability
    const result = parseNextData(html)
      ?? parseJsonLd(html)
      ?? parseMetaTags(html);

    if (!result || (!result.title && !result.company && !result.description)) {
      return NextResponse.json(
        { error: 'Could not parse job details from that URL' },
        { status: 422 }
      );
    }

    // Try salary from description if not found elsewhere
    if (!result.salaryRaw && result.description) {
      const salary = parseSalaryFromText(result.description);
      if (salary) {
        result.salaryRaw = salary.raw;
        result.salaryMin = salary.min;
        result.salaryMax = salary.max;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Fetch failed: ${message}` }, { status: 502 });
  }
}

interface JobResult {
  title: string | null;
  company: string | null;
  description: string | null;
  location: string | null;
  salaryRaw: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
}

// Parse __NEXT_DATA__ JSON (Rippling, Greenhouse, etc.)
function parseNextData(html: string): JobResult | null {
  const match = html.match(/__NEXT_DATA__[^>]*type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const pageProps = data?.props?.pageProps ?? {};

    // Rippling ATS structure
    const api = pageProps.apiData;
    if (api?.jobPost) {
      const jp = api.jobPost;
      const pay = api.payRangeDetails?.[0];
      let salaryRaw: string | null = null;
      let salaryMin: number | null = null;
      let salaryMax: number | null = null;

      if (pay?.rangeStart != null) {
        const min = pay.rangeStart as number;
        const max = (pay.rangeEnd ?? pay.rangeStart) as number;
        salaryMin = min;
        salaryMax = max;
        const sym = pay.currency === 'USD' ? '$' : (pay.currency ?? '$');
        salaryRaw = min === max
          ? `${sym}${min.toLocaleString()}`
          : `${sym}${min.toLocaleString()} - ${sym}${max.toLocaleString()}`;
        if (pay.frequency) salaryRaw += `/${pay.frequency.toLowerCase()}`;
      }

      return {
        title: jp.name ?? null,
        company: jp.companyName ?? api.jobBoard?.companyName ?? null,
        description: extractText(jp.description) ?? null,
        location: jp.workLocations?.[0]?.location ?? pay?.location ?? null,
        salaryRaw,
        salaryMin,
        salaryMax,
      };
    }

    // Greenhouse structure
    const job = pageProps.job ?? pageProps.jobPosting;
    if (job) {
      return {
        title: job.title ?? job.name ?? null,
        company: job.company?.name ?? pageProps.company?.name ?? null,
        description: typeof job.content === 'string' ? stripHtml(job.content) : (job.description ?? null),
        location: job.location?.name ?? job.location ?? null,
        salaryRaw: job.salary ?? job.pay ?? null,
        salaryMin: null,
        salaryMax: null,
      };
    }
  } catch {
    // Invalid JSON
  }

  return null;
}

// Parse JSON-LD JobPosting schema
function parseJsonLd(html: string): JobResult | null {
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'JobPosting') {
          let salaryRaw: string | null = null;
          let salaryMin: number | null = null;
          let salaryMax: number | null = null;

          if (item.baseSalary?.value) {
            const v = item.baseSalary.value;
            salaryMin = v.minValue ?? v.value ?? null;
            salaryMax = v.maxValue ?? v.value ?? null;
            if (salaryMin != null) {
              const sym = item.baseSalary.currency === 'USD' ? '$' : (item.baseSalary.currency ?? '$');
              salaryRaw = salaryMin === salaryMax
                ? `${sym}${salaryMin.toLocaleString()}`
                : `${sym}${salaryMin!.toLocaleString()} - ${sym}${salaryMax!.toLocaleString()}`;
            }
          }

          return {
            title: item.title ?? null,
            company: item.hiringOrganization?.name ?? null,
            description: typeof item.description === 'string' ? stripHtml(item.description) : null,
            location: item.jobLocation?.address?.addressLocality ?? null,
            salaryRaw,
            salaryMin,
            salaryMax,
          };
        }
      }
    } catch {
      // skip
    }
  }
  return null;
}

// Fallback: parse OG meta tags + HTML
function parseMetaTags(html: string): JobResult | null {
  const ogTitle = extractMeta(html, 'og:title');
  const ogDesc = extractMeta(html, 'og:description');
  const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();

  let title = ogTitle ?? pageTitle ?? null;
  let company: string | null = null;

  // Many ATS pages put "Title | Company" or "Title at Company" in og:title
  if (title) {
    title = decodeEntities(title).replace(/\s*\|\s*LinkedIn\s*$/i, '');
    const pipeMatch = title.match(/^(.+?)\s*[|]\s*(.+)$/);
    if (pipeMatch) {
      title = pipeMatch[1].trim();
      company = pipeMatch[2].trim();
    } else {
      const atMatch = title.match(/^(.+?)\s+at\s+(.+)$/i);
      if (atMatch) {
        title = atMatch[1].trim();
        company = atMatch[2].trim();
      }
    }
  }

  // LinkedIn og:description: "Company · Location · Posted..."
  if (!company && ogDesc) {
    const dotMatch = ogDesc.match(/^(.+?)\s*·/);
    if (dotMatch) company = dotMatch[1].trim();
  }

  // Try to get description from common HTML patterns
  const description = extractDescription(html);

  if (!title && !company && !description) return null;

  return {
    title,
    company,
    description: description ?? (ogDesc ? decodeEntities(ogDesc) : null),
    location: null,
    salaryRaw: null,
    salaryMin: null,
    salaryMax: null,
  };
}

function extractDescription(html: string): string | null {
  // LinkedIn
  const linkedin = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div/i);
  if (linkedin) return stripHtml(linkedin[1]).trim() || null;

  // Generic: look for a large content block with job-related classes
  const patterns = [
    /class="[^"]*job[_-]?description[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)/i,
    /class="[^"]*description[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)/i,
    /id="[^"]*job[_-]?description[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const text = stripHtml(m[1]).trim();
      if (text.length > 50) return text;
    }
  }
  return null;
}

function extractMeta(html: string, property: string): string | null {
  const p = escapeRegex(property);
  const m1 = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i'));
  if (m1) return decodeEntities(m1[1]);
  const m2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, 'i'));
  return m2 ? decodeEntities(m2[1]) : null;
}

function extractText(obj: unknown): string | null {
  if (typeof obj === 'string') return stripHtml(obj);
  if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (typeof o.text === 'string') return stripHtml(o.text);
    if (typeof o.html === 'string') return stripHtml(o.html);
    if (typeof o.content === 'string') return stripHtml(o.content);
  }
  return null;
}

function parseSalaryFromText(text: string): { min: number; max: number; raw: string } | null {
  const kRange = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (kRange) {
    return {
      min: Math.round(parseFloat(kRange[1].replace(/,/g, '')) * 1000),
      max: Math.round(parseFloat(kRange[2].replace(/,/g, '')) * 1000),
      raw: kRange[0].trim(),
    };
  }

  const fullRange = text.match(/\$([\d,]+)\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+)/);
  if (fullRange) {
    const min = parseInt(fullRange[1].replace(/,/g, ''));
    const max = parseInt(fullRange[2].replace(/,/g, ''));
    if (min >= 10000 && max >= 10000) {
      return { min, max, raw: fullRange[0].trim() };
    }
  }

  const singleK = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (singleK) {
    const val = Math.round(parseFloat(singleK[1].replace(/,/g, '')) * 1000);
    return { min: val, max: val, raw: singleK[0].trim() };
  }

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
    .replace(/&#x2F;/g, '/')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
