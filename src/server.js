/**
 * Promise backend – Node/Express (replication guide).
 * GET /config, POST /auth/google, GET /me, POST /logout; session + CORS credentials.
 * No uvicorn – run: node server.js or npm start
 */
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import Database from 'better-sqlite3';
import { initUsers, userToJson } from './backend/db/users.js';
import {
  initPromises,
} from './backend/db/promises.js';
import { initFriends } from './backend/db/friends.js';
import { initNotifications } from './backend/db/notifications.js';
import { requireAuth } from './backend/middleware/auth.js';
import { configRoutes } from './backend/routes/config.js';
import { authRoutes } from './backend/routes/auth.js';
import { promiseRoutes } from './backend/routes/promises.js';
import { pageRoutes } from './backend/routes/pages.js';
import { profileRoutes } from './backend/routes/profile.js';
import { friendRoutes } from './backend/routes/friends.js';
import { userRoutes } from './backend/routes/users.js';
import { notificationRoutes } from './backend/routes/notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const uploadsDir = path.join(projectRoot, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safe);
  },
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } }).single('avatar');
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: '.env', override: false });

const PORT = parseInt(process.env.PORT || '5000', 10);
const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

if (!CLIENT_ID) {
  console.warn('GOOGLE_CLIENT_ID not set; Google Sign-In disabled. Use dev login.');
}

// Database
const dataDir = path.join(projectRoot, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'promises.db');
const db = new Database(dbPath);
initUsers(db);
initPromises(db);
initFriends(db);
initNotifications(db);

const app = express();
const upload = multer();

app.use(cookieParser());
app.use(express.json());

const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'null',
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  })
);

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  })
);

// Static
app.use('/static', express.static(path.join(projectRoot, 'static')));
app.use('/css', express.static(path.join(__dirname, 'frontend', 'css')));
app.use('/frontend', express.static(path.join(__dirname, 'frontend', 'js')));
app.use('/public', express.static(path.join(__dirname, 'frontend', 'public')));
app.use('/models', express.static(path.join(__dirname, 'frontend', 'public', 'models')));
app.use('/wasm', express.static(path.join(__dirname, 'frontend', 'public', 'wasm')));
app.use('/uploads', express.static(uploadsDir));

// Config (public)
app.get('/config', configRoutes(CLIENT_ID));

// Auth
const auth = authRoutes(db, CLIENT_ID);
app.post('/auth/google', (req, res) => auth.postGoogle(req, res));
app.get('/me', (req, res) => auth.getMe(req, res));
app.post('/logout', (req, res) => auth.postLogout(req, res));
app.post('/auth/dev', (req, res) => auth.postDev(req, res));

// Pages (redirect if no session for protected pages)
const pages = pageRoutes(db);
app.get('/login', (req, res) => pages.getLogin(req, res));
app.get('/', (req, res) => pages.getIndex(req, res));
app.get('/dashboard', pages.redirectIfNoSession, (req, res) => pages.getDashboard(req, res));
app.get('/reframe', pages.redirectIfNoSession, (req, res) => pages.getReframe(req, res));
app.get('/promise', pages.redirectIfNoSession, (req, res) => pages.getPromise(req, res));
app.get('/friends', pages.redirectIfNoSession, (req, res) => pages.getFriends(req, res));
app.get('/profile', pages.redirectIfNoSession, (req, res) => pages.getProfile(req, res));
app.get('/notifications', pages.redirectIfNoSession, (req, res) => pages.getNotifications(req, res));
// Legacy .html paths → redirect to canonical paths
app.get('/dashboard.html', (req, res) => res.redirect(302, '/dashboard'));
app.get('/reframe.html', (req, res) => res.redirect(302, '/reframe'));
app.get('/promise.html', (req, res) => res.redirect(302, '/promise'));
app.get('/friends.html', (req, res) => res.redirect(302, '/friends'));
app.get('/profile.html', (req, res) => res.redirect(302, '/profile'));
app.get('/notifications.html', (req, res) => res.redirect(302, '/notifications'));
app.get('/index.html', (req, res) => res.redirect(302, '/'));

