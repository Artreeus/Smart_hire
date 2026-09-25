import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Company, Job, User } from './models.js';

let connectionPromise;
let seedPromise;

async function seedDatabase() {
  if (process.env.SEED_DATABASE === 'false' || await Job.exists({})) return;

  const password = await bcrypt.hash('Demo12345', 12);
  const admin = await User.findOneAndUpdate(
    { email: 'admin@smarthire.demo' },
    { $setOnInsert: { name: 'SmartHire Admin', email: 'admin@smarthire.demo', password, role: 'admin', isEmailVerified: true } },
    { upsert: true, new: true },
  );
  const owner = await User.findOneAndUpdate(
    { email: 'recruiter@technova.demo' },
    { $setOnInsert: { name: 'TechNova Ltd.', email: 'recruiter@technova.demo', password, role: 'company', isEmailVerified: true } },
    { upsert: true, new: true },
  );
  const company = await Company.findOneAndUpdate(
    { owner: owner._id },
    { $setOnInsert: { owner: owner._id, name: 'TechNova Ltd.', email: owner.email, website: 'https://technova.example', address: 'Banani, Dhaka', industry: 'Technology', size: '51–200', verificationStatus: 'verified', verifiedAt: new Date() } },
    { upsert: true, new: true },
  );
  const samples = [
    ['Software Engineer', 'Dhaka', 'Hybrid', ['Python', 'SQL', 'REST APIs', 'Git'], 50000, 70000],
    ['Data Analyst', 'Dhaka', 'Remote', ['SQL', 'Python', 'Power BI', 'Excel'], 45000, 60000],
    ['Junior ML Engineer', 'Chattogram', 'On-site', ['Python', 'Machine Learning', 'Pandas', 'Git'], 55000, 80000],
  ];
  await Job.insertMany(samples.map(([title, location, workMode, skills, salaryMin, salaryMax]) => ({
    company: company._id,
    createdBy: owner._id,
    title,
    description: `Join ${company.name} to work on meaningful products with a collaborative team.`,
    responsibilities: ['Deliver high-quality work', 'Collaborate across teams', 'Continuously improve'],
    requirements: ['Relevant professional experience', 'Strong communication and problem solving'],
    skills,
    education: 'Bachelor’s degree or equivalent experience',
    experience: '2+ years',
    salaryMin,
    salaryMax,
    salaryLabel: `৳${salaryMin.toLocaleString()}–${salaryMax.toLocaleString()}`,
    location,
    jobType: 'Full Time',
    workMode,
    industry: 'Technology',
    applicationDeadline: new Date(Date.now() + 30 * 86400000),
    status: 'active',
    safety: { score: 95, status: 'Safe to publish', summary: 'No obvious concerns found.', checkedAt: new Date() },
  })));
  console.log(`Seeded SmartHire demo data. Admin: ${admin.email}`);
}

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

  connectionPromise ||= mongoose.connect(process.env.DATABASE_URL, {
    maxPoolSize: 5,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  }).catch(error => {
    connectionPromise = undefined;
    throw error;
  });

  await connectionPromise;
  seedPromise ||= seedDatabase().catch(error => {
    seedPromise = undefined;
    throw error;
  });
  await seedPromise;
  return mongoose.connection;
}
