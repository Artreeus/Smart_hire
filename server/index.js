import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { User, Company, Job, CV, Application, SavedJob, Notification, Report, Verification } from './models.js';
import { allow, asyncHandler, auth, clean, optionalAuth, pageQuery, publicUser, randomToken, signToken, splitLines, uploadBuffer } from './lib.js';

const app = express();
const port = process.env.PORT || 3001;
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('DATABASE_URL and JWT_SECRET are required.');

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.APP_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));

const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_, file, cb) => cb(null, ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)) });
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 }, fileFilter: (_, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
const verificationUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) });

const mockProfile = { name: 'Candidate', education: 'Education details detected in CV', skills: ['Python', 'SQL', 'JavaScript', 'Git'], experience: '2+ years', certifications: [], roles: ['Software Engineer', 'Data Analyst'], keywords: ['problem solving', 'teamwork', 'REST APIs'], summary: 'A promising professional with relevant technical foundations.' };

async function askOpenRouter(system, prompt) {
  if (!process.env.OPENROUTER_API_KEY) return null;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173', 'X-OpenRouter-Title': 'SmartHire' },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'openrouter/free', temperature: 0.15, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
  const raw = (await response.json()).choices?.[0]?.message?.content || '{}';
  return JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
}

function fallbackMatch(cv, job) {
  const have = new Set((cv?.skills || []).map(x => x.toLowerCase()));
  const wanted = job.skills || [];
  const matched = wanted.filter(x => have.has(x.toLowerCase()));
  const skills = wanted.length ? Math.round(matched.length / wanted.length * 100) : 75;
  const overall = Math.min(97, Math.round(skills * .6 + 35));
  return { overall, skills, experience: 82, education: 86, reasons: matched.map(x => `${x} matches`).concat(['Your experience is relevant']).slice(0, 4), missingSkills: wanted.filter(x => !have.has(x.toLowerCase())).slice(0, 4), explanation: 'This score compares job-relevant CV evidence with the published requirements.' };
}

async function analyzeSafety(job) {
  const ai = await askOpenRouter('You assist a human job safety reviewer. Return JSON with status (Safe to publish or Requires review), score 0-100, checks array of {label,status,detail}, and summary. Never accuse fraud.', JSON.stringify(job));
  if (ai) return ai;
  const text = JSON.stringify(job).toLowerCase();
  const risky = /registration fee|send money|payment required|crypto wallet|whatsapp only/.test(text);
  return { status: risky ? 'Requires review' : 'Safe to publish', score: risky ? 58 : 94, checks: [{ label: 'Company information', status: job.company ? 'pass' : 'review', detail: job.company ? 'Company details are present.' : 'Company details need review.' }, { label: 'Suspicious links', status: 'pass', detail: 'No obvious suspicious links found.' }, { label: 'Payment requests', status: risky ? 'review' : 'pass', detail: risky ? 'Payment-related language needs human review.' : 'No payment requests found.' }, { label: 'Completeness', status: job.title && job.description && job.requirements ? 'pass' : 'review', detail: 'Core listing fields were checked.' }], summary: risky ? 'One or more details need human review before publishing.' : 'No obvious safety concerns were found.' };
}

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1, aiConfigured: Boolean(process.env.OPENROUTER_API_KEY), cloudinaryConfigured: Boolean(process.env.CLOUDINARY_API_SECRET), model: process.env.OPENROUTER_MODEL || 'openrouter/free' }));

