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

## Pre-launch

Rotate credentials, restrict database networking, configure HTTPS and the production origin, connect transactional email, change the seeded administrator password, test backups, and enable application/error monitoring.
