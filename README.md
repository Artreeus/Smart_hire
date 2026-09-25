# SmartHire

SmartHire is a full-stack, AI-assisted job marketplace that connects job seekers with verified employers. It combines CV analysis, explainable job matching, company verification, job-safety review, application tracking, recruiter tooling, and platform moderation in one responsive SaaS application.

The project is designed as a university-standard production prototype: core workflows persist in MongoDB, uploaded assets are stored securely through Cloudinary, authentication is role-protected, and AI calls remain on the server.

## Core capabilities

### Job seekers

- Register, verify an email token, log in, reset a password, and manage a profile
- Upload PDF, DOC, and DOCX CVs for structured AI analysis
- Extract education, skills, experience, certifications, keywords, and suggested roles
- Search jobs by keyword, company, location, job type, work mode, and industry
- Receive explainable match scores based on skills, experience, and education
- Review matching reasons and missing skills instead of receiving only a score
- Save and remove jobs from a persistent shortlist
- Apply with a selected CV, cover letter, and additional information
- Track applications through Applied, Under Review, Shortlisted, Interview, Selected, and Rejected stages
- Receive persistent notifications about applications and interviews
- Confidentially report suspicious, misleading, duplicate, or payment-requesting jobs

### Companies and recruiters

- Register a company account and maintain a public company profile
- Upload an optimized company logo through Cloudinary
- Submit official details and private documents for company verification
- Create complete job listings with responsibilities, requirements, skills, education, salary, location, work mode, and deadlines
- Run an AI-assisted safety check before publishing
- Publish safe listings or submit uncertain listings for human review
- Close, reopen, update, and remove company-owned jobs
- View applicants ordered by job-relevant AI match information
- Review extracted CV evidence and update application stages
- Trigger applicant notifications when stages change
- View live hiring statistics from MongoDB

### Administrators

- View live totals for users, companies, jobs, applications, reports, and verification requests
- Search and manage platform accounts
- Suspend and restore accounts without allowing self-suspension
- Review all company verification submissions
- Approve companies, request further information, or reject verification
- Review user reports with reporter and job context
- Resolve or dismiss reports without automatically accusing an employer
- Approve or remove job listings
- Monitor the platform through a dedicated role-protected workspace

## AI functionality

SmartHire uses OpenRouter from the server for:

- `analyzeCV()` — extracts structured CV evidence
- `extractSkills()` — identifies job-relevant skills and keywords
- `matchCVWithJob()` — scores and explains candidate/job alignment
- `recommendJobs()` — ranks available roles against a job seeker profile
- `analyzeJobSafety()` — checks completeness and possible safety concerns
- `matchApplicants()` — assists recruiters with job-relevant comparisons

The default model route is `openrouter/free`. If an API key is unavailable, deterministic fallback logic keeps the complete workflow usable. AI scores are advisory and never make final hiring, fraud, or moderation decisions.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, React Router, Vite, Lucide icons |
| Backend | Node.js, Express |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JWT, bcrypt password hashing |
| AI | OpenRouter chat completions |
| Media | Cloudinary signed server uploads |
| CV parsing | `pdf-parse`, Mammoth |
| Security | Helmet, CORS, rate limiting, role/ownership middleware |
| Styling | Responsive custom CSS design system |

## Project structure

```text
Smart_hire/
├── server/
│   ├── index.js        # API routes, AI services, seed and application server
│   ├── lib.js          # Authentication, Cloudinary and shared helpers
│   └── models.js       # Mongoose schemas and relationships
├── src/
│   ├── api.js          # Authenticated browser API client and job adapter
│   ├── App.jsx         # Role workspaces, pages, forms and workflows
│   ├── data.js         # Visual fallback/example content
│   ├── main.jsx        # React entry point
│   └── styles.css      # Responsive SmartHire design system
├── docs/               # Architecture, API, security and deployment guides
├── .env.example        # Required environment variable template
├── index.html
├── package.json
└── vite.config.js
```

## Environment configuration

Copy `.env.example` to `.env`:

