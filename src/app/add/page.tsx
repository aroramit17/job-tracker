import Link from 'next/link';
import { AddJobForm } from '@/components/add-job-form';

export default function AddJobPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Add Job Application</h1>
        <p className="text-sm text-gray-500 mt-1">Paste the job description to auto-fill details</p>
      </div>
      <AddJobForm />
    </main>
  );
}
