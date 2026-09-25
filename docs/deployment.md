# Deployment

## Build

```bash
npm ci
npm run build
npm start
```

The Node process serves `dist` and the API. Configure the platform health check to request `/api/health`.

## Required environment variables

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `APP_URL`
- `PORT`

`OPENROUTER_API_KEY` is required for live model output. `OPENROUTER_MODEL` defaults to `openrouter/free`.

## Recommended hosting

Deploy the Node application on Render, Railway, Fly.io, an Azure App Service, or a comparable platform. MongoDB Atlas and Cloudinary remain managed external services.

## Vercel

SmartHire is prepared for a combined Vite and Vercel Functions deployment:

- `api/index.js` initializes the cached database connection and forwards requests to Express.
- `vercel.json` builds the Vite frontend, publishes `dist`, routes `/api/*` to the function, and falls back to `index.html` for React Router paths.
- `server/database.js` reuses a module-scoped Mongoose connection promise to reduce connection churn during warm serverless invocations.
- Function duration is configured to 60 seconds for CV parsing and AI requests.
- Upload limits remain below Vercel's 4.5 MB function payload ceiling.

Import the GitHub repository into Vercel, choose the Vite preset, add all environment variables, and set `APP_URL` to the deployed origin. MongoDB Atlas must permit connections from the deployment environment.

## Pre-launch

Rotate credentials, restrict database networking, configure HTTPS and the production origin, connect transactional email, change the seeded administrator password, test backups, and enable application/error monitoring.
