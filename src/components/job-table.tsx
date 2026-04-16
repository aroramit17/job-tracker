'use client';

import { useState, useMemo } from 'react';
import type { Job, JobStatus } from '@/lib/types';
import { FilterBar, type SortField, type SortDir } from './filter-bar';
import { JobRow } from './job-row';

const STATUS_ORDER: Record<JobStatus, number> = {
  applied: 0,
  screen: 1,
  interview: 2,
  offer: 3,
  accepted: 4,
  rejected: 5,
};

export function JobTable({ jobs }: { jobs: Job[] }) {
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('appliedDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSortChange(field: SortField) {
    if (field === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    let result = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'appliedDate':
          cmp = a.appliedDate.localeCompare(b.appliedDate);
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'salary':
          cmp = (a.salaryMin ?? 0) - (b.salaryMin ?? 0);
          break;
        case 'status':
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [jobs, filter, sortField, sortDir]);

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">No jobs tracked yet.</p>
        <p className="text-gray-400 mt-1">Add your first application to get started.</p>
        <a
          href="/add"
          className="inline-block mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
        >
          + Add Job
        </a>
      </div>
    );
  }

  return (
    <div>
      <FilterBar
        activeFilter={filter}
        onFilterChange={setFilter}
        sortField={sortField}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        totalCount={jobs.length}
        filteredCount={filtered.length}
      />
      <div className="mt-4">
        <table className="w-full">
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="py-2 px-4">Job</th>
              <th className="py-2 px-4">Salary</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Applied</th>
              <th className="py-2 px-4">Days</th>
              <th className="py-2 px-4 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