```env
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/smarthire
JWT_SECRET=replace_with_a_long_random_secret
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/free
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
APP_URL=http://localhost:5173
PORT=3001
```

Never commit `.env`. The repository ignores it by default. All private keys are read only by the Express server.

## Local development

Requirements:

- Node.js 20 or newer
- A MongoDB deployment
- A Cloudinary product environment
- An optional OpenRouter key for live AI output

Install and start:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the Express server on port `3001`.

## Production

```bash
npm install
npm run build
npm start
```

Express serves both the production React build and the API. Set `APP_URL` to the deployed origin and use a unique production `JWT_SECRET`.

## Deploying to Vercel

The repository includes a serverless entry point in `api/index.js`, cached MongoDB initialization, and `vercel.json` routing for the Vite SPA and Express API.

1. Import `Artreeus/Smart_hire` in the Vercel dashboard.
2. Keep the detected framework preset as **Vite**.
3. Add every variable from `.env.example` under Project Settings → Environment Variables.
4. Set `APP_URL` to the production URL, for example `https://your-project.vercel.app`.
5. Set `SEED_DATABASE=false` after initial data has been created if you do not want automatic empty-database seeding.
6. Deploy. Vercel runs `npm run build`, publishes `dist`, and sends `/api/*` requests to the Express function.

Vercel Functions accept payloads up to 4.5 MB, so SmartHire limits CV and verification documents to 4 MB and profile/company images to 3 MB. For larger documents, move to a direct signed Cloudinary upload followed by asynchronous analysis.

## Seed data

When the jobs collection is empty, SmartHire creates three example jobs and a platform administrator:

```text
Email: admin@smarthire.demo
Password: Demo12345
```

Change the password before any public deployment. Job seekers and company users should register through the application.

## Security design

- Passwords are hashed with bcrypt and never returned by the API
- JWTs expire after seven days and are required for protected endpoints
- Role middleware separates job-seeker, company, and administrator actions
- Company users can manage only jobs they own
- Job seekers can access only their own CVs and applications
- Application uniqueness prevents duplicate applications to the same job
- Uploads are restricted by MIME type and size
- CVs and verification evidence use authenticated Cloudinary storage
- Helmet adds defensive HTTP headers
- Authentication routes are rate limited
- MongoDB unique indexes protect account and relationship integrity
- AI outputs remain advisory and human review remains authoritative

For deployment hardening, see [docs/security.md](docs/security.md).

## API overview

Major endpoint groups include:

- `/api/auth/*` — signup, login, current session, verification, password reset
- `/api/profile/*` — user profile and avatar
- `/api/company/*` — profile, logo, jobs, applicants, verification
- `/api/jobs/*` — public discovery and protected company management
- `/api/cvs` and `/api/ai/*` — CV storage, analysis, matching and safety
- `/api/applications/*` — applications and status management
- `/api/saved-jobs/*` — persistent shortlists
- `/api/reports` — job reporting
- `/api/notifications/*` — notification inbox and read state
- `/api/admin/*` — moderation, verification, records and statistics

See [docs/api.md](docs/api.md) for details.

## Verification performed

The project has been checked with:

- Successful production frontend build
- Zero known npm audit vulnerabilities
- Live MongoDB connection
- Cloudinary authenticated CV upload and cleanup
- Company registration and job publishing
- Job-seeker registration and CV analysis
- Persistent saved-job and application creation
- Recruiter applicant retrieval and status updates
- Job reporting and admin statistics
- Production Express frontend delivery

## External services still required for deployment

Email-verification and password-reset token generation are implemented. A transactional email provider such as Resend, Postmark, Amazon SES, or SendGrid must be connected to deliver those URLs to real inboxes.

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Database model](docs/database.md)
- [AI design](docs/ai.md)
- [Security](docs/security.md)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)
- [User flows](docs/user-flows.md)
- [Contributing](docs/contributing.md)

## License

This repository is intended for academic and portfolio use. Add the license appropriate for your deployment and distribution requirements.
