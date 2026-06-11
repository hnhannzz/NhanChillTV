const fs = require('fs');
const path = require('path');

class UserDatabase {
  constructor(usersPath, commentsPath) {
    this.usersPath = usersPath;
    this.commentsPath = commentsPath;
    this.ensureFiles();
  }

  ensureFiles() {
    const dir = path.dirname(this.usersPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    if (!fs.existsSync(this.usersPath)) {
      fs.writeFileSync(this.usersPath, JSON.stringify({ users: [] }, null, 2));
    }
    if (!fs.existsSync(this.commentsPath)) {
      fs.writeFileSync(this.commentsPath, JSON.stringify({ comments: [] }, null, 2));
    }
  }

  readUsers() {
    return JSON.parse(fs.readFileSync(this.usersPath, 'utf-8'));
  }

  writeUsers(data) {
    const tempPath = `${this.usersPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, this.usersPath);
  }

  readComments() {
    return JSON.parse(fs.readFileSync(this.commentsPath, 'utf-8'));
  }

  writeComments(data) {
    fs.writeFileSync(this.commentsPath, JSON.stringify(data, null, 2));
  }

  // --- Users ---
  register(username, password) {
    const data = this.readUsers();
    if (data.users.find(u => u.username === username)) {
      return { success: false, error: 'Username already exists' };
    }
    const newUser = {
      id: Date.now().toString(),
      username,
      password, // Simple plaintext for beta
      avatar: '/avatar-packs/animals/panda-svgrepo-com.svg',
      favorites: {
        channels: [],
        movies: []
      },
      createdAt: new Date().toISOString()
    };
    data.users.push(newUser);
    this.writeUsers(data);
    return { success: true, user: { id: newUser.id, username: newUser.username, avatar: newUser.avatar } };
  }

  login(username, password) {
    const data = this.readUsers();
    const user = data.users.find(u => u.username === username && u.password === password);
    if (user) {
      return { success: true, user: { id: user.id, username: user.username, avatar: user.avatar || '/avatar-packs/animals/panda-svgrepo-com.svg' } };
    }
    return { success: false, error: 'Invalid username or password' };
  }

  getFavorites(userId) {
    const data = this.readUsers();
    const user = data.users.find(u => u.id === userId);
    return user ? user.favorites : null;
  }

  getProfile(userId) {
    const user = this.readUsers().users.find(item => item.id === userId);
    return user ? { id: user.id, username: user.username, avatar: user.avatar || '/avatar-packs/animals/panda-svgrepo-com.svg' } : null;
  }

  updateAvatar(userId, avatar) {
    const data = this.readUsers();
    const user = data.users.find(item => item.id === userId);
    if (!user) return null;
    user.avatar = avatar;
    this.writeUsers(data);
    return { id: user.id, username: user.username, avatar: user.avatar };
  }

  toggleFavorite(userId, type, itemId, itemData = null) {
    // type: 'channels' | 'movies'
    const data = this.readUsers();
    const user = data.users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };

    if (!user.favorites[type]) user.favorites[type] = [];
    
    // Check if exists
    let idx = -1;
    if (type === 'channels') {
      idx = user.favorites.channels.indexOf(itemId);
      if (idx > -1) user.favorites.channels.splice(idx, 1);
      else user.favorites.channels.push(itemId);
    } else {
      // movies store objects (slug, name, thumb_url)
      idx = user.favorites.movies.findIndex(m => m.slug === itemId);
      if (idx > -1) user.favorites.movies.splice(idx, 1);
      else if (itemData) user.favorites.movies.push(itemData);
    }

    this.writeUsers(data);
    return { success: true, favorites: user.favorites };
  }

  // --- Comments ---
  getComments(movieId) {
    const data = this.readComments();
    const users = this.readUsers().users || [];
    const avatars = new Map(users.map(user => [user.id, user.avatar || null]));
    return data.comments
      .filter(c => c.movieId === movieId)
      .map(comment => ({ ...comment, avatar: avatars.get(comment.userId) || comment.avatar || null }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addComment(movieId, userId, username, content) {
    const data = this.readComments();
    const user = this.readUsers().users.find(item => item.id === userId);
    const newComment = {
      id: Date.now().toString(),
      movieId,
      userId,
      username,
      avatar: user?.avatar || null,
      content,
      createdAt: new Date().toISOString()
    };
    data.comments.push(newComment);
    this.writeComments(data);
    return newComment;
  }
}

module.exports = UserDatabase;
