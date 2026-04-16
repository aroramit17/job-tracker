import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const ACTOR_ID = 'curious_coder~linkedin-jobs-scraper';

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  if (!url.includes('linkedin.com/jobs') && !url.includes('linkedin.com/job')) {
    return NextResponse.json({ error: 'Please provide a valid LinkedIn job URL' }, { status: 400 });
  }

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: 'APIFY_API_TOKEN not configured' }, { status: 500 });
  }

  try {
    // Run the Apify actor synchronously and get the dataset items
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [url],
          scrapeJobDetails: true,
          maxItems: 1,
        }),
      }
    );

    if (!runRes.ok) {
      const errText = await runRes.text();
      console.error('Apify error:', runRes.status, errText);
      return NextResponse.json(
        { error: `Scraper failed (status ${runRes.status})` },
        { status: 502 }
      );
    }

    const items = await runRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No job data found at that URL' },
        { status: 404 }
      );
    }

    const job = items[0];

    // Parse salary from the scraped data
    const salaryInfo = parseSalary(job.salary ?? job.salaryRange ?? job.compensation ?? '');
    const descriptionSalary = !salaryInfo && job.description
      ? parseSalaryFromText(job.description)
      : null;

    const result = {
      title: job.title ?? job.jobTitle ?? null,
      company: job.company ?? job.companyName ?? job.organization?.name ?? null,
      description: job.description ?? job.jobDescription ?? null,
      location: job.location ?? job.jobLocation ?? null,
      salaryRaw: salaryInfo?.raw ?? descriptionSalary?.raw ?? job.salary ?? job.salaryRange ?? null,
      salaryMin: salaryInfo?.min ?? descriptionSalary?.min ?? null,
      salaryMax: salaryInfo?.max ?? descriptionSalary?.max ?? null,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Fetch job error:', message);
    return NextResponse.json({ error: `Fetch failed: ${message}` }, { status: 502 });
  }
}

function parseSalary(text: string): { min: number; max: number; raw: string } | null {
  if (!text || text.trim().length === 0) return null;

  // Range with K suffix: "$120K - $150K"
  const kRange = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (kRange) {
    return {
      min: Math.round(parseFloat(kRange[1].replace(/,/g, '')) * 1000),
      max: Math.round(parseFloat(kRange[2].replace(/,/g, '')) * 1000),
      raw: text.trim(),
    };
  }

  // Full number range: "$120,000 - $150,000"
  const fullRange = text.match(/\$([\d,]+)\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+)/);
  if (fullRange) {
    const min = parseInt(fullRange[1].replace(/,/g, ''));
    const max = parseInt(fullRange[2].replace(/,/g, ''));
    if (min >= 10000 && max >= 10000) {
      return { min, max, raw: text.trim() };
    }
  }

  // Single value with K: "$130K"
  const singleK = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (singleK) {
    const val = Math.round(parseFloat(singleK[1].replace(/,/g, '')) * 1000);
    return { min: val, max: val, raw: text.trim() };
  }

  // Single full value: "$130,000"
  const single = text.match(/\$([\d,]+)/);
  if (single) {
    const val = parseInt(single[1].replace(/,/g, ''));
    if (val >= 10000) {
      return { min: val, max: val, raw: text.trim() };
    }
  }

  return null;
}

function parseSalaryFromText(text: string): { min: number; max: number; raw: string } | null {
  const kRange = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]\s*[-–—to]+\s*\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (kRange) {
    return {
      min: Math.round(parseFloat(kRange[1].replace(/,/g, '')) * 1000),
      max: Math.round(parseFloat(kRange[2].replace(/,/g, '')) * 1000),
      raw: kRange[0].trim(),
    };
  }

  const fullRange = text.match(/\$([\d,]+)\s*[-–—to]+\s*\$([\d,]+)/);
  if (fullRange) {
    const min = parseInt(fullRange[1].replace(/,/g, ''));
    const max = parseInt(fullRange[2].replace(/,/g, ''));
    if (min >= 10000 && max >= 10000) {
      return { min, max, raw: fullRange[0].trim() };
    }
  }

  return null;
}
