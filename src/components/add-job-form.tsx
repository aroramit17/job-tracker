'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseJobDescription } from '@/lib/parser';

export function AddJobForm() {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [salaryRaw, setSalaryRaw] = useState('');
  const [salaryMin, setSalaryMin] = useState<number | null>(null);
  const [salaryMax, setSalaryMax] = useState<number | null>(null);
  const [appliedDate, setAppliedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [parsed, setParsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  function handleDescriptionChange(text: string) {
    setDescription(text);
    if (text.trim().length > 20) {
      const result = parseJobDescription(text);
      if (result.title && !title) setTitle(result.title);
      if (result.company && !company) setCompany(result.company);
      if (result.salaryRaw) {
        setSalaryRaw(result.salaryRaw);
        setSalaryMin(result.salaryMin);
        setSalaryMax(result.salaryMax);
      }
      setParsed(true);
    }
  }

  async function handleFetchLinkedIn() {
    if (!linkedinUrl.trim()) {
      setError('Enter a LinkedIn URL first');
      return;
    }
    setError('');
    setFetching(true);
    try {
      const res = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkedinUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch job details');
        return;
      }
      if (data.title) setTitle(data.title);
      if (data.company) setCompany(data.company);
      if (data.description) setDescription(data.description);
      if (data.salaryRaw) {
        setSalaryRaw(data.salaryRaw);
        setSalaryMin(data.salaryMin);
        setSalaryMax(data.salaryMax);
      }
      setParsed(true);
    } catch {
      setError('Network error fetching job details');
    } finally {
      setFetching(false);
    }
  }

  function handleReparse() {
    const result = parseJobDescription(description);
    if (result.title) setTitle(result.title);
    if (result.company) setCompany(result.company);
    if (result.salaryRaw) {
      setSalaryRaw(result.salaryRaw);
      setSalaryMin(result.salaryMin);
      setSalaryMax(result.salaryMax);
    }
    setParsed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Job title is required');
      return;
    }
    if (!linkedinUrl.trim()) {
      setError('LinkedIn URL is required');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkedinUrl: linkedinUrl.trim(),
        title: title.trim(),
        company: company.trim(),
        salaryMin,
        salaryMax,
        salaryRaw: salaryRaw || null,
        appliedDate,
        notes: notes.trim(),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to save');
      setSubmitting(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Job URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            type="button"
            onClick={handleFetchLinkedIn}
            disabled={fetching || !linkedinUrl.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            {fetching ? 'Fetching...' : 'Fetch'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Paste Job Description
          <span className="text-gray-400 font-normal ml-2">Title and salary will be auto-parsed</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Paste the full job description from LinkedIn here..."
          rows={6}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-y"
        />
        {description.trim().length > 0 && (
          <button
            type="button"
            onClick={handleReparse}
            className="mt-1 text-xs text-blue-600 hover:text-blue-800"
          >
            Re-parse description
          </button>
        )}
      </div>

      {parsed && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Parsed Fields (editable)</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
            <input
              type="text"
              value={salaryRaw}
              onChange={(e) => setSalaryRaw(e.target.value)}
              placeholder="e.g. $120,000 - $150,000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {!parsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Applied</label>
          <input
            type="date"
            value={appliedDate}
            onChange={(e) => setAppliedDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this application..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Application'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
