import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Application, Company, CV, Job, User } from './models.js';

let connectionPromise;
let seedPromise;

async function seedDatabase() {
  if (process.env.SEED_DATABASE === 'false') return;

  let admin = await User.findOne({ role: 'admin' }).select('+password');
  if (!admin) {
    admin = await User.create({
      name: 'SmartHire Admin', username: 'admin', email: 'admin@smarthire.demo',
      password: await bcrypt.hash('admin', 12), role: 'admin', isEmailVerified: true,
    });
  } else {
    admin.username = 'admin';
    if (!(await bcrypt.compare('admin', admin.password))) admin.password = await bcrypt.hash('admin', 12);
    admin.isEmailVerified = true;
    admin.suspended = false;
    await admin.save();
  }

  const password = await bcrypt.hash('Demo12345', 12);
  const companySpecs = [
    { key: 'technova', name: 'TechNova Ltd.', email: 'recruiter@technova.demo', website: 'https://technova.example', address: 'Banani, Dhaka', industry: 'Software & Technology', size: '51–200', description: 'A product engineering company building dependable business software for teams across South Asia.' },
    { key: 'datapulse', name: 'DataPulse Analytics', email: 'careers@datapulse.demo', website: 'https://datapulse.example', address: 'Gulshan, Dhaka', industry: 'Data & Analytics', size: '11–50', description: 'A data consultancy helping growing organizations make faster, evidence-led decisions.' },
    { key: 'orbit', name: 'Orbit AI Labs', email: 'talent@orbitai.demo', website: 'https://orbitai.example', address: 'Agrabad, Chattogram', industry: 'Artificial Intelligence', size: '11–50', description: 'An applied AI studio developing practical language and forecasting tools for local businesses.' },
    { key: 'pixelcraft', name: 'PixelCraft Studio', email: 'hello@pixelcraft.demo', website: 'https://pixelcraft.example', address: 'Zindabazar, Sylhet', industry: 'Design & Software', size: '11–50', description: 'A remote-friendly digital product studio focused on accessible web and mobile experiences.' },
    { key: 'greencart', name: 'GreenCart Logistics', email: 'people@greencart.demo', website: 'https://greencart.example', address: 'Uttara, Dhaka', industry: 'Logistics & Supply Chain', size: '201–500', description: 'A technology-enabled logistics network improving delivery reliability for commerce businesses.' },
    { key: 'finedge', name: 'FinEdge Technologies', email: 'jobs@finedge.demo', website: 'https://finedge.example', address: 'Motijheel, Dhaka', industry: 'Financial Technology', size: '51–200', description: 'A financial technology company creating secure payment and operations tools for modern businesses.' },
  ];
  const companies = {};
  for (const spec of companySpecs) {
    const owner = await User.findOneAndUpdate(
      { email: spec.email },
      { $setOnInsert: { name: spec.name, email: spec.email, password, role: 'company', isEmailVerified: true } },
      { upsert: true, new: true },
    );
    companies[spec.key] = {
      owner,
      company: await Company.findOneAndUpdate(
        { owner: owner._id },
        { $set: { name: spec.name, email: spec.email, website: spec.website, address: spec.address, industry: spec.industry, size: spec.size, description: spec.description, verificationStatus: 'verified', verifiedAt: new Date() } },
        { upsert: true, new: true, runValidators: true },
      ),
    };
  }

  const jobSpecs = [
    ['technova','Software Engineer','Dhaka','Hybrid','Software & Technology',['Python','Django','PostgreSQL','REST APIs'],'2–4 years',65000,95000,'Build and evolve reliable backend services used by growing businesses.',['Design and maintain production APIs','Review code and improve engineering standards','Collaborate with product and frontend teams'],['Professional backend development experience','Strong Python and relational database skills','Clear technical communication'],['Hybrid work','Health coverage','Learning budget']],
    ['technova','Frontend Engineer','Dhaka','Hybrid','Software & Technology',['React','TypeScript','CSS','Accessibility'],'2+ years',60000,90000,'Create fast, accessible product experiences within a mature component system.',['Ship responsive product interfaces','Improve performance and accessibility','Partner closely with design'],['Strong React fundamentals','Experience translating designs into reusable UI','Understanding of browser performance'],['Hybrid work','Equipment budget','Two festival bonuses']],
    ['datapulse','Data Analyst','Dhaka','Remote','Data & Analytics',['SQL','Python','Power BI','Excel'],'1–3 years',50000,75000,'Turn operational data into clear dashboards and recommendations for business leaders.',['Build dashboards and recurring reports','Investigate trends and anomalies','Present findings to non-technical teams'],['Strong SQL and spreadsheet knowledge','Experience with a BI platform','Careful analytical communication'],['Remote-first team','Internet allowance','Annual learning fund']],
    ['datapulse','Analytics Engineer','Dhaka','Remote','Data & Analytics',['SQL','dbt','Python','Data Modeling'],'3+ years',85000,125000,'Build trustworthy analytics models that make self-service reporting possible.',['Model clean analytics datasets','Maintain data quality checks','Support analysts with reusable metrics'],['Advanced SQL','Dimensional modeling experience','Comfort with version-controlled workflows'],['Remote-first team','Flexible hours','Certification support']],
    ['orbit','Junior ML Engineer','Chattogram','On-site','Artificial Intelligence',['Python','Machine Learning','Pandas','FastAPI'],'1+ year',60000,85000,'Help take practical machine-learning features from experiment to production.',['Prepare and validate datasets','Train and evaluate models','Document experiments and APIs'],['Solid Python fundamentals','Understanding of core ML concepts','A portfolio or relevant project work'],['Technical mentorship','Research days','Lunch allowance']],
    ['orbit','AI Product Associate','Chattogram','Hybrid','Artificial Intelligence',['Product Discovery','Prompt Design','Analytics','Documentation'],'1–2 years',45000,65000,'Connect customer problems with useful, responsible AI product capabilities.',['Run product discovery sessions','Write clear feature requirements','Evaluate AI output quality'],['Strong structured thinking','Excellent written communication','Interest in responsible AI'],['Hybrid schedule','Mentorship','Learning budget']],
    ['pixelcraft','Product Designer','Remote','Remote','Design & Software',['Figma','UX Research','Prototyping','Design Systems'],'3+ years',70000,105000,'Lead thoughtful product design from discovery through polished delivery.',['Own end-to-end product design','Run focused user research','Grow a reusable design system'],['Strong product design portfolio','Experience with complex workflows','Excellent collaboration skills'],['Work from anywhere','Design conference budget','Flexible leave']],
    ['pixelcraft','React Developer','Sylhet','Remote','Design & Software',['React','JavaScript','CSS','Playwright'],'2+ years',55000,80000,'Build polished web products for international teams with a quality-first workflow.',['Develop reusable React components','Write reliable UI tests','Collaborate with designers and backend engineers'],['Strong JavaScript and React skills','Attention to visual detail','Experience with Git workflows'],['Remote work','Flexible hours','Project completion bonus']],
    ['greencart','Operations Analyst','Dhaka','On-site','Logistics & Supply Chain',['Excel','SQL','Process Mapping','Reporting'],'2+ years',48000,68000,'Improve delivery performance through structured analysis and better operating processes.',['Analyze delivery performance','Create weekly operations reports','Identify and test process improvements'],['Strong spreadsheet skills','Analytical problem solving','Comfort working with operations teams'],['Transport allowance','Health coverage','Performance bonus']],
    ['greencart','Backend Developer','Dhaka','Hybrid','Logistics & Supply Chain',['Node.js','MongoDB','Redis','Docker'],'3+ years',80000,115000,'Develop services that coordinate thousands of time-sensitive deliveries.',['Build scalable logistics services','Improve observability and reliability','Review designs and production incidents'],['Production Node.js experience','Strong database fundamentals','Experience with distributed systems'],['Hybrid work','Provident fund','Training allowance']],
    ['finedge','QA Automation Engineer','Dhaka','Hybrid','Financial Technology',['Playwright','JavaScript','API Testing','CI/CD'],'2+ years',60000,85000,'Build automation that protects critical financial workflows and release confidence.',['Create end-to-end and API tests','Investigate regressions','Improve CI quality signals'],['Test automation experience','API testing knowledge','Clear debugging and documentation'],['Hybrid work','Certification support','Health coverage']],
    ['finedge','Security Operations Associate','Dhaka','On-site','Financial Technology',['SIEM','Incident Response','Linux','Networking'],'1–3 years',55000,80000,'Monitor security signals and help protect a growing financial platform.',['Review security alerts','Support incident response','Maintain operational playbooks'],['Security fundamentals','Comfort with Linux and networking','Calm, careful communication'],['Shift allowance','Security training','Health coverage']],
  ];
  const seededJobs = {};
  for (const [companyKey,title,location,workMode,industry,skills,experience,salaryMin,salaryMax,description,responsibilities,requirements,benefits] of jobSpecs) {
    const { owner, company } = companies[companyKey];
    seededJobs[`${companyKey}:${title}`] = await Job.findOneAndUpdate(
      { company: company._id, title },
      { $set: { createdBy: owner._id, description, responsibilities, requirements, skills, benefits, education: 'Bachelor’s degree or equivalent practical experience', experience, salaryMin, salaryMax, salaryLabel: `৳${salaryMin.toLocaleString()}–${salaryMax.toLocaleString()}`, location, jobType: 'Full Time', workMode, industry, applicationDeadline: new Date(Date.now() + 30 * 86400000), status: 'active', safety: { score: 96, status: 'Safe to publish', summary: 'Company information and listing content passed automated checks.', checkedAt: new Date() } } },
      { upsert: true, new: true, runValidators: true },
    );
  }
  const candidateSpecs = [
    ['Nadia Rahman','nadia@candidate.demo','Dhaka',['Python','Django','PostgreSQL','Git'],'2.5 years','BSc in Computer Science',['technova:Software Engineer','Shortlisted'],92],
    ['Farhan Ahmed','farhan@candidate.demo','Dhaka',['React','TypeScript','CSS','Accessibility'],'3 years','BSc in Software Engineering',['technova:Frontend Engineer','Under Review'],88],
    ['Tasnim Chowdhury','tasnim@candidate.demo','Chattogram',['Python','Machine Learning','Pandas','FastAPI'],'1.5 years','BSc in Computer Science',['orbit:Junior ML Engineer','Interview'],86],
    ['Sakib Hasan','sakib@candidate.demo','Dhaka',['Node.js','MongoDB','Redis','Docker'],'3 years','BSc in Information Technology',['greencart:Backend Developer','Applied'],83],
    ['Ayesha Khan','ayesha@candidate.demo','Dhaka',['Playwright','JavaScript','API Testing','CI/CD'],'2 years','BSc in Computer Science',['finedge:QA Automation Engineer','Under Review'],90],
  ];
  for (const [name,email,location,skills,experience,education,[jobKey,status],overall] of candidateSpecs) {
    const candidate = await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { name, email, password, role: 'seeker', isEmailVerified: true, location } },
      { upsert: true, new: true },
    );
    const cv = await CV.findOneAndUpdate(
      { user: candidate._id, source: 'sample' },
      { $set: { name, education, skills, experience, certifications: [], roles: [], keywords: skills, summary: `${name} is a ${experience} professional focused on ${skills.slice(0,2).join(' and ')}.`, isPrimary: true } },
      { upsert: true, new: true },
    );
    const job = seededJobs[jobKey];
    if (job) await Application.findOneAndUpdate(
      { job: job._id, applicant: candidate._id },
      { $set: {
        company: job.company,
        cv: cv._id,
        status,
        coverLetter: `I am interested in the ${job.title} role and believe my relevant experience would help me contribute.`,
        match: { overall, skills: overall + 2, experience: overall - 2, education: overall, reasons: skills.slice(0,3).map(skill => `${skill} aligns with the role`), missingSkills: [], explanation: 'The profile shows strong overlap with the role’s core requirements.' },
        timeline: [{ status: 'Applied', date: new Date(Date.now() - 5 * 86400000) }, ...(status !== 'Applied' ? [{ status, date: new Date() }] : [])],
      } },
      { upsert: true, new: true },
    );
  }
  console.log('SmartHire sample marketplace data is ready.');
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
