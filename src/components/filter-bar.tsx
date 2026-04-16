'use client';

import type { JobStatus } from '@/lib/types';
import { JOB_STATUSES, STATUS_LABELS } from '@/lib/types';

export type SortField = 'appliedDate' | 'title' | 'salary' | 'status';
export type SortDir = 'asc' | 'desc';

interface FilterBarProps {
  activeFilter: JobStatus | 'all';
  onFilterChange: (filter: JobStatus | 'all') => void;
  sortField: SortField;
  sortDir: SortDir;
  onSortChange: (field: SortField) => void;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({ activeFilter, onFilterChange, sortField, sortDir, onSortChange, totalCount, filteredCount }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            activeFilter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {JOB_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => onFilterChange(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeFilter === s
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>{filteredCount} of {totalCount} jobs</span>
        <select
          value={sortField}
          onChange={(e) => onSortChange(e.target.value as SortField)}
          className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white"
        >
          <option value="appliedDate">Date Applied</option>
          <option value="title">Title</option>
          <option value="salary">Salary</option>
          <option value="status">Status</option>
        </select>
        <button
          onClick={() => onSortChange(sortField)}
          className="text-gray-400 hover:text-gray-600"
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  );
}
