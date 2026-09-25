import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const objectId = Schema.Types.ObjectId;

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['seeker', 'company', 'admin'], default: 'seeker' },
  phone: { type: String, trim: true },
  location: { type: String, trim: true },
  avatar: { url: String, publicId: String },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  suspended: { type: Boolean, default: false },
  preferences: {
    jobTypes: [String], workModes: [String], industries: [String],
    minSalary: Number, locations: [String],
  },
}, { timestamps: true });

const CompanySchema = new Schema({
  owner: { type: objectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  website: String, address: String, phone: String, description: String,
  industry: String, size: String,
  logo: { url: String, publicId: String },
  verificationStatus: { type: String, enum: ['not_submitted', 'pending', 'verified', 'under_review', 'rejected'], default: 'not_submitted' },
  verifiedAt: Date,
}, { timestamps: true });

const JobSchema = new Schema({
  company: { type: objectId, ref: 'Company', required: true, index: true },
  createdBy: { type: objectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  responsibilities: [String], requirements: [String], skills: [String],
  education: String, experience: String,
  salaryMin: Number, salaryMax: Number, salaryLabel: String,
  location: { type: String, required: true },
  jobType: { type: String, enum: ['Full Time', 'Part Time', 'Contract', 'Internship', 'Temporary'], default: 'Full Time' },
  workMode: { type: String, enum: ['Remote', 'Hybrid', 'On-site'], default: 'On-site' },
  industry: String, applicationDeadline: Date,
  status: { type: String, enum: ['draft', 'active', 'closed', 'under_review', 'removed'], default: 'draft', index: true },
  safety: { score: Number, status: String, summary: String, checks: [Schema.Types.Mixed], checkedAt: Date },
  viewCount: { type: Number, default: 0 },
}, { timestamps: true });
JobSchema.index({ title: 'text', description: 'text', skills: 'text', location: 'text' });

const CVSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  fileName: String, fileUrl: String, publicId: String,
  name: String, education: String, skills: [String], experience: String,
  certifications: [String], roles: [String], keywords: [String], summary: String,
  source: String, isPrimary: { type: Boolean, default: true },
}, { timestamps: true });

const ApplicationSchema = new Schema({
  job: { type: objectId, ref: 'Job', required: true, index: true },
  applicant: { type: objectId, ref: 'User', required: true, index: true },
  company: { type: objectId, ref: 'Company', required: true, index: true },
  cv: { type: objectId, ref: 'CV' },
  coverLetter: String, additionalInfo: String,
  status: { type: String, enum: ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Selected', 'Rejected'], default: 'Applied' },
  timeline: [{ status: String, date: { type: Date, default: Date.now }, note: String }],
  interview: { date: Date, location: String, note: String },
  match: { overall: Number, skills: Number, experience: Number, education: Number, reasons: [String], missingSkills: [String], explanation: String },
}, { timestamps: true });
ApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

const SavedJobSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true },
  job: { type: objectId, ref: 'Job', required: true },
}, { timestamps: true });
SavedJobSchema.index({ user: 1, job: 1 }, { unique: true });

const NotificationSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true }, text: String,
  type: { type: String, enum: ['match', 'application', 'interview', 'report', 'verification', 'system'], default: 'system' },
  link: String, read: { type: Boolean, default: false },
}, { timestamps: true });

const ReportSchema = new Schema({
  reporter: { type: objectId, ref: 'User', required: true },
  job: { type: objectId, ref: 'Job', required: true, index: true },
  reason: { type: String, required: true }, details: String,
  status: { type: String, enum: ['pending', 'reviewing', 'resolved', 'dismissed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  resolution: String, reviewedBy: { type: objectId, ref: 'User' },
}, { timestamps: true });

const VerificationSchema = new Schema({
  company: { type: objectId, ref: 'Company', required: true, index: true },
  submittedBy: { type: objectId, ref: 'User', required: true },
  officialEmail: String, website: String, address: String, businessInfo: String, contactInfo: String,
  document: { url: String, publicId: String },
  status: { type: String, enum: ['pending', 'verified', 'under_review', 'rejected'], default: 'pending' },
  reviewNote: String, reviewedBy: { type: objectId, ref: 'User' }, reviewedAt: Date,
}, { timestamps: true });

export const User = models.User || model('User', UserSchema);
export const Company = models.Company || model('Company', CompanySchema);
export const Job = models.Job || model('Job', JobSchema);
export const CV = models.CV || model('CV', CVSchema);
export const Application = models.Application || model('Application', ApplicationSchema);
export const SavedJob = models.SavedJob || model('SavedJob', SavedJobSchema);
export const Notification = models.Notification || model('Notification', NotificationSchema);
export const Report = models.Report || model('Report', ReportSchema);
export const Verification = models.Verification || model('Verification', VerificationSchema);
