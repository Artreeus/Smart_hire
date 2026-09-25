import app from '../server/index.js';
import { connectDatabase } from '../server/database.js';

export default async function handler(request, response) {
  try {
    await connectDatabase();
    return app(request, response);
  } catch (error) {
    console.error('Vercel function initialization failed:', error);
    return response.status(503).json({ error: 'The service is temporarily unavailable.' });
  }
}
