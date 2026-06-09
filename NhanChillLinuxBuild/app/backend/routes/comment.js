const express = require('express');
const router = express.Router();
const path = require('path');
const UserDatabase = require('../db/userDatabase');

const userDb = new UserDatabase(
  path.join(__dirname, '../db/users.json'),
  path.join(__dirname, '../db/comments.json')
);

// Basic auth middleware
const requireUserAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  req.userId = userId;
  next();
};

router.get('/:movieId', (req, res) => {
  const comments = userDb.getComments(req.params.movieId);
  res.json({ success: true, data: comments });
});

router.post('/:movieId', requireUserAuth, (req, res) => {
  const { content, username } = req.body;
  if (!content || !username) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }
  const newComment = userDb.addComment(req.params.movieId, req.userId, username, content);
  res.json({ success: true, data: newComment });
});

module.exports = router;
