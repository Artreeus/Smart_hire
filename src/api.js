const TOKEN_KEY = 'smarthire-token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = token => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...options, headers, body: options.body && !(options.body instanceof FormData) && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export function toUiJob(job) {
  const company = job.company || {};
  const name = company.name || 'Company';
  return {
    ...job,
    id: job._id || job.id,
    companyId: company._id,
    company: name,
    initials: name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase(),
    verified: company.verificationStatus === 'verified',
    type: job.jobType,
    mode: job.workMode,
    salary: job.salaryLabel || (job.salaryMin ? `৳${job.salaryMin.toLocaleString()}–${job.salaryMax?.toLocaleString() || '+'}` : 'Salary negotiable'),
    deadline: job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Open',
    posted: job.createdAt ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.max(1, Math.floor((Date.now() - new Date(job.createdAt)) / 86400000)), 'day') : 'Recently',
    match: Number.isFinite(job.match) ? job.match : null,
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    benefits: job.benefits || [],
    skills: job.skills || [],
    companyDetails: company,
  };
}
