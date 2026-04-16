import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import type { Job, CreateJobInput, UpdateJobInput } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'jobs.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
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

  return db;
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

export function getAllJobs(): Job[] {
  const rows = getDb().prepare('SELECT * FROM jobs ORDER BY applied_date DESC').all();
  return (rows as Record<string, unknown>[]).map(rowToJob);
}

export function getJobById(id: string): Job | null {
  const row = getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  return row ? rowToJob(row as Record<string, unknown>) : null;
}

export function createJob(input: CreateJobInput): Job {
  const id = nanoid();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO jobs (id, linkedin_url, title, company, salary_min, salary_max, salary_raw, status, applied_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'applied', ?, ?, ?, ?)
  `).run(
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
  );

  return getJobById(id)!;
}

export function updateJob(id: string, input: UpdateJobInput): Job | null {
  const existing = getJobById(id);
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

  getDb().prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getJobById(id);
}

export function deleteJob(id: string): boolean {
  const result = getDb().prepare('DELETE FROM jobs WHERE id = ?').run(id);
  return result.changes > 0;
}
