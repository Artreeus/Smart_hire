# API Reference

All endpoints use the `/api` prefix. Protected endpoints require `Authorization: Bearer <token>`.

## Authentication

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

## Profiles and documents

- `PATCH /profile`
- `POST /profile/avatar`
- `GET /cvs`
- `POST /ai/analyze-cv`
- `POST /ai/match`

## Jobs

- `GET /jobs`
- `GET /jobs/:id`
- `POST /jobs/safety-check`
- `POST /jobs`
- `PATCH /jobs/:id`
- `DELETE /jobs/:id`
- `GET /company/jobs`

## Applications and saved jobs

- `GET /saved-jobs`
- `POST /saved-jobs/:jobId`
- `POST /applications`
- `GET /applications/me`
- `GET /company/applicants`
- `PATCH /applications/:id/status`

## Company and trust

- `GET|PATCH /company/profile`
- `POST /company/logo`
- `GET|POST /company/verification`
- `POST /reports`
- `GET /notifications`
- `PATCH /notifications/read`

## Administration

- `GET /admin/stats`
- `GET /admin/users`
- `PATCH /admin/users/:id/suspend`
- `GET /admin/companies`
- `GET /admin/jobs`
- `GET|PATCH /admin/reports`
- `GET|PATCH /admin/verifications`

Validation errors use status `400`, missing/invalid sessions use `401`, authorization failures use `403`, missing records use `404`, and unique conflicts use `409`.
