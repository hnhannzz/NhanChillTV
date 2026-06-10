const express = require('express');
const router = express.Router();
const path = require('path');
const UserDatabase = require('../db/userDatabase');

const userDb = new UserDatabase(
  path.join(__dirname, '../db/users.json'),
  path.join(__dirname, '../db/comments.json')
);

// Basic auth middleware using custom header for simplicity
const requireUserAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  req.userId = userId;
  next();
};

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Missing fields' });
  
  const result = userDb.register(username, password);
  if (result.success) res.json(result);
  else res.status(400).json(result);
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const result = userDb.login(username, password);
  if (result.success) res.json(result);
  else res.status(401).json(result);
});

router.get('/favorites', requireUserAuth, (req, res) => {
  const favs = userDb.getFavorites(req.userId);
  if (favs) res.json({ success: true, data: favs });
  else res.status(404).json({ success: false, error: 'User not found' });
});

router.get('/profile', requireUserAuth, (req, res) => {
  const profile = userDb.getProfile(req.userId);
  if (profile) res.json({ success: true, data: profile });
  else res.status(404).json({ success: false, error: 'User not found' });
});

router.put('/profile/avatar', requireUserAuth, (req, res) => {
  const avatar = String(req.body?.avatar || '');
  if (!/^\/avatar-packs\/animals\/[a-z0-9-]+\.svg$/.test(avatar)) {
    return res.status(400).json({ success: false, error: 'Invalid avatar' });
  }
  const profile = userDb.updateAvatar(req.userId, avatar);
  if (!profile) return res.status(404).json({ success: false, error: 'User not found' });
  return res.json({ success: true, data: profile });
});

router.post('/favorites/toggle', requireUserAuth, (req, res) => {
  const { type, itemId, itemData } = req.body;
  const result = userDb.toggleFavorite(req.userId, type, itemId, itemData);
  if (result.success) res.json({ success: true, data: result.favorites });
  else res.status(400).json(result);
});

module.exports = router;
