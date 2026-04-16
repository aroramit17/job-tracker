'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Job } from '@/lib/types';
import { StatusSelect } from './status-select';

function daysSince(dateStr: string): number {
  const applied = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - applied.getTime()) / 86400000);
}

function formatSalary(min: number | null, max: number | null, raw: string | null): string {
  if (raw) return raw;
  if (min === null && max === null) return '—';
  if (min === max && min !== null) return `$${(min / 1000).toFixed(0)}K`;
  if (min !== null && max !== null) return `$${(min / 1000).toFixed(0)}K - $${(max / 1000).toFixed(0)}K`;
  return '—';
}

function daysColor(days: number): string {
  if (days >= 30) return 'text-red-600 font-medium';
  if (days >= 14) return 'text-amber-600 font-medium';
  return 'text-gray-500';
}

export function JobRow({ job }: { job: Job }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const days = daysSince(job.appliedDate);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    setDeleting(false);
    setShowConfirm(false);
    router.refresh();
  }

  return (
    <>
      {/* Desktop row */}
      <tr className="hidden md:table-row border-b border-gray-100 hover:bg-gray-50 group">
        <td className="py-3 px-4">
          <div className="font-medium text-gray-900">{job.title}</div>
          <div className="text-sm text-gray-500 flex items-center gap-1">
            {job.company || 'Unknown company'}
            {job.linkedinUrl && (
              <a href={job.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-gray-700">
          {formatSalary(job.salaryMin, job.salaryMax, job.salaryRaw)}
        </td>
        <td className="py-3 px-4">
          <StatusSelect jobId={job.id} currentStatus={job.status} />
        </td>
        <td className="py-3 px-4 text-sm text-gray-500">
          {new Date(job.appliedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </td>
        <td className={`py-3 px-4 text-sm ${daysColor(days)}`}>
          {days}d
        </td>
        <td className="py-3 px-4">
          <button
            onClick={() => setShowConfirm(true)}
            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>

      {/* Mobile card */}
      <tr className="md:hidden">
        <td colSpan={6} className="p-0">
          <div className="border-b border-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900">{job.title}</div>
                <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                  {job.company || 'Unknown company'}
                  {job.linkedinUrl && (
                    <a href={job.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                      <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
              <StatusSelect jobId={job.id} currentStatus={job.status} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-gray-600">{formatSalary(job.salaryMin, job.salaryMax, job.salaryRaw)}</span>
              <span className="text-gray-400">
                {new Date(job.appliedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className={daysColor(days)}>{days}d ago</span>
              <button onClick={() => setShowConfirm(true)} className="ml-auto text-gray-300 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </td>
      </tr>

      {/* Delete confirmation dialog */}
      {showConfirm && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
                <h3 className="text-lg font-medium text-gray-900">Delete application?</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Remove <strong>{job.title}</strong> at {job.company || 'Unknown company'}? This can&apos;t be undone.
                </p>
                <div className="mt-4 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
