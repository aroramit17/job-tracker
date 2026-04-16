import { getAllJobs } from '@/lib/db';
import { JobTable } from '@/components/job-table';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  const jobs = getAllJobs();

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Track your job applications</p>
        </div>
        <Link
          href="/add"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
        >
          + Add Job
        </Link>
      </div>
      <JobTable jobs={jobs} />
    </main>
  );
}
