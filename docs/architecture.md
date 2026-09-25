# Architecture

SmartHire uses a React single-page application and an Express API in one repository. Vite serves the frontend in development and proxies `/api` traffic to Express. In production, Express serves the generated `dist` directory and the API from one process.

## Boundaries

- The browser owns presentation, navigation, form state, and the JWT session token.
- Express owns validation, authorization, AI calls, media credentials, and persistence.
- MongoDB is the system of record for all user-generated platform state.
- Cloudinary stores CV files, verification documents, avatars, and company logos.
- OpenRouter provides optional structured AI analysis behind server-only credentials.

## Request flow

1. A page calls the API helper in `src/api.js`.
2. The helper adds a bearer token when a session exists.
3. Express authenticates the token and loads the current MongoDB user.
4. Role middleware and record-level ownership checks authorize the action.
5. The route validates and persists the operation.
6. The API returns JSON used to update the interface.

## Production topology

The application can be deployed as one Node service with an external MongoDB Atlas cluster and Cloudinary/OpenRouter connections. Stateless JWT authentication allows horizontal application scaling. For multi-instance production deployments, introduce centralized logging, error monitoring, and a shared rate-limit store.
