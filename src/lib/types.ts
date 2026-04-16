export type JobStatus = 'applied' | 'screen' | 'interview' | 'offer' | 'accepted' | 'rejected';

export const JOB_STATUSES: JobStatus[] = ['applied', 'screen', 'interview', 'offer', 'accepted', 'rejected'];

export const STATUS_LABELS: Record<JobStatus, string> = {
  applied: 'Applied',
  screen: 'Screen',
  interview: 'Interview',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export interface Job {
  id: string;
  linkedinUrl: string;
  title: string;
  company: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryRaw: string | null;
  status: JobStatus;
  appliedDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  linkedinUrl: string;
  title: string;
  company: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryRaw: string | null;
  appliedDate: string;
  notes?: string;
}

export interface UpdateJobInput {
  status?: JobStatus;
  title?: string;
  company?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryRaw?: string | null;
  notes?: string;
}
