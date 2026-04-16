import type { JobStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

const STATUS_COLORS: Record<JobStatus, string> = {
  applied: 'bg-gray-100 text-gray-700',
  screen: 'bg-blue-100 text-blue-700',
  interview: 'bg-yellow-100 text-yellow-800',
  offer: 'bg-green-100 text-green-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const DOT_COLORS: Record<JobStatus, string> = {
  applied: 'bg-gray-400',
  screen: 'bg-blue-500',
  interview: 'bg-yellow-500',
  offer: 'bg-green-500',
  accepted: 'bg-emerald-500',
  rejected: 'bg-red-500',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
