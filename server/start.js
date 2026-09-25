import 'dotenv/config';
import app from './index.js';
import { connectDatabase } from './database.js';

const port = process.env.PORT || 3001;

try {
  await connectDatabase();
  app.listen(port, () => console.log(`SmartHire API running on http://localhost:${port}`));
} catch (error) {
  console.error('SmartHire startup failed:', error.message);
  process.exit(1);
}
