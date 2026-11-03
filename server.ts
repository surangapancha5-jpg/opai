import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import mongoose, { Schema, Document } from 'mongoose';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
const DEFAULT_MONGO_URI =
  'mongodb+srv://therasalk9999_db_user:lNFIF60izF65ekpX@cluster0.fglue0z.mongodb.net/opai_chat?retryWrites=true&w=majority';
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGO_URI;

// --- Mongoose Models ---

interface ISavedContact {
  userId: string;
  customName: string;
  savedAt: Date;
}

interface IUser extends Document {
  username: string;
  displayName: string;
  passwordHash: string;
  dp: string;
  bio: string;
  savedContacts: ISavedContact[];
  createdAt: Date;
  lastSeen: Date;
}

const SavedContactSchema = new Schema<ISavedContact>(
  {
    userId: { type: String, required: true },
    customName: { type: String, required: true, trim: true },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  passwordHash: { type: String, default: '' },
  dp: { type: String, default: '' },
  bio: { type: String, default: 'OPAI Member' },
  savedContacts: { type: [SavedContactSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
});

const UserModel = mongoose.models.OpaiUser || mongoose.model<IUser>('OpaiUser', UserSchema);

interface IDirectMessage extends Document {
  senderId: string;
  receiverId: string;
  text: string;
  image?: string;
  createdAt: Date;
}

const DirectMessageSchema = new Schema<IDirectMessage>({
  senderId: { type: String, required: true, index: true },
  receiverId: { type: String, required: true, index: true },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const DirectMessageModel =
  mongoose.models.OpaiDirectMessage ||
  mongoose.model<IDirectMessage>('OpaiDirectMessage', DirectMessageSchema);

interface IGroup extends Document {
  name: string;
  description: string;
  dp: string;
  ownerId: string;
  admins: string[];
  members: string[];
  createdAt: Date;
}

const GroupSchema = new Schema<IGroup>({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  dp: { type: String, default: '' },
  ownerId: { type: String, required: true },
  admins: { type: [String], default: [] },
  members: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const GroupModel = mongoose.models.OpaiGroup || mongoose.model<IGroup>('OpaiGroup', GroupSchema);

interface IGroupMessage extends Document {
  groupId: string;
  senderId: string;
  text: string;
  image?: string;
  createdAt: Date;
}

const GroupMessageSchema = new Schema<IGroupMessage>({
  groupId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const GroupMessageModel =
  mongoose.models.OpaiGroupMessage ||
  mongoose.model<IGroupMessage>('OpaiGroupMessage', GroupMessageSchema);

interface IPostComment {
  _id: mongoose.Types.ObjectId;
  authorId: string;
  text: string;
  createdAt: Date;
}

interface IPost extends Document {
  authorId: string;
  content: string;
  image?: string;
  likes: string[];
  comments: IPostComment[];
  createdAt: Date;
}

const PostCommentSchema = new Schema<IPostComment>({
  authorId: { type: String, required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const PostSchema = new Schema<IPost>({
  authorId: { type: String, required: true, index: true },
  content: { type: String, required: true, trim: true },
  image: { type: String, default: '' },
  likes: { type: [String], default: [] },
  comments: { type: [PostCommentSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const PostModel = mongoose.models.OpaiPost || mongoose.model<IPost>('OpaiPost', PostSchema);

// --- Helper Functions ---

const SECRET_SALT = 'opai_red_black_secret_salt_2026';

function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SECRET_SALT, 1000, 64, 'sha512').toString('hex');
}

function createAuthToken(userId: string): string {
  const hmac = crypto.createHmac('sha256', SECRET_SALT).update(userId).digest('hex');
  return `${userId}.${hmac}`;
}

function verifyAuthToken(token?: string): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [userId, signature] = parts;
  const expected = crypto.createHmac('sha256', SECRET_SALT).update(userId).digest('hex');
  if (signature !== expected) return null;
  return userId;
}

function toPublicUser(u: any) {
  return {
    _id: String(u._id),
    username: u.username,
    displayName: u.displayName || u.username,
    dp: u.dp || '',
    bio: u.bio || '',
    createdAt: u.createdAt,
    lastSeen: u.lastSeen,
  };
}

function toSelfUser(u: any) {
  return {
    ...toPublicUser(u),
    savedContacts: (u.savedContacts || []).map((c: any) => ({
      userId: String(c.userId),
      customName: String(c.customName),
      savedAt: c.savedAt,
    })),
  };
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Allow up to 10MB JSON payload for base64 profile pictures and post images
  app.use(express.json({ limit: '10mb' }));

  // Connect to MongoDB
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }

  // --- WebSocket Server for Live Real-Time Chat & Presence ---
  const wss = new WebSocketServer({ noServer: true });
  const clientUserMap = new Map<WebSocket, string>();

  function getOnlineUserIds(): string[] {
    const set = new Set<string>();
    for (const [, uid] of clientUserMap.entries()) {
      if (uid) set.add(uid);
    }
    return Array.from(set);
  }

  function broadcastAll(event: string, payload: any) {
    const message = JSON.stringify({ event, payload });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  function broadcastToUsers(userIds: string[], event: string, payload: any) {
    const targetSet = new Set(userIds.map(String));
    const message = JSON.stringify({ event, payload });
    for (const [client, uid] of clientUserMap.entries()) {
      if (client.readyState === WebSocket.OPEN && targetSet.has(String(uid))) {
        client.send(message);
      }
    }
  }

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'auth') {
          const userId = verifyAuthToken(data.token);
          if (userId) {
            clientUserMap.set(ws, userId);
            await UserModel.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(() => {});
            broadcastAll('presence:update', { onlineUserIds: getOnlineUserIds() });
          }
        } else if (data.type === 'typing:direct') {
          const senderId = clientUserMap.get(ws);
          if (senderId && data.receiverId) {
            broadcastToUsers([String(data.receiverId)], 'typing:direct', {
              senderId,
              isTyping: Boolean(data.isTyping),
            });
          }
        } else if (data.type === 'typing:group') {
          const senderId = clientUserMap.get(ws);
          if (senderId && data.groupId && Array.isArray(data.memberIds)) {
            broadcastToUsers(data.memberIds, 'typing:group', {
              groupId: String(data.groupId),
              senderId,
              isTyping: Boolean(data.isTyping),
            });
          }
        }
      } catch {
        // Ignore malformed WS message
      }
    });

    ws.on('close', async () => {
      const uid = clientUserMap.get(ws);
      clientUserMap.delete(ws);
      if (uid) {
        await UserModel.findByIdAndUpdate(uid, { lastSeen: new Date() }).catch(() => {});
        broadcastAll('presence:update', { onlineUserIds: getOnlineUserIds() });
      }
    });
  });

  // --- Auth Middleware ---
  async function requireAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const userId = verifyAuthToken(token);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(401).json({ error: 'Account not found. Please log in again.' });
      return;
    }
    (req as any).currentUser = user;
    next();
  }

  // --- API Routes ---

  // 1. Auth: Auto-Provision Real User on First Open (No Login Gate!)
  app.post('/api/auth/auto', async (req, res) => {
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      let candidateUsername = `user_${randomSuffix}`;
      while (await UserModel.findOne({ username: candidateUsername })) {
        candidateUsername = `user_${Math.floor(10000 + Math.random() * 90000)}`;
      }

      const defaultDp =
        req.body?.dp ||
        `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#08080a"/><circle cx="60" cy="60" r="44" fill="none" stroke="#dc2626" stroke-width="6"/><circle cx="60" cy="60" r="22" fill="#991b1b"/></svg>`
        )}`;

      const newUser = await UserModel.create({
        username: candidateUsername,
        displayName: `OPAI ${randomSuffix}`,
        passwordHash: '', // Optional: user can set password inside the app if they want
        dp: defaultDp,
        bio: 'Hey there! I am using OPAI Chat.',
        savedContacts: [],
      });

      const token = createAuthToken(String(newUser._id));
      broadcastAll('user:registered', toPublicUser(newUser));

      res.status(201).json({
        token,
        user: toSelfUser(newUser),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Auto-provisioning failed.' });
    }
  });

  // 1b. Auth: Register or Switch Account
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, displayName, password, dp, bio } = req.body;
      const cleanUsername = String(username || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

      if (!cleanUsername || cleanUsername.length < 3) {
        res.status(400).json({ error: 'Username must be at least 3 characters.' });
        return;
      }

      const existing = await UserModel.findOne({ username: cleanUsername });
      if (existing) {
        res.status(409).json({ error: 'This username is already taken. Try another one.' });
        return;
      }

      const newUser = await UserModel.create({
        username: cleanUsername,
        displayName: String(displayName || username).trim() || cleanUsername,
        passwordHash: password ? hashPassword(String(password)) : '',
        dp: String(dp || ''),
        bio: String(bio || 'Hey there! I am using OPAI Chat.').trim(),
        savedContacts: [],
      });

      const token = createAuthToken(String(newUser._id));
      broadcastAll('user:registered', toPublicUser(newUser));

      res.status(201).json({
        token,
        user: toSelfUser(newUser),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Registration failed.' });
    }
  });

  // 2. Auth: Login to existing account (if user wants to switch account inside the app)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const cleanUsername = String(username || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

      const user = await UserModel.findOne({ username: cleanUsername });
      if (!user) {
        res.status(401).json({ error: 'Account not found.' });
        return;
      }
      if (user.passwordHash && user.passwordHash !== hashPassword(String(password || ''))) {
        res.status(401).json({ error: 'Invalid password for this username.' });
        return;
      }

      user.lastSeen = new Date();
      await user.save();

      const token = createAuthToken(String(user._id));
      res.json({
        token,
        user: toSelfUser(user),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Login failed.' });
    }
  });

  // 3. Auth: Current Profile & Update Profile (username, displayName, dp, bio, optional password)
  app.get('/api/auth/me', requireAuth, async (req, res) => {
    const user = (req as any).currentUser;
    res.json({
      user: toSelfUser(user),
      onlineUserIds: getOnlineUserIds(),
    });
  });

  app.patch('/api/auth/profile', requireAuth, async (req, res) => {
    try {
      const user = (req as any).currentUser;
      const { username, displayName, dp, bio, password } = req.body;

      if (username !== undefined) {
        const cleanUsername = String(username)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_');
        if (cleanUsername.length < 3) {
          res.status(400).json({ error: 'Username must be at least 3 characters.' });
          return;
        }
        if (cleanUsername !== user.username) {
          const conflict = await UserModel.findOne({ username: cleanUsername });
          if (conflict && String(conflict._id) !== String(user._id)) {
            res.status(409).json({ error: 'Username is already taken.' });
            return;
          }
          user.username = cleanUsername;
        }
      }

      if (displayName !== undefined) {
        user.displayName = String(displayName).trim() || user.username;
      }
      if (dp !== undefined) {
        user.dp = String(dp);
      }
      if (bio !== undefined) {
        user.bio = String(bio).trim();
      }
      if (password !== undefined && String(password).trim().length > 0) {
        user.passwordHash = hashPassword(String(password).trim());
      }

      await user.save();
      broadcastAll('user:updated', toPublicUser(user));
      res.json({ user: toSelfUser(user) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update profile.' });
    }
  });

  // 4. Users: Get All Real Registered Users
  app.get('/api/users', requireAuth, async (_req, res) => {
    try {
      const users = await UserModel.find().sort({ createdAt: -1 });
      res.json({
        users: users.map(toPublicUser),
        onlineUserIds: getOnlineUserIds(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch users.' });
    }
  });

  // 5. Private Saved Contacts (Friend Alias visible ONLY to the user who saved it)
  app.post('/api/contacts', requireAuth, async (req, res) => {
    try {
      const user = (req as any).currentUser;
      const { friendId, customName } = req.body;

      if (!friendId) {
        res.status(400).json({ error: 'Friend user ID is required.' });
        return;
      }
      if (String(friendId) === String(user._id)) {
        res.status(400).json({ error: 'You cannot save yourself as a contact.' });
        return;
      }

      const targetUser = await UserModel.findById(friendId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const trimmedName = String(customName || '').trim();
      const existingIndex = user.savedContacts.findIndex(
        (c: ISavedContact) => String(c.userId) === String(friendId)
      );

      if (!trimmedName) {
        // Remove from saved contacts if customName is cleared
        if (existingIndex !== -1) {
          user.savedContacts.splice(existingIndex, 1);
        }
      } else if (existingIndex !== -1) {
        user.savedContacts[existingIndex].customName = trimmedName;
        user.savedContacts[existingIndex].savedAt = new Date();
      } else {
        user.savedContacts.push({
          userId: String(friendId),
          customName: trimmedName,
          savedAt: new Date(),
        });
      }

      await user.save();
      res.json({ user: toSelfUser(user) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save private contact.' });
    }
  });

  app.delete('/api/contacts/:friendId', requireAuth, async (req, res) => {
    try {
      const user = (req as any).currentUser;
      const { friendId } = req.params;
      user.savedContacts = user.savedContacts.filter(
        (c: ISavedContact) => String(c.userId) !== String(friendId)
      );
      await user.save();
      res.json({ user: toSelfUser(user) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to remove contact.' });
    }
  });

  // 6. Direct Messages (Live 1-on-1 Chat with Friends / Users)
  app.get('/api/direct-messages/:otherUserId', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const otherId = String(req.params.otherUserId);

      const messages = await DirectMessageModel.find({
        $or: [
          { senderId: myId, receiverId: otherId },
          { senderId: otherId, receiverId: myId },
        ],
      }).sort({ createdAt: 1 });

      res.json({ messages });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load messages.' });
    }
  });

  // Recent conversations summary for Home / DM sidebar
  app.get('/api/direct-messages-recent', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const messages = await DirectMessageModel.find({
        $or: [{ senderId: myId }, { receiverId: myId }],
      }).sort({ createdAt: -1 });

      const latestByPartner = new Map<string, any>();
      for (const msg of messages) {
        const partnerId = String(msg.senderId) === myId ? String(msg.receiverId) : String(msg.senderId);
        if (!latestByPartner.has(partnerId)) {
          latestByPartner.set(partnerId, msg);
        }
      }

      res.json({
        recentMessages: Array.from(latestByPartner.entries()).map(([partnerId, lastMessage]) => ({
          partnerId,
          lastMessage,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load recent chats.' });
    }
  });

  app.post('/api/direct-messages/:otherUserId', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const otherId = String(req.params.otherUserId);
      const { text, image } = req.body;

      if (!String(text || '').trim() && !image) {
        res.status(400).json({ error: 'Message cannot be empty.' });
        return;
      }

      const msg = await DirectMessageModel.create({
        senderId: myId,
        receiverId: otherId,
        text: String(text || '').trim(),
        image: String(image || ''),
      });

      broadcastToUsers([myId, otherId], 'direct_message:created', msg);
      res.status(201).json({ message: msg });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to send message.' });
    }
  });

  app.delete('/api/direct-messages/:messageId', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const msg = await DirectMessageModel.findById(req.params.messageId);
      if (!msg) {
        res.status(404).json({ error: 'Message not found.' });
        return;
      }
      if (String(msg.senderId) !== myId) {
        res.status(403).json({ error: 'You can only delete your own messages.' });
        return;
      }
      const otherId = String(msg.receiverId);
      await msg.deleteOne();
      broadcastToUsers([myId, otherId], 'direct_message:deleted', {
        messageId: String(msg._id),
        senderId: myId,
        receiverId: otherId,
      });
      res.json({ deletedId: String(msg._id) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete message.' });
    }
  });

  // 7. Groups: Create, List, Manage Members & Admins, Group Chat & Role-Based Message Deletion
  app.get('/api/groups', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      // Users see groups they are a member of
      const groups = await GroupModel.find({ members: myId }).sort({ createdAt: -1 });
      res.json({ groups });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch groups.' });
    }
  });

  app.post('/api/groups', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const { name, description, dp, memberIds } = req.body;
      const cleanName = String(name || '').trim();
      if (!cleanName) {
        res.status(400).json({ error: 'Group name is required.' });
        return;
      }

      const uniqueMembers = Array.from(
        new Set([myId, ...(Array.isArray(memberIds) ? memberIds.map(String) : [])])
      );

      const group = await GroupModel.create({
        name: cleanName,
        description: String(description || '').trim(),
        dp: String(dp || ''),
        ownerId: myId,
        admins: [myId],
        members: uniqueMembers,
      });

      broadcastToUsers(uniqueMembers, 'group:created', group);
      res.status(201).json({ group });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create group.' });
    }
  });

  app.patch('/api/groups/:groupId', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const group = await GroupModel.findById(req.params.groupId);
      if (!group) {
        res.status(404).json({ error: 'Group not found.' });
        return;
      }
      const isOwnerOrAdmin =
        String(group.ownerId) === myId || group.admins.map(String).includes(myId);
      if (!isOwnerOrAdmin) {
        res.status(403).json({ error: 'Only the group owner or admins can edit group details.' });
        return;
      }

      const { name, description, dp } = req.body;
      if (name !== undefined && String(name).trim()) group.name = String(name).trim();
      if (description !== undefined) group.description = String(description).trim();
      if (dp !== undefined) group.dp = String(dp);

      await group.save();
      broadcastToUsers(group.members, 'group:updated', group);
      res.json({ group });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update group.' });
    }
  });

  // Add members to group
  app.post('/api/groups/:groupId/members', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const group = await GroupModel.findById(req.params.groupId);
      if (!group) {
        res.status(404).json({ error: 'Group not found.' });
        return;
      }
      if (!group.members.map(String).includes(myId)) {
        res.status(403).json({ error: 'You must be a member of this group to add users.' });
        return;
      }

      const { userIds } = req.body;
      const toAdd: string[] = Array.isArray(userIds)
        ? userIds.map(String)
        : req.body.userId
        ? [String(req.body.userId)]
        : [];

      if (toAdd.length === 0) {
        res.status(400).json({ error: 'Select at least one user to add.' });
        return;
      }

      const merged = Array.from(new Set([...group.members.map(String), ...toAdd]));
      group.members = merged;
      await group.save();

      broadcastToUsers(merged, 'group:updated', group);
      res.json({ group });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to add members.' });
    }
  });

  // Remove member from group (Owner can NEVER be removed by anyone)
  app.delete('/api/groups/:groupId/members/:targetUserId', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const targetId = String(req.params.targetUserId);
      const group = await GroupModel.findById(req.params.groupId);

      if (!group) {
        res.status(404).json({ error: 'Group not found.' });
        return;
      }

      // CRITICAL RULE: Group creator (owner) cannot be removed by anyone!
      if (targetId === String(group.ownerId)) {
        res.status(403).json({
          error: 'The Group Owner cannot be removed from the group by anyone.',
        });
        return;
      }

      const isOwner = myId === String(group.ownerId);
      const isAdmin = group.admins.map(String).includes(myId);
      const isTargetAdmin = group.admins.map(String).includes(targetId);

      // Owner can remove anyone (except owner). Admin can remove regular members. Self can leave.
      if (!isOwner && !(isAdmin && !isTargetAdmin) && myId !== targetId) {
        res.status(403).json({
          error: 'Only the Group Owner (or Admins for regular members) can remove members.',
        });
        return;
      }

      const previousMembers = [...group.members.map(String)];
      group.members = group.members.map(String).filter((id) => id !== targetId);
      group.admins = group.admins.map(String).filter((id) => id !== targetId);
      await group.save();

      broadcastToUsers(previousMembers, 'group:member_removed', {
        groupId: String(group._id),
        removedUserId: targetId,
        group,
      });

      res.json({ group });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to remove member.' });
    }
  });

  // Grant or Revoke Admin (ONLY Group Owner can promote or demote admins)
  app.post('/api/groups/:groupId/admins', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const { targetUserId, makeAdmin } = req.body;
      const targetId = String(targetUserId || '');

      const group = await GroupModel.findById(req.params.groupId);
      if (!group) {
        res.status(404).json({ error: 'Group not found.' });
        return;
      }

      if (myId !== String(group.ownerId)) {
        res.status(403).json({
          error: 'Only the Group Owner can grant or remove Admin privileges.',
        });
        return;
      }

      if (targetId === String(group.ownerId)) {
        res.status(400).json({
          error: 'The Group Owner always holds full administrative authority.',
        });
        return;
      }

      if (!group.members.map(String).includes(targetId)) {
        res.status(400).json({ error: 'User is not a member of this group.' });
        return;
      }

      const currentAdmins = new Set(group.admins.map(String));
      currentAdmins.add(String(group.ownerId));

      if (makeAdmin) {
        currentAdmins.add(targetId);
      } else {
        currentAdmins.delete(targetId);
      }

      group.admins = Array.from(currentAdmins);
      await group.save();

      broadcastToUsers(group.members, 'group:updated', group);
      res.json({ group });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update admin role.' });
    }
  });

  // Group Messages: Get & Send
  app.get('/api/groups/:groupId/messages', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const group = await GroupModel.findById(req.params.groupId);
      if (!group || !group.members.map(String).includes(myId)) {
        res.status(403).json({ error: 'You are not a member of this group.' });
        return;
      }

      const messages = await GroupMessageModel.find({ groupId: String(group._id) }).sort({
        createdAt: 1,
      });
      res.json({ messages });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load group messages.' });
    }
  });

  app.post('/api/groups/:groupId/messages', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const group = await GroupModel.findById(req.params.groupId);
      if (!group || !group.members.map(String).includes(myId)) {
        res.status(403).json({ error: 'You are not a member of this group.' });
        return;
      }

      const { text, image } = req.body;
      if (!String(text || '').trim() && !image) {
        res.status(400).json({ error: 'Message cannot be empty.' });
        return;
      }

      const message = await GroupMessageModel.create({
        groupId: String(group._id),
        senderId: myId,
        text: String(text || '').trim(),
        image: String(image || ''),
      });

      broadcastToUsers(group.members, 'group_message:created', message);
      res.status(201).json({ message });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to send group message.' });
    }
  });

  // Group Message Delete:
  // Owner & Admins can delete ANY member's message.
  // Regular Members can ONLY delete their OWN message.
  app.delete('/api/groups/:groupId/messages/:messageId', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const group = await GroupModel.findById(req.params.groupId);
      if (!group || !group.members.map(String).includes(myId)) {
        res.status(403).json({ error: 'You are not a member of this group.' });
        return;
      }

      const message = await GroupMessageModel.findOne({
        _id: req.params.messageId,
        groupId: String(group._id),
      });
      if (!message) {
        res.status(404).json({ error: 'Message not found.' });
        return;
      }

      const isOwner = String(group.ownerId) === myId;
      const isAdmin = group.admins.map(String).includes(myId);
      const isOwnMessage = String(message.senderId) === myId;

      if (!isOwner && !isAdmin && !isOwnMessage) {
        res.status(403).json({
          error: 'Members can only delete their own messages. Admins and the Owner can delete any message.',
        });
        return;
      }

      await message.deleteOne();
      broadcastToUsers(group.members, 'group_message:deleted', {
        groupId: String(group._id),
        messageId: String(message._id),
        deletedBy: myId,
      });

      res.json({ deletedId: String(message._id) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete group message.' });
    }
  });

  // 8. Posts: Community Feed, Create Post, Comment (All Users Can Comment), Like, Delete
  app.get('/api/posts', requireAuth, async (_req, res) => {
    try {
      const posts = await PostModel.find().sort({ createdAt: -1 });
      res.json({ posts });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch posts.' });
    }
  });

  app.post('/api/posts', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const { content, image } = req.body;

      if (!String(content || '').trim() && !image) {
        res.status(400).json({ error: 'Post content or image is required.' });
        return;
      }

      const post = await PostModel.create({
        authorId: myId,
        content: String(content || '').trim() || 'Shared a photo',
        image: String(image || ''),
        likes: [],
        comments: [],
      });

      broadcastAll('post:created', post);
      res.status(201).json({ post });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create post.' });
    }
  });

  app.post('/api/posts/:postId/comments', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const { text } = req.body;
      const cleanText = String(text || '').trim();
      if (!cleanText) {
        res.status(400).json({ error: 'Comment text cannot be empty.' });
        return;
      }

      const post = await PostModel.findById(req.params.postId);
      if (!post) {
        res.status(404).json({ error: 'Post not found.' });
        return;
      }

      post.comments.push({
        _id: new mongoose.Types.ObjectId(),
        authorId: myId,
        text: cleanText,
        createdAt: new Date(),
      });

      await post.save();
      broadcastAll('post:updated', post);
      res.status(201).json({ post });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to add comment.' });
    }
  });

  app.delete('/api/posts/:postId/comments/:commentId', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const post = await PostModel.findById(req.params.postId);
      if (!post) {
        res.status(404).json({ error: 'Post not found.' });
        return;
      }

      const comment = post.comments.find((c: any) => String(c._id) === String(req.params.commentId));
      if (!comment) {
        res.status(404).json({ error: 'Comment not found.' });
        return;
      }

      if (String(comment.authorId) !== myId && String(post.authorId) !== myId) {
        res.status(403).json({ error: 'You can only delete your own comments.' });
        return;
      }

      post.comments = post.comments.filter(
        (c: any) => String(c._id) !== String(req.params.commentId)
      );
      await post.save();
      broadcastAll('post:updated', post);
      res.json({ post });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete comment.' });
    }
  });

  app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const post = await PostModel.findById(req.params.postId);
      if (!post) {
        res.status(404).json({ error: 'Post not found.' });
        return;
      }

      const likedSet = new Set(post.likes.map(String));
      if (likedSet.has(myId)) {
        likedSet.delete(myId);
      } else {
        likedSet.add(myId);
      }
      post.likes = Array.from(likedSet);
      await post.save();

      broadcastAll('post:updated', post);
      res.json({ post });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to toggle like.' });
    }
  });

  app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
    try {
      const myId = String((req as any).currentUser._id);
      const post = await PostModel.findById(req.params.postId);
      if (!post) {
        res.status(404).json({ error: 'Post not found.' });
        return;
      }
      if (String(post.authorId) !== myId) {
        res.status(403).json({ error: 'You can only delete your own posts.' });
        return;
      }

      await post.deleteOne();
      broadcastAll('post:deleted', { postId: String(post._id) });
      res.json({ deletedId: String(post._id) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete post.' });
    }
  });

  // --- Vite / Static Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 OPAI Chat Server running at http://localhost:${PORT}`);
  });
}

startServer();