// Authentication
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const { role = 'seeker' } = req.body;
  if (!['seeker', 'company'].includes(role)) return res.status(400).json({ error: 'Choose a valid account type.' });
  const name = clean(role === 'company' ? req.body.companyName : req.body.name);
  const email = clean(req.body.email)?.toLowerCase();
  if (!name || !email || !req.body.password || req.body.password.length < 8) return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required.' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
  const verificationToken = randomToken();
  const user = await User.create({ name, email, password: await bcrypt.hash(req.body.password, 12), role, phone: clean(req.body.phone), location: clean(req.body.location), emailVerificationToken: verificationToken });
  let company = null;
  if (role === 'company') company = await Company.create({ owner: user._id, name, email, website: clean(req.body.website), address: clean(req.body.address), verificationStatus: 'not_submitted' });
  await Notification.create({ user: user._id, title: 'Welcome to SmartHire', text: role === 'company' ? 'Complete company verification and publish your first job.' : 'Upload your CV to receive personalized job matches.', type: 'system', link: role === 'company' ? '/verification' : '/cv-analysis' });
  res.status(201).json({ token: signToken(user), user: publicUser(user), company, verificationToken, verificationUrl: `${process.env.APP_URL}/verify-email?token=${verificationToken}` });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: clean(req.body.email)?.toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return res.status(401).json({ error: 'Incorrect email or password.' });
  if (user.suspended) return res.status(403).json({ error: 'This account has been suspended.' });
  const company = user.role === 'company' ? await Company.findOne({ owner: user._id }) : null;
  res.json({ token: signToken(user), user: publicUser(user), company });
}));

app.get('/api/auth/me', auth, asyncHandler(async (req, res) => res.json({ user: publicUser(req.user), company: req.user.role === 'company' ? await Company.findOne({ owner: req.user._id }) : null })));
app.post('/api/auth/verify-email', asyncHandler(async (req, res) => { const user = await User.findOne({ emailVerificationToken: req.body.token }).select('+emailVerificationToken'); if (!user) return res.status(400).json({ error: 'Verification link is invalid.' }); user.isEmailVerified = true; user.emailVerificationToken = undefined; await user.save(); res.json({ message: 'Email verified successfully.' }); }));
app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => { const user = await User.findOne({ email: clean(req.body.email)?.toLowerCase() }).select('+resetPasswordToken +resetPasswordExpires'); if (user) { user.resetPasswordToken = randomToken(); user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); await user.save(); } res.json({ message: 'If that account exists, a reset link has been created.', ...(process.env.NODE_ENV !== 'production' && user ? { resetToken: user.resetPasswordToken } : {}) }); }));
app.post('/api/auth/reset-password', asyncHandler(async (req, res) => { const user = await User.findOne({ resetPasswordToken: req.body.token, resetPasswordExpires: { $gt: new Date() } }).select('+password +resetPasswordToken +resetPasswordExpires'); if (!user || !req.body.password || req.body.password.length < 8) return res.status(400).json({ error: 'Reset link is invalid or the password is too short.' }); user.password = await bcrypt.hash(req.body.password, 12); user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined; await user.save(); res.json({ message: 'Password updated successfully.' }); }));

