import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { User } from './models.js';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const clean = value => typeof value === 'string' ? value.trim() : value;
export const splitLines = value => Array.isArray(value) ? value : String(value || '').split(/\n|,/).map(x => x.trim()).filter(Boolean);
export const publicUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, location: user.location, avatar: user.avatar, isEmailVerified: user.isEmailVerified, preferences: user.preferences });
export const signToken = user => jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
export const randomToken = () => crypto.randomBytes(32).toString('hex');

export async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || user.suspended) return res.status(401).json({ error: 'This account is unavailable.' });
    req.user = user;
    next();
  } catch { res.status(401).json({ error: 'Your session is invalid or expired.' }); }
}

export const optionalAuth = async (req, _res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) { const payload = jwt.verify(token, process.env.JWT_SECRET); req.user = await User.findById(payload.id); }
  } catch { /* Public request remains unauthenticated. */ }
  next();
};

export const allow = (...roles) => (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'You do not have permission to perform this action.' });

export function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder: 'smarthire', ...options }, (error, result) => error ? reject(error) : resolve(result)).end(buffer);
  });
}

export function pageQuery(req) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  return { page, limit, skip: (page - 1) * limit };
}
