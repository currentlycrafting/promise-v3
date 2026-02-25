import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getDashboardState } from '../db/promises.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../..');

function sendHtml(res, ...parts) {
  const file = path.join(srcDir, ...parts);
  res.type('html').send(fs.readFileSync(file, 'utf8'));
}

export function pageRoutes(db) {
  return {
    redirectIfNoSession(req, res, next) {
      if (!req.session?.userId) {
        return res.redirect(302, '/login');
      }
      next();
    },

    getLogin(req, res) {
      sendHtml(res, 'frontend', 'pages', 'login.html');
    },

    getIndex(req, res) {
      if (req.session?.userId) return res.redirect(302, '/dashboard');
      sendHtml(res, 'frontend', 'pages', 'index.html');
    },

    getDashboard(req, res) {
      const userId = req.session?.userId;
      const { missed } = getDashboardState(db, userId || 0);
      if (missed) return res.redirect(302, '/reframe');
      sendHtml(res, 'frontend', 'pages', 'dashboard.html');
    },

    getReframe(req, res) {
      const userId = req.session?.userId;
      const { missed } = getDashboardState(db, userId || 0);
      if (!missed) return res.redirect(302, '/dashboard');
      sendHtml(res, 'frontend', 'pages', 'reframe.html');
    },

    getPromise(req, res) {
      sendHtml(res, 'frontend', 'pages', 'promise.html');
    },

    getFriends(req, res) {
      sendHtml(res, 'frontend', 'pages', 'friends.html');
    },

    getProfile(req, res) {
      sendHtml(res, 'frontend', 'pages', 'profile.html');
    },

    getNotifications(req, res) {
      sendHtml(res, 'frontend', 'pages', 'notifications.html');
    },
  };
}
