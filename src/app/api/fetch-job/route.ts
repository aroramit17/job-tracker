import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const ACTOR_ID = 'curious_coder~linkedin-jobs-scraper';

// POST: start an actor run, return the run ID immediately
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
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/runs?token=${APIFY_TOKEN}`,
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
      console.error('Apify start error:', runRes.status, errText);
      return NextResponse.json({ error: 'Failed to start scraper' }, { status: 502 });
    }

    const run = await runRes.json();
    return NextResponse.json({ runId: run.data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Fetch failed: ${message}` }, { status: 502 });
  }
}

// GET: poll for run status and return results when ready
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');

  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: 'APIFY_API_TOKEN not configured' }, { status: 500 });
  }

  try {
    // Check run status
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );

    if (!statusRes.ok) {
      return NextResponse.json({ error: 'Failed to check run status' }, { status: 502 });
    }

    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === 'RUNNING' || status === 'READY') {
      return NextResponse.json({ status: 'pending' });
    }

    if (status !== 'SUCCEEDED') {
      return NextResponse.json(
        { status: 'failed', error: `Scraper ${status?.toLowerCase() || 'failed'}` },
        { status: 502 }
      );
    }

    // Run succeeded — fetch dataset items
    const datasetId = statusData.data?.defaultDatasetId;
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
    );

    if (!itemsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 502 });
    }

    const items = await itemsRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { status: 'done', error: 'No job data found at that URL' },
        { status: 404 }
      );
    }

    const job = items[0];

    const salaryInfo = parseSalary(job.salary ?? job.salaryRange ?? job.compensation ?? '');
    const descriptionSalary = !salaryInfo && job.description
      ? parseSalaryFromText(job.description)
      : null;

    return NextResponse.json({
      status: 'done',
      title: job.title ?? job.jobTitle ?? null,
      company: job.company ?? job.companyName ?? job.organization?.name ?? null,
      description: job.description ?? job.jobDescription ?? null,
      location: job.location ?? job.jobLocation ?? null,
      salaryRaw: salaryInfo?.raw ?? descriptionSalary?.raw ?? job.salary ?? job.salaryRange ?? null,
      salaryMin: salaryInfo?.min ?? descriptionSalary?.min ?? null,
      salaryMax: salaryInfo?.max ?? descriptionSalary?.max ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Poll failed: ${message}` }, { status: 502 });
  }
}

function parseSalary(text: string): { min: number; max: number; raw: string } | null {
  if (!text || text.trim().length === 0) return null;

  const kRange = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (kRange) {
    return {
      min: Math.round(parseFloat(kRange[1].replace(/,/g, '')) * 1000),
      max: Math.round(parseFloat(kRange[2].replace(/,/g, '')) * 1000),
      raw: text.trim(),
    };
  }

  const fullRange = text.match(/\$([\d,]+)\s*(?:\/\s*(?:yr|year|hr|hour))?\s*[-–—to]+\s*\$([\d,]+)/);
  if (fullRange) {
    const min = parseInt(fullRange[1].replace(/,/g, ''));
    const max = parseInt(fullRange[2].replace(/,/g, ''));
    if (min >= 10000 && max >= 10000) {
      return { min, max, raw: text.trim() };
    }
  }

  const singleK = text.match(/\$([\d,]+(?:\.\d+)?)\s*[Kk]/);
  if (singleK) {
    const val = Math.round(parseFloat(singleK[1].replace(/,/g, '')) * 1000);
    return { min: val, max: val, raw: text.trim() };
  }

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
