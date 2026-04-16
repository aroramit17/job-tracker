import { NextResponse } from 'next/server';
import { updateJob, deleteJob } from '@/lib/db';
import type { UpdateJobInput } from '@/lib/types';
import { JOB_STATUSES } from '@/lib/types';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json() as UpdateJobInput;

  if (body.status && !JOB_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const job = await updateJob(id, body);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteJob(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
