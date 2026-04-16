import { NextResponse } from 'next/server';
import { getAllJobs, createJob } from '@/lib/db';
import type { CreateJobInput } from '@/lib/types';

export async function GET() {
  const jobs = getAllJobs();
  return NextResponse.json(jobs);
}

export async function POST(request: Request) {
  const body = await request.json() as CreateJobInput;

  if (!body.title || !body.linkedinUrl || !body.appliedDate) {
    return NextResponse.json({ error: 'Missing required fields: title, linkedinUrl, appliedDate' }, { status: 400 });
  }

  const job = createJob(body);
  return NextResponse.json(job, { status: 201 });
}
