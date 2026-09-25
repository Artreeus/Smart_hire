# Database Model

SmartHire uses Mongoose schemas with timestamps and explicit references.

## Primary entities

- `User`: identity, credentials, role, contact details, preferences, verification and suspension state
- `Company`: one-to-one owner relationship, public profile, logo and verification state
- `Job`: company and creator relationships, requirements, compensation, safety result and publication state
- `CV`: owner, authenticated Cloudinary asset, extracted skills and experience
- `Application`: job, applicant, company and CV references, stage timeline and match explanation
- `SavedJob`: unique user/job relationship
- `Notification`: recipient, content, type, link and read state
- `Report`: reporter, job, reason, priority and human resolution
- `Verification`: company, submitter, evidence and administrator decision

## Integrity rules

- User emails are unique.
- One company profile is associated with one owner.
- A user can save a job only once.
- A user can apply to a job only once.
- Jobs keep both a company relationship and the creating user for ownership enforcement.
- Applications copy the company relationship to make recruiter queries efficient.

## Indexing

Jobs include a text index over title, description, skills, and location. Frequently filtered relationships and workflow statuses are indexed. Additional compound indexes should be introduced from production query telemetry.