// API (protected) – form body for create/apply (frontend sends FormData)
app.get('/api/promises', requireAuth, (req, res) => promiseRoutes(db).list(req, res));
app.get('/api/promises/:promise_id', requireAuth, (req, res) => promiseRoutes(db).getOne(req, res));
app.post('/api/promises', requireAuth, upload.none(), (req, res) => promiseRoutes(db).create(req, res));
app.post('/api/promises/:promise_id/complete', requireAuth, (req, res) => promiseRoutes(db).complete(req, res));
app.post('/api/promises/:promise_id/undo-complete', requireAuth, (req, res) => promiseRoutes(db).undoComplete(req, res));
app.patch('/api/promises/:promise_id', requireAuth, (req, res) => promiseRoutes(db).update(req, res));
app.patch('/api/promises/:promise_id/progress', requireAuth, (req, res) => promiseRoutes(db).updateProgress(req, res));
app.get('/api/promises/:promise_id/comments', requireAuth, (req, res) => promiseRoutes(db).getComments(req, res));
app.post('/api/promises/:promise_id/comments', requireAuth, (req, res) => promiseRoutes(db).postComment(req, res));
app.post('/api/promises/:promise_id/comments/:comment_id/like', requireAuth, (req, res) => promiseRoutes(db).toggleCommentLike(req, res));
app.post('/api/promises/:promise_id/forfeit', requireAuth, (req, res) => promiseRoutes(db).forfeit(req, res));
app.post('/api/reframe/:promise_id/apply', requireAuth, upload.none(), (req, res) => promiseRoutes(db).applyReframe(req, res));
app.get('/api/activity', requireAuth, (req, res) => promiseRoutes(db).activity(req, res));
app.get('/api/categories', requireAuth, (req, res) => promiseRoutes(db).categories(req, res));

// Profile (Phase 2)
const profile = profileRoutes(db, uploadAvatar);
app.get('/api/profile', requireAuth, (req, res) => profile.getProfile(req, res));
app.patch('/api/profile', requireAuth, (req, res) => profile.patchProfile(req, res));
app.post('/api/profile/avatar', requireAuth, (req, res) => {
  uploadAvatar(req, res, (err) => {
    if (err) return res.status(400).json({ detail: err.message || 'Upload failed' });
    profile.postAvatar(req, res);
  });
});

// Friends (Phase 3)
const friends = friendRoutes(db);
app.get('/api/friends', requireAuth, (req, res) => friends.list(req, res));
app.get('/api/friends/requests/incoming', requireAuth, (req, res) => friends.requestsIncoming(req, res));
app.get('/api/friends/requests/outgoing', requireAuth, (req, res) => friends.requestsOutgoing(req, res));
app.post('/api/friends/requests', requireAuth, (req, res) => friends.postRequest(req, res));
app.post('/api/friends/requests/:id/accept', requireAuth, (req, res) => friends.acceptRequest(req, res));
app.post('/api/friends/requests/:id/decline', requireAuth, (req, res) => friends.declineRequest(req, res));
app.delete('/api/friends/requests/:id', requireAuth, (req, res) => friends.cancelRequest(req, res));
app.delete('/api/friends/:id', requireAuth, (req, res) => friends.removeFriend(req, res));

// User search (Phase 3)
const users = userRoutes(db);
app.get('/api/users/search', requireAuth, (req, res) => users.search(req, res));

// Notifications (Phase 5)
const notifications = notificationRoutes(db);
app.get('/api/notifications', requireAuth, (req, res) => notifications.list(req, res));
app.get('/api/notifications/unread-count', requireAuth, (req, res) => notifications.unreadCount(req, res));
app.patch('/api/notifications/:id/read', requireAuth, (req, res) => notifications.markRead(req, res));
app.post('/api/notifications/read-all', requireAuth, (req, res) => notifications.markAllRead(req, res));

// 404 for favicon etc.
app.use((req, res) => res.status(404).end());

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
