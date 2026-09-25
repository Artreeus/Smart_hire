# Security

## Implemented controls

- bcrypt password hashes with a cost factor of 12
- Seven-day signed JWT sessions
- Server-side role and ownership authorization
- Suspended-account rejection during authentication
- Helmet response headers
- Configured CORS origin
- Authentication rate limiting
- JSON request-size limits
- Strict upload sizes and MIME allowlists
- Server-signed Cloudinary operations
- Authenticated storage for CVs and verification evidence
- MongoDB unique indexes
- Neutral safety language with human review

## Production checklist

- Rotate all development credentials.
- Generate a unique high-entropy `JWT_SECRET`.
- Restrict MongoDB Atlas access to deployment IP addresses.
- Use HTTPS only.
- Move tokens from local storage to secure, same-site HTTP-only cookies if the hosting architecture supports it.
- Add CSRF protection when cookie authentication is introduced.
- Configure an external rate-limit store for multiple API instances.
- Add malware scanning for uploaded documents.
- Add structured audit logs for administrator actions.
- Configure centralized error monitoring without logging secrets or CV contents.
- Add data retention and account deletion workflows before public launch.