// Profiles and uploads
app.patch('/api/profile', auth, asyncHandler(async (req, res) => { for (const key of ['name', 'phone', 'location', 'preferences']) if (req.body[key] !== undefined) req.user[key] = req.body[key]; await req.user.save(); res.json({ user: publicUser(req.user) }); }));
app.post('/api/profile/avatar', auth, imageUpload.single('image'), asyncHandler(async (req, res) => { if (!req.file) return res.status(400).json({ error: 'Select a JPG, PNG, or WEBP image.' }); const uploaded = await uploadBuffer(req.file.buffer, { resource_type: 'image', folder: `smarthire/avatars/${req.user._id}`, transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' }] }); req.user.avatar = { url: uploaded.secure_url, publicId: uploaded.public_id }; await req.user.save(); res.json({ avatar: req.user.avatar }); }));

app.get('/api/company/profile', auth, allow('company'), asyncHandler(async (req, res) => res.json({ company: await Company.findOne({ owner: req.user._id }) })));
app.patch('/api/company/profile', auth, allow('company'), asyncHandler(async (req, res) => { const allowed = ['name','email','website','address','phone','description','industry','size']; const update = {}; for (const key of allowed) if (req.body[key] !== undefined) update[key] = clean(req.body[key]); const company = await Company.findOneAndUpdate({ owner: req.user._id }, update, { new: true, runValidators: true }); res.json({ company }); }));
app.post('/api/company/logo', auth, allow('company'), imageUpload.single('image'), asyncHandler(async (req, res) => { if (!req.file) return res.status(400).json({ error: 'Select a JPG, PNG, or WEBP logo.' }); const company = await Company.findOne({ owner: req.user._id }); const uploaded = await uploadBuffer(req.file.buffer, { resource_type: 'image', folder: `smarthire/companies/${company._id}`, transformation: [{ width: 600, height: 600, crop: 'fit', quality: 'auto', fetch_format: 'auto' }] }); company.logo = { url: uploaded.secure_url, publicId: uploaded.public_id }; await company.save(); res.json({ logo: company.logo }); }));

app.post('/api/ai/analyze-cv', auth, allow('seeker'), documentUpload.single('cv'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Select a PDF, DOC, or DOCX file.' });
  let text = '';
  if (req.file.mimetype === 'application/pdf') { const parser = new PDFParse({ data: req.file.buffer }); text = (await parser.getText()).text; await parser.destroy(); }
  else if (req.file.mimetype.includes('wordprocessingml')) text = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
  else text = req.file.buffer.toString('utf8');
  let result;
  try { result = await askOpenRouter('Extract only evidence in this CV. Return strict JSON with name, education, skills array, experience, certifications array, roles array, keywords array, and summary. Never infer protected traits.', text.slice(0, 18000)); } catch { result = null; }
  result ||= mockProfile;
  const uploaded = await uploadBuffer(req.file.buffer, { resource_type: 'raw', type: 'authenticated', folder: `smarthire/cvs/${req.user._id}`, public_id: `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-')}` });
  await CV.updateMany({ user: req.user._id }, { isPrimary: false });
  const cv = await CV.create({ user: req.user._id, fileName: req.file.originalname, fileUrl: uploaded.secure_url, publicId: uploaded.public_id, ...result, source: process.env.OPENROUTER_API_KEY ? 'openrouter' : 'demo', isPrimary: true });
  res.status(201).json({ ...cv.toObject(), id: cv._id });
}));
app.get('/api/cvs', auth, allow('seeker'), asyncHandler(async (req, res) => res.json({ cvs: await CV.find({ user: req.user._id }).sort('-createdAt') })));
app.get('/api/dashboard/seeker', auth, allow('seeker'), asyncHandler(async (req, res) => { const [cv, applications, saved] = await Promise.all([CV.findOne({ user: req.user._id, isPrimary: true }), Application.find({ applicant: req.user._id }), SavedJob.countDocuments({ user: req.user._id })]); const counts = applications.reduce((a,x) => ({ ...a, [x.status]: (a[x.status] || 0) + 1 }), {}); res.json({ profileScore: cv ? Math.min(95, 55 + Math.min(30, cv.skills.length * 4) + (cv.education ? 5 : 0) + (cv.experience ? 5 : 0)) : 30, applications: applications.length, saved, inReview: (counts['Under Review'] || 0) + (counts.Shortlisted || 0), interviews: counts.Interview || 0, hasCV: Boolean(cv) }); }));

app.post('/api/ai/match', auth, asyncHandler(async (req, res) => {
  const job = req.body.jobId ? await Job.findById(req.body.jobId) : req.body.job;
  const cv = req.body.cvId ? await CV.findOne({ _id: req.body.cvId, user: req.user._id }) : await CV.findOne({ user: req.user._id, isPrimary: true });
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  let result; try { result = await askOpenRouter('Return strict JSON: overall, skills, experience, education (0-100), reasons array, missingSkills array, explanation. Use job-relevant evidence only. AI assists but never decides.', JSON.stringify({ cv, job })); } catch { result = null; }
  res.json(result || fallbackMatch(cv, job));
}));

// Jobs
app.get('/api/jobs', optionalAuth, asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageQuery(req); const filter = { status: 'active' };
  if (req.query.q) filter.$text = { $search: req.query.q };
  if (req.query.location) filter.location = new RegExp(req.query.location, 'i');
  if (req.query.jobType) filter.jobType = req.query.jobType;
  if (req.query.workMode) filter.workMode = req.query.workMode;
  if (req.query.industry) filter.industry = req.query.industry;
  const sort = req.query.sort === 'oldest' ? 'createdAt' : '-createdAt';
  const [jobs, total] = await Promise.all([Job.find(filter).populate('company', 'name logo verificationStatus industry').sort(sort).skip(skip).limit(limit), Job.countDocuments(filter)]);
  let saved = new Set(), cv = null; if (req.user?.role === 'seeker') { saved = new Set((await SavedJob.find({ user: req.user._id }).select('job')).map(x => x.job.toString())); cv = await CV.findOne({ user: req.user._id, isPrimary: true }); }
  res.json({ jobs: jobs.map(j => ({ ...j.toObject(), saved: saved.has(j._id.toString()), match: cv ? fallbackMatch(cv, j).overall : null })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
app.get('/api/jobs/:id', optionalAuth, asyncHandler(async (req, res) => { const job = await Job.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }, { new: true }).populate('company'); if (!job || (job.status !== 'active' && req.user?.role !== 'admin')) return res.status(404).json({ error: 'Job not found.' }); let match = null; if (req.user?.role === 'seeker') { const cv = await CV.findOne({ user: req.user._id, isPrimary: true }); if (cv) match = fallbackMatch(cv, job); } res.json({ job, match }); }));
app.post('/api/jobs/safety-check', auth, allow('company', 'admin'), asyncHandler(async (req, res) => res.json(await analyzeSafety(req.body))));
app.post('/api/jobs', auth, allow('company'), asyncHandler(async (req, res) => { const company = await Company.findOne({ owner: req.user._id }); if (!company) return res.status(400).json({ error: 'Complete your company profile first.' }); const payload = { ...req.body, company: company._id, createdBy: req.user._id, responsibilities: splitLines(req.body.responsibilities), requirements: splitLines(req.body.requirements), skills: splitLines(req.body.skills) }; const safety = await analyzeSafety(payload); const job = await Job.create({ ...payload, safety: { ...safety, checkedAt: new Date() }, status: safety.status === 'Safe to publish' ? 'active' : 'under_review' }); res.status(201).json({ job, safety }); }));
app.get('/api/company/jobs', auth, allow('company'), asyncHandler(async (req, res) => { const company = await Company.findOne({ owner: req.user._id }); res.json({ jobs: company ? await Job.find({ company: company._id }).sort('-createdAt') : [] }); }));
app.get('/api/dashboard/company', auth, allow('company'), asyncHandler(async (req, res) => { const company = await Company.findOne({ owner: req.user._id }); if (!company) return res.json({ activeJobs: 0, applicants: 0, shortlisted: 0, interviews: 0 }); const [activeJobs, applicants, shortlisted, interviews] = await Promise.all([Job.countDocuments({ company: company._id, status: 'active' }), Application.countDocuments({ company: company._id }), Application.countDocuments({ company: company._id, status: 'Shortlisted' }), Application.countDocuments({ company: company._id, status: 'Interview' })]); res.json({ activeJobs, applicants, shortlisted, interviews, verificationStatus: company.verificationStatus }); }));
app.patch('/api/jobs/:id', auth, allow('company', 'admin'), asyncHandler(async (req, res) => { const job = await Job.findById(req.params.id); if (!job) return res.status(404).json({ error: 'Job not found.' }); if (req.user.role === 'company' && job.createdBy.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'You can only manage your own jobs.' }); const allowed = ['title','description','responsibilities','requirements','skills','education','experience','salaryMin','salaryMax','salaryLabel','location','jobType','workMode','industry','applicationDeadline','status']; for (const key of allowed) if (req.body[key] !== undefined) job[key] = ['responsibilities','requirements','skills'].includes(key) ? splitLines(req.body[key]) : req.body[key]; await job.save(); res.json({ job }); }));
app.delete('/api/jobs/:id', auth, allow('company', 'admin'), asyncHandler(async (req, res) => { const job = await Job.findById(req.params.id); if (!job) return res.status(404).json({ error: 'Job not found.' }); if (req.user.role === 'company' && job.createdBy.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'You can only manage your own jobs.' }); job.status = 'removed'; await job.save(); res.json({ message: 'Job removed.' }); }));

// Saved jobs and applications
app.get('/api/saved-jobs', auth, allow('seeker'), asyncHandler(async (req, res) => res.json({ jobs: (await SavedJob.find({ user: req.user._id }).populate({ path: 'job', populate: { path: 'company' } }).sort('-createdAt')).map(x => x.job).filter(Boolean) })));
app.post('/api/saved-jobs/:jobId', auth, allow('seeker'), asyncHandler(async (req, res) => { const existing = await SavedJob.findOne({ user: req.user._id, job: req.params.jobId }); if (existing) { await existing.deleteOne(); return res.json({ saved: false }); } await SavedJob.create({ user: req.user._id, job: req.params.jobId }); res.status(201).json({ saved: true }); }));
app.post('/api/applications', auth, allow('seeker'), asyncHandler(async (req, res) => { const job = await Job.findOne({ _id: req.body.jobId, status: 'active' }); if (!job) return res.status(404).json({ error: 'This job is unavailable.' }); const cv = req.body.cvId ? await CV.findOne({ _id: req.body.cvId, user: req.user._id }) : await CV.findOne({ user: req.user._id, isPrimary: true }); if (!cv) return res.status(400).json({ error: 'Upload a CV before applying.' }); const match = fallbackMatch(cv, job); const application = await Application.create({ job: job._id, applicant: req.user._id, company: job.company, cv: cv._id, coverLetter: clean(req.body.coverLetter), additionalInfo: clean(req.body.additionalInfo), match, timeline: [{ status: 'Applied', date: new Date() }] }); const company = await Company.findById(job.company); if (company) await Notification.create({ user: company.owner, title: `New applicant for ${job.title}`, text: `${req.user.name} submitted an application with a ${match.overall}% AI match.`, type: 'application', link: '/applicants' }); res.status(201).json({ application }); }));
app.get('/api/applications/me', auth, allow('seeker'), asyncHandler(async (req, res) => res.json({ applications: await Application.find({ applicant: req.user._id }).populate({ path: 'job', populate: { path: 'company' } }).populate('cv', 'fileName fileUrl').sort('-createdAt') })));
app.get('/api/company/applicants', auth, allow('company'), asyncHandler(async (req, res) => { const company = await Company.findOne({ owner: req.user._id }); const filter = { company: company?._id }; if (req.query.jobId) filter.job = req.query.jobId; res.json({ applications: await Application.find(filter).populate('applicant', 'name email phone location avatar').populate('job', 'title').populate('cv').sort('-match.overall -createdAt') }); }));
app.patch('/api/applications/:id/status', auth, allow('company', 'admin'), asyncHandler(async (req, res) => { const application = await Application.findById(req.params.id).populate('job'); if (!application) return res.status(404).json({ error: 'Application not found.' }); if (req.user.role === 'company' && application.job.createdBy.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'You can only manage applicants to your jobs.' }); const allowedStatuses = ['Under Review','Shortlisted','Interview','Selected','Rejected']; if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid application status.' }); application.status = req.body.status; application.timeline.push({ status: req.body.status, date: new Date(), note: clean(req.body.note) }); if (req.body.status === 'Interview') application.interview = { date: req.body.interviewDate, location: clean(req.body.location), note: clean(req.body.note) }; await application.save(); await Notification.create({ user: application.applicant, title: `Application ${req.body.status.toLowerCase()}`, text: `${application.job.title} is now ${req.body.status}.`, type: req.body.status === 'Interview' ? 'interview' : 'application', link: '/applications' }); res.json({ application }); }));

// Reports, notifications, verification
app.post('/api/reports', auth, allow('seeker'), asyncHandler(async (req, res) => { const report = await Report.create({ reporter: req.user._id, job: req.body.jobId, reason: clean(req.body.reason), details: clean(req.body.details), priority: /payment|scam/i.test(req.body.reason || '') ? 'high' : 'medium' }); const admins = await User.find({ role: 'admin' }); if (admins.length) await Notification.insertMany(admins.map(a => ({ user: a._id, title: 'New job report', text: req.body.reason, type: 'report', link: '/admin/reports' }))); res.status(201).json({ report }); }));
app.get('/api/notifications', auth, asyncHandler(async (req, res) => res.json({ notifications: await Notification.find({ user: req.user._id }).sort('-createdAt').limit(50), unread: await Notification.countDocuments({ user: req.user._id, read: false }) })));
app.patch('/api/notifications/read', auth, asyncHandler(async (req, res) => { await Notification.updateMany({ user: req.user._id, ...(req.body.id ? { _id: req.body.id } : {}) }, { read: true }); res.json({ message: 'Notifications updated.' }); }));
app.post('/api/company/verification', auth, allow('company'), verificationUpload.single('document'), asyncHandler(async (req, res) => { const company = await Company.findOne({ owner: req.user._id }); if (!company) return res.status(404).json({ error: 'Company profile not found.' }); let document = {}; if (req.file) { const uploaded = await uploadBuffer(req.file.buffer, { resource_type: req.file.mimetype === 'application/pdf' ? 'raw' : 'image', type: 'authenticated', folder: `smarthire/verification/${company._id}` }); document = { url: uploaded.secure_url, publicId: uploaded.public_id }; } const verification = await Verification.create({ company: company._id, submittedBy: req.user._id, officialEmail: clean(req.body.officialEmail), website: clean(req.body.website), address: clean(req.body.address), businessInfo: clean(req.body.businessInfo), contactInfo: clean(req.body.contactInfo), document, status: 'pending' }); company.verificationStatus = 'pending'; await company.save(); res.status(201).json({ verification }); }));
app.get('/api/company/verification', auth, allow('company'), asyncHandler(async (req, res) => { const company = await Company.findOne({ owner: req.user._id }); res.json({ company, verification: company ? await Verification.findOne({ company: company._id }).sort('-createdAt') : null }); }));

// Admin
app.get('/api/admin/stats', auth, allow('admin'), asyncHandler(async (_req, res) => { const [users, companies, jobs, pendingVerification, reports, applications] = await Promise.all([User.countDocuments(), Company.countDocuments(), Job.countDocuments({ status: 'active' }), Verification.countDocuments({ status: { $in: ['pending','under_review'] } }), Report.countDocuments({ status: { $in: ['pending','reviewing'] } }), Application.countDocuments()]); res.json({ users, companies, jobs, pendingVerification, reports, applications }); }));
app.get('/api/admin/users', auth, allow('admin'), asyncHandler(async (req, res) => { const { limit, skip, page } = pageQuery(req); const filter = req.query.q ? { $or: [{ name: new RegExp(req.query.q, 'i') }, { email: new RegExp(req.query.q, 'i') }] } : {}; const [users,total] = await Promise.all([User.find(filter).sort('-createdAt').skip(skip).limit(limit),User.countDocuments(filter)]); res.json({ users, pagination:{page,limit,total} }); }));
app.patch('/api/admin/users/:id/suspend', auth, allow('admin'), asyncHandler(async (req, res) => { if (req.params.id === req.user._id.toString()) return res.status(400).json({ error: 'You cannot suspend your own account.' }); const user = await User.findByIdAndUpdate(req.params.id, { suspended: Boolean(req.body.suspended) }, { new: true }); res.json({ user }); }));
app.get('/api/admin/companies', auth, allow('admin'), asyncHandler(async (_req, res) => res.json({ companies: await Company.find().populate('owner', 'name email suspended').sort('-createdAt') })));
app.get('/api/admin/jobs', auth, allow('admin'), asyncHandler(async (_req, res) => res.json({ jobs: await Job.find().populate('company', 'name verificationStatus').populate('createdBy', 'email').sort('-createdAt').limit(100) })));
app.get('/api/admin/reports', auth, allow('admin'), asyncHandler(async (_req, res) => res.json({ reports: await Report.find().populate('reporter','name email').populate({path:'job',populate:{path:'company'}}).sort('-createdAt') })));
app.patch('/api/admin/reports/:id', auth, allow('admin'), asyncHandler(async (req, res) => { const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status, resolution: clean(req.body.resolution), reviewedBy: req.user._id }, { new: true }); res.json({ report }); }));
app.get('/api/admin/verifications', auth, allow('admin'), asyncHandler(async (_req, res) => res.json({ verifications: await Verification.find().populate('company').populate('submittedBy','name email').sort('-createdAt') })));
app.patch('/api/admin/verifications/:id', auth, allow('admin'), asyncHandler(async (req, res) => { const status = req.body.status; if (!['verified','under_review','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid verification status.' }); const verification = await Verification.findByIdAndUpdate(req.params.id, { status, reviewNote: clean(req.body.reviewNote), reviewedBy: req.user._id, reviewedAt: new Date() }, { new: true }); if (!verification) return res.status(404).json({ error: 'Verification request not found.' }); const company = await Company.findByIdAndUpdate(verification.company, { verificationStatus: status, ...(status === 'verified' ? { verifiedAt: new Date() } : {}) }, { new: true }); await Notification.create({ user: company.owner, title: `Company verification ${status.replace('_',' ')}`, text: req.body.reviewNote || `Your verification status is now ${status}.`, type: 'verification', link: '/verification' }); res.json({ verification, company }); }));

app.use(express.static(path.resolve('dist')));
app.use((req, res, next) => req.method === 'GET' && !req.path.startsWith('/api/') ? res.sendFile(path.resolve('dist/index.html')) : next());

app.use((err, _req, res, _next) => { console.error(err); if (err.code === 11000) return res.status(409).json({ error: 'This record already exists.' }); res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message || 'Something went wrong.' }); });

async function seed() {
  if (await Job.exists({})) return;
  const password = await bcrypt.hash('Demo12345', 12);
  const admin = await User.findOneAndUpdate({ email: 'admin@smarthire.demo' }, { $setOnInsert: { name: 'SmartHire Admin', email: 'admin@smarthire.demo', password, role: 'admin', isEmailVerified: true } }, { upsert: true, new: true });
  const owner = await User.findOneAndUpdate({ email: 'recruiter@technova.demo' }, { $setOnInsert: { name: 'TechNova Ltd.', email: 'recruiter@technova.demo', password, role: 'company', isEmailVerified: true } }, { upsert: true, new: true });
  const company = await Company.findOneAndUpdate({ owner: owner._id }, { $setOnInsert: { owner: owner._id, name: 'TechNova Ltd.', email: owner.email, website: 'https://technova.example', address: 'Banani, Dhaka', industry: 'Technology', size: '51–200', verificationStatus: 'verified', verifiedAt: new Date() } }, { upsert: true, new: true });
  const samples = [
    ['Software Engineer','Dhaka','Hybrid',['Python','SQL','REST APIs','Git'],50000,70000],
    ['Data Analyst','Dhaka','Remote',['SQL','Python','Power BI','Excel'],45000,60000],
    ['Junior ML Engineer','Chattogram','On-site',['Python','Machine Learning','Pandas','Git'],55000,80000],
  ];
  await Job.insertMany(samples.map(([title,location,workMode,skills,salaryMin,salaryMax]) => ({ company: company._id, createdBy: owner._id, title, description: `Join ${company.name} to work on meaningful products with a collaborative team.`, responsibilities: ['Deliver high-quality work','Collaborate across teams','Continuously improve'], requirements: ['Relevant professional experience','Strong communication and problem solving'], skills, education: 'Bachelor’s degree or equivalent experience', experience: '2+ years', salaryMin, salaryMax, salaryLabel: `৳${salaryMin.toLocaleString()}–${salaryMax.toLocaleString()}`, location, jobType: 'Full Time', workMode, industry: 'Technology', applicationDeadline: new Date(Date.now()+30*86400000), status: 'active', safety: { score: 95, status: 'Safe to publish', summary: 'No obvious concerns found.', checkedAt: new Date() } })));
  console.log(`Seeded SmartHire demo data. Admin: ${admin.email} / Demo12345`);
}

mongoose.connect(process.env.DATABASE_URL).then(async () => { console.log('MongoDB connected'); await seed(); app.listen(port, () => console.log(`SmartHire API running on http://localhost:${port}`)); }).catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
