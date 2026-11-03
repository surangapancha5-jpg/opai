export interface SavedContact {
  userId: string;
  customName: string;
  savedAt: string;
}

export interface User {
  _id: string;
  username: string;
  displayName: string;
  dp: string;
  bio: string;
  createdAt: string;
  lastSeen: string;
  savedContacts?: SavedContact[];
}

export interface DirectMessage {
  _id: string;
  senderId: string;
  receiverId: string;
  text: string;
  image?: string;
  createdAt: string;
}

export interface Group {
  _id: string;
  name: string;
  description: string;
  dp: string;
  ownerId: string;
  admins: string[];
  members: string[];
  createdAt: string;
}

export interface GroupMessage {
  _id: string;
  groupId: string;
  senderId: string;
  text: string;
  image?: string;
  createdAt: string;
}

export interface PostComment {
  _id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Post {
  _id: string;
  authorId: string;
  content: string;
  image?: string;
  likes: string[];
  comments: PostComment[];
  createdAt: string;
}

export type ActiveTab = 'home' | 'groups' | 'users' | 'posts';
