# Testing

## Current verification

- Frontend production compilation
- npm vulnerability audit
- Server syntax checks
- MongoDB connectivity
- API health and production frontend delivery
- Company registration and job publication
- Job-seeker registration and CV upload
- Cloudinary upload and cleanup
- Saving and applying to jobs
- Recruiter applicant retrieval and stage updates
- Job reporting and admin statistics

## Recommended automated coverage

- Unit tests for authorization, match fallback, safety fallback, and normalization helpers
- API integration tests using an isolated MongoDB database
- Browser tests for registration, CV analysis, job applications, recruiter review, and admin moderation
- Accessibility tests for keyboard navigation, labels, contrast, focus state, and dialog behavior
- Load tests for job search and applicant listing endpoints

Test accounts and assets should always be removed after integration suites finish.
