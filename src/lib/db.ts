import { createClient, type Client } from '@libsql/client';
import { nanoid } from 'nanoid';
import type { Job, CreateJobInput, UpdateJobInput } from './types';

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}

let initialized = false;

async function ensureTable(): Promise<void> {
  if (initialized) return;
  await getClient().execute(`
    CREATE TABLE IF NOT EXISTS jobs (
      id            TEXT PRIMARY KEY,
      linkedin_url  TEXT NOT NULL,
      title         TEXT NOT NULL,
      company       TEXT DEFAULT '',
      salary_min    INTEGER,
      salary_max    INTEGER,
      salary_raw    TEXT,
      status        TEXT NOT NULL DEFAULT 'applied',
      applied_date  TEXT NOT NULL,
      notes         TEXT DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  initialized = true;
}

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    linkedinUrl: row.linkedin_url as string,
    title: row.title as string,
    company: (row.company as string) || '',
    salaryMin: row.salary_min as number | null,
    salaryMax: row.salary_max as number | null,
    salaryRaw: row.salary_raw as string | null,
    status: row.status as Job['status'],
    appliedDate: row.applied_date as string,
    notes: (row.notes as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllJobs(): Promise<Job[]> {
  await ensureTable();
  const result = await getClient().execute('SELECT * FROM jobs ORDER BY applied_date DESC');
  return result.rows.map((row) => rowToJob(row as unknown as Record<string, unknown>));
}

export async function getJobById(id: string): Promise<Job | null> {
  await ensureTable();
  const result = await getClient().execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return null;
  return rowToJob(result.rows[0] as unknown as Record<string, unknown>);
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  await ensureTable();
  const id = nanoid();
  const now = new Date().toISOString();

  await getClient().execute({
    sql: `INSERT INTO jobs (id, linkedin_url, title, company, salary_min, salary_max, salary_raw, status, applied_date, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'applied', ?, ?, ?, ?)`,
    args: [
      id,
      input.linkedinUrl,
      input.title,
      input.company || '',
      input.salaryMin,
      input.salaryMax,
      input.salaryRaw,
      input.appliedDate,
      input.notes || '',
      now,
      now,
    ],
  });

  return (await getJobById(id))!;
}

export async function updateJob(id: string, input: UpdateJobInput): Promise<Job | null> {
  await ensureTable();
  const existing = await getJobById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
  if (input.title !== undefined) { fields.push('title = ?'); values.push(input.title); }
  if (input.company !== undefined) { fields.push('company = ?'); values.push(input.company); }
  if (input.salaryMin !== undefined) { fields.push('salary_min = ?'); values.push(input.salaryMin); }
  if (input.salaryMax !== undefined) { fields.push('salary_max = ?'); values.push(input.salaryMax); }
  if (input.salaryRaw !== undefined) { fields.push('salary_raw = ?'); values.push(input.salaryRaw); }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await getClient().execute({
    sql: `UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`,
    args: values as any[],
  });

  return getJobById(id);
}

export async function deleteJob(id: string): Promise<boolean> {
  await ensureTable();
  const result = await getClient().execute({ sql: 'DELETE FROM jobs WHERE id = ?', args: [id] });
  return result.rowsAffected > 0;
}
