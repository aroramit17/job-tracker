'use client';

import { useState } from 'react';
import type { JobStatus } from '@/lib/types';
import { JOB_STATUSES, STATUS_LABELS } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { useRouter } from 'next/navigation';

export function StatusSelect({ jobId, currentStatus }: { jobId: string; currentStatus: JobStatus }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  async function handleChange(newStatus: JobStatus) {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }
    setUpdating(true);
    setStatus(newStatus);
    setIsOpen(false);

    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    setUpdating(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={updating}
        className="cursor-pointer disabled:opacity-50"
      >
        <StatusBadge status={status} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-1 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
            {JOB_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleChange(s)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${s === status ? 'bg-gray-50 font-medium' : ''}`}
              >
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
