/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Users,
  UserPlus,
  Flame,
  Search,
  Send,
  Image as ImageIcon,
  Trash2,
  Bookmark,
  Lock,
  Plus,
  Settings,
  ArrowLeft,
  CheckCheck,
  X,
  Heart,
  MessageCircle,
  UserCheck,
  Shield,
  Crown,
} from 'lucide-react';
import {
  User,
  Group,
  Post,
  DirectMessage,
  GroupMessage,
  ActiveTab,
} from './types';
import { UserAvatar } from './components/UserAvatar';
import { ProfileModal } from './components/ProfileModal';
import { SaveContactModal } from './components/SaveContactModal';
import { compressImageFile } from './utils/imageUtils';

const STORAGE_TOKEN_KEY = 'opai_chat_auth_token';

export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_TOKEN_KEY)
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState<boolean>(true);

  // WhatsApp Left Navigation Tab: 'home' (Chats) | 'groups' | 'users' | 'posts'
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  // Data from MongoDB
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [recentPartnerMap, setRecentPartnerMap] = useState<
    Record<string, DirectMessage>
  >({});

  // Active Right Pane Mode: 'direct' | 'group' | 'posts' | null
  const [rightPaneMode, setRightPaneMode] = useState<
    'direct' | 'group' | 'posts' | null
  >(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Left Pane Search & Filter
  const [leftSearch, setLeftSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'saved' | 'online'>('all');

  // Direct Chat state
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [loadingDirect, setLoadingDirect] = useState(false);
  const [directText, setDirectText] = useState('');
  const [directImage, setDirectImage] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);
  const [typingUserMap, setTypingUserMap] = useState<Record<string, boolean>>({});

  // Group Chat state
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [groupText, setGroupText] = useState('');
  const [groupImage, setGroupImage] = useState('');
  const [sendingGroup, setSendingGroup] = useState(false);
  const [showGroupInfoDrawer, setShowGroupInfoDrawer] = useState(false);
  const [groupError, setGroupError] = useState('');

  // Create Group Modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupDp, setNewGroupDp] = useState('');
  const [selectedInitialMembers, setSelectedInitialMembers] = useState<string[]>(
    []
  );
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Save Private Contact Modal
  const [contactModalTarget, setContactModalTarget] = useState<User | null>(null);

  // Posts state
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState('');
  const [publishingPost, setPublishingPost] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(
    null
  );

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const directEndRef = useRef<HTMLDivElement>(null);
  const groupEndRef = useRef<HTMLDivElement>(null);
  const directFileRef = useRef<HTMLInputElement>(null);
  const groupFileRef = useRef<HTMLInputElement>(null);
  const groupDpFileRef = useRef<HTMLInputElement>(null);
  const postFileRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Auto-provision or load session on startup (NO LOGIN SCREEN GATE!)
  const bootstrapSession = useCallback(async (existingToken: string | null) => {
    try {
      let activeToken = existingToken;

      if (activeToken) {
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData.user);
          if (Array.isArray(meData.onlineUserIds)) {
            setOnlineUserIds(meData.onlineUserIds);
          }
        } else {
          activeToken = null;
          localStorage.removeItem(STORAGE_TOKEN_KEY);
        }
      }

      // If no valid token exists, automatically create a real user in MongoDB so the app opens straight into WhatsApp view
      if (!activeToken) {
        const autoRes = await fetch('/api/auth/auto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (autoRes.ok) {
          const autoData = await autoRes.json();
          activeToken = autoData.token;
          if (activeToken) {
            localStorage.setItem(STORAGE_TOKEN_KEY, activeToken);
            setToken(activeToken);
            setCurrentUser(autoData.user);
          }
        }
      }

      if (!activeToken) return;

      const [usersRes, groupsRes, postsRes, recentDmRes] = await Promise.all([
        fetch('/api/users', {
          headers: { Authorization: `Bearer ${activeToken}` },
        }),
        fetch('/api/groups', {
          headers: { Authorization: `Bearer ${activeToken}` },
        }),
        fetch('/api/posts', {
          headers: { Authorization: `Bearer ${activeToken}` },
        }),
        fetch('/api/direct-messages-recent', {
          headers: { Authorization: `Bearer ${activeToken}` },
        }),
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        if (Array.isArray(uData.users)) setAllUsers(uData.users);
        if (Array.isArray(uData.onlineUserIds))
          setOnlineUserIds(uData.onlineUserIds);
      }
      if (groupsRes.ok) {
        const gData = await groupsRes.json();
        if (Array.isArray(gData.groups)) setGroups(gData.groups);
      }
      if (postsRes.ok) {
        const pData = await postsRes.json();
        if (Array.isArray(pData.posts)) setPosts(pData.posts);
      }
      if (recentDmRes.ok) {
        const rData = await recentDmRes.json();
        if (Array.isArray(rData.recentMessages)) {
          const map: Record<string, DirectMessage> = {};
          for (const item of rData.recentMessages) {
            if (item.partnerId && item.lastMessage) {
              map[item.partnerId] = item.lastMessage;
            }
          }
          setRecentPartnerMap(map);
        }
      }
    } catch {
      // Ignore transient error
    } finally {
      setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    bootstrapSession(token);
  }, [token, bootstrapSession]);

  // Load 1-on-1 messages when selectedFriendId changes
  useEffect(() => {
    if (!selectedFriendId || !token) return;
    setLoadingDirect(true);
    fetch(`/api/direct-messages/${selectedFriendId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.messages)) {
          setDirectMessages(data.messages);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDirect(false));
  }, [selectedFriendId, token]);

  // Load Group messages when selectedGroupId changes
  useEffect(() => {
    if (!selectedGroupId || !token) return;
    setLoadingGroup(true);
    setGroupError('');
    fetch(`/api/groups/${selectedGroupId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.messages)) {
          setGroupMessages(data.messages);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingGroup(false));
  }, [selectedGroupId, token]);

  // Auto-scroll chats
  useEffect(() => {
    directEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [directMessages.length, selectedFriendId, rightPaneMode]);

  useEffect(() => {
    groupEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages.length, selectedGroupId, rightPaneMode]);

  // Connect WebSocket for live real-time updates
  useEffect(() => {
    if (!token || !currentUser) return;

    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', token }));
      };

      socket.onmessage = (evt) => {
        try {
          const { event, payload } = JSON.parse(evt.data);
          switch (event) {
            case 'presence:update':
              if (Array.isArray(payload?.onlineUserIds)) {
                setOnlineUserIds(payload.onlineUserIds);
              }
              break;

            case 'user:registered':
              if (payload?._id) {
                setAllUsers((prev) =>
                  prev.some((u) => u._id === payload._id)
                    ? prev
                    : [payload, ...prev]
                );
              }
              break;

            case 'user:updated':
              if (payload?._id) {
                setAllUsers((prev) =>
                  prev.map((u) => (u._id === payload._id ? payload : u))
                );
              }
              break;

            case 'direct_message:created':
              if (payload?._id) {
                const partnerId =
                  payload.senderId === currentUser._id
                    ? payload.receiverId
                    : payload.senderId;
                setRecentPartnerMap((prev) => ({
                  ...prev,
                  [partnerId]: payload,
                }));
                setDirectMessages((prev) => {
                  const isForActiveChat =
                    (payload.senderId === currentUser._id &&
                      payload.receiverId === selectedFriendId) ||
                    (payload.senderId === selectedFriendId &&
                      payload.receiverId === currentUser._id);
                  if (!isForActiveChat) return prev;
                  if (prev.some((m) => m._id === payload._id)) return prev;
                  return [...prev, payload];
                });
              }
              break;

            case 'direct_message:deleted':
              if (payload?.messageId) {
                setDirectMessages((prev) =>
                  prev.filter((m) => m._id !== payload.messageId)
                );
              }
              break;

            case 'typing:direct':
              if (payload?.senderId) {
                setTypingUserMap((prev) => ({
                  ...prev,
                  [payload.senderId]: Boolean(payload.isTyping),
                }));
              }
              break;

            case 'group:created':
              if (payload?._id) {
                setGroups((prev) =>
                  prev.some((g) => g._id === payload._id)
                    ? prev
                    : [payload, ...prev]
                );
              }
              break;

            case 'group:updated':
              if (payload?._id) {
                setGroups((prev) => {
                  const exists = prev.some((g) => g._id === payload._id);
                  if (!exists) return [payload, ...prev];
                  return prev.map((g) => (g._id === payload._id ? payload : g));
                });
              }
              break;

            case 'group:member_removed':
              if (payload?.groupId) {
                if (payload.removedUserId === currentUser._id) {
                  setGroups((prev) =>
                    prev.filter((g) => g._id !== payload.groupId)
                  );
                  if (selectedGroupId === payload.groupId) {
                    setSelectedGroupId(null);
                    setRightPaneMode(null);
                  }
                } else if (payload.group) {
                  setGroups((prev) =>
                    prev.map((g) =>
                      g._id === payload.group._id ? payload.group : g
                    )
                  );
                }
              }
              break;

            case 'group_message:created':
              if (payload?._id && payload.groupId === selectedGroupId) {
                setGroupMessages((prev) =>
                  prev.some((m) => m._id === payload._id)
                    ? prev
                    : [...prev, payload]
                );
              }
              break;

            case 'group_message:deleted':
              if (payload?.groupId === selectedGroupId && payload?.messageId) {
                setGroupMessages((prev) =>
                  prev.filter((m) => m._id !== payload.messageId)
                );
              }
              break;

            case 'post:created':
              if (payload?._id) {
                setPosts((prev) =>
                  prev.some((p) => p._id === payload._id)
                    ? prev
                    : [payload, ...prev]
                );
              }
              break;

            case 'post:updated':
              if (payload?._id) {
                setPosts((prev) =>
                  prev.map((p) => (p._id === payload._id ? payload : p))
                );
              }
              break;

            case 'post:deleted':
              if (payload?.postId) {
                setPosts((prev) =>
                  prev.filter((p) => p._id !== payload.postId)
                );
              }
              break;
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      socket.onclose = () => {
        if (!isUnmounted) {
          reconnectTimerRef.current = window.setTimeout(connectWs, 2500);
        }
      };
    };

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [token, currentUser?._id, selectedFriendId, selectedGroupId]);

  // Resolve user ID to Private Saved Name (if saved by currentUser) or public name
  const resolveUserName = useCallback(
    (userId: string) => {
      const userObj =
        userId === currentUser?._id
          ? currentUser
          : allUsers.find((u) => u._id === userId);

      const savedEntry = (currentUser?.savedContacts || []).find(
        (c) => String(c.userId) === String(userId)
      );

      if (savedEntry && savedEntry.customName.trim()) {
        return {
          primaryName: savedEntry.customName.trim(),
          username: userObj?.username || 'user',
          isPrivateSaved: true,
          dp: userObj?.dp || '',
          userObj,
        };
      }

      return {
        primaryName:
          userObj?.displayName || userObj?.username || 'OPAI Member',
        username: userObj?.username || 'user',
        isPrivateSaved: false,
        dp: userObj?.dp || '',
        userObj,
      };
    },
    [currentUser, allUsers]
  );

  // Send Direct Message
  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedFriendId ||
      !token ||
      (!directText.trim() && !directImage) ||
      sendingDirect
    )
      return;
    setSendingDirect(true);
    try {
      const res = await fetch(`/api/direct-messages/${selectedFriendId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: directText.trim(),
          image: directImage,
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setDirectText('');
        setDirectImage('');
        setDirectMessages((prev) =>
          prev.some((m) => m._id === data.message._id)
            ? prev
            : [...prev, data.message]
        );
        setRecentPartnerMap((prev) => ({
          ...prev,
          [selectedFriendId]: data.message,
        }));
      }
    } finally {
      setSendingDirect(false);
    }
  };

  const handleDeleteDirectMessage = async (messageId: string) => {
    if (!token) return;
    const res = await fetch(`/api/direct-messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setDirectMessages((prev) => prev.filter((m) => m._id !== messageId));
    }
  };

  // Send Group Message
  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedGroupId ||
      !token ||
      (!groupText.trim() && !groupImage) ||
      sendingGroup
    )
      return;
    setSendingGroup(true);
    setGroupError('');
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: groupText.trim(),
          image: groupImage,
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setGroupText('');
        setGroupImage('');
        setGroupMessages((prev) =>
          prev.some((m) => m._id === data.message._id)
            ? prev
            : [...prev, data.message]
        );
      } else {
        setGroupError(data.error || 'Failed to send message');
      }
    } finally {
      setSendingGroup(false);
    }
  };

  // Delete Group Message (Owner & Admins can delete ANY message; Members only their own)
  const handleDeleteGroupMessage = async (messageId: string) => {
    if (!selectedGroupId || !token) return;
    setGroupError('');
    const res = await fetch(
      `/api/groups/${selectedGroupId}/messages/${messageId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    if (res.ok) {
      setGroupMessages((prev) => prev.filter((m) => m._id !== messageId));
    } else {
      setGroupError(data.error || 'Could not delete message.');
    }
  };

  // Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !token || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          dp: newGroupDp,
          memberIds: selectedInitialMembers,
        }),
      });
      const data = await res.json();
      if (res.ok && data.group) {
        setGroups((prev) =>
          prev.some((g) => g._id === data.group._id)
            ? prev
            : [data.group, ...prev]
        );
        setSelectedGroupId(data.group._id);
        setRightPaneMode('group');
        setActiveTab('groups');
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setNewGroupDp('');
        setSelectedInitialMembers([]);
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  // Group Role & Member Actions
  const handleToggleAdmin = async (targetUserId: string, makeAdmin: boolean) => {
    if (!selectedGroupId || !token) return;
    setGroupError('');
    const res = await fetch(`/api/groups/${selectedGroupId}/admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId, makeAdmin }),
    });
    const data = await res.json();
    if (res.ok && data.group) {
      setGroups((prev) =>
        prev.map((g) => (g._id === data.group._id ? data.group : g))
      );
    } else {
      setGroupError(data.error || 'Failed to update admin role.');
    }
  };

  const handleAddGroupMember = async (userId: string) => {
    if (!selectedGroupId || !token) return;
    setGroupError('');
    const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userIds: [userId] }),
    });
    const data = await res.json();
    if (res.ok && data.group) {
      setGroups((prev) =>
        prev.map((g) => (g._id === data.group._id ? data.group : g))
      );
    } else {
      setGroupError(data.error || 'Could not add member.');
    }
  };

  const handleRemoveGroupMember = async (targetUserId: string) => {
    if (!selectedGroupId || !token) return;
    setGroupError('');
    const res = await fetch(
      `/api/groups/${selectedGroupId}/members/${targetUserId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    if (res.ok && data.group) {
      setGroups((prev) =>
        prev.map((g) => (g._id === data.group._id ? data.group : g))
      );
    } else {
      setGroupError(data.error || 'Could not remove member.');
    }
  };

  // Posts Handlers
  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!postContent.trim() && !postImage) || !token || publishingPost) return;
    setPublishingPost(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: postContent.trim(), image: postImage }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        setPosts((prev) =>
          prev.some((p) => p._id === data.post._id)
            ? prev
            : [data.post, ...prev]
        );
        setPostContent('');
        setPostImage('');
        setRightPaneMode('posts');
      }
    } finally {
      setPublishingPost(false);
    }
  };

  const handleToggleLikePost = async (postId: string) => {
    if (!token) return;
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.post) {
      setPosts((prev) =>
        prev.map((p) => (p._id === data.post._id ? data.post : p))
      );
    }
  };

  const handleAddComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const commentText = (commentInputs[postId] || '').trim();
    if (!commentText || !token || submittingCommentId === postId) return;
    setSubmittingCommentId(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: commentText }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        setPosts((prev) =>
          prev.map((p) => (p._id === data.post._id ? data.post : p))
        );
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      }
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!token) return;
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    }
  };

  if (bootstrapping || !currentUser || !token) {
    return (
      <div className="h-screen w-screen bg-[#050505] text-[#f5f5f7] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="font-display text-2xl font-extrabold text-red-500 tracking-tight">
            OPAI Chat
          </div>
          <div className="text-xs font-mono text-zinc-500">
            Loading WhatsApp Red & Black Workspace...
          </div>
        </div>
      </div>
    );
  }

  const myId = currentUser._id;
  const otherUsers = allUsers.filter((u) => u._id !== myId);
  const savedSet = new Set(
    (currentUser.savedContacts || []).map((c) => String(c.userId))
  );

  // Filter lists for Left Pane
  const q = leftSearch.trim().toLowerCase();

  const homeChatUsers = otherUsers
    .filter((u) => {
      if (userFilter === 'saved' && !savedSet.has(u._id)) return false;
      if (userFilter === 'online' && !onlineUserIds.includes(u._id)) return false;
      if (!q) return true;
      const r = resolveUserName(u._id);
      return (
        r.primaryName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aLast = recentPartnerMap[a._id]?.createdAt || '';
      const bLast = recentPartnerMap[b._id]?.createdAt || '';
      if (aLast !== bLast) return bLast.localeCompare(aLast);
      return (savedSet.has(b._id) ? 1 : 0) - (savedSet.has(a._id) ? 1 : 0);
    });

  const filteredGroups = groups.filter((g) =>
    !q ? true : g.name.toLowerCase().includes(q)
  );

  const filteredAllUsers = allUsers.filter((u) => {
    if (userFilter === 'saved' && !savedSet.has(u._id)) return false;
    if (userFilter === 'online' && !onlineUserIds.includes(u._id)) return false;
    if (!q) return true;
    const r = resolveUserName(u._id);
    return (
      r.primaryName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q)
    );
  });

  const activePartner = selectedFriendId
    ? resolveUserName(selectedFriendId)
    : null;
  const activeGroup = groups.find((g) => g._id === selectedGroupId) || null;
  const isMyGroupOwner = activeGroup ? activeGroup.ownerId === myId : false;
  const isMyGroupAdmin = activeGroup
    ? isMyGroupOwner || activeGroup.admins.includes(myId)
    : false;

  const existingSavedNameForTarget = contactModalTarget
    ? (currentUser.savedContacts || []).find(
        (c) => String(c.userId) === String(contactModalTarget._id)
      )?.customName || ''
    : '';

  // On mobile, if a chat/group/post is open in the right pane, we show the right pane full screen with a Back button
  const isMobileRightOpen = rightPaneMode !== null;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050505] text-[#f5f5f7] flex flex-col select-none">
      {/* Top 3px Red & Black RGB Glow Bar */}
      <div className="h-1 w-full opai-rgb-strip shrink-0" />

      {/* Main Full-Screen WhatsApp Split Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. FAR-LEFT WHATSAPP VERTICAL ICON RAIL (Desktop) */}
        <aside className="hidden md:flex flex-col items-center justify-between w-16 py-3 bg-[#09090d] border-r border-red-950/70 shrink-0 z-20">
          <div className="flex flex-col items-center gap-3">
            {/* Home / Chats Tab */}
            <button
              type="button"
              onClick={() => {
                setShowProfileDrawer(false);
                setActiveTab('home');
              }}
              title="Home (Chats)"
              className={`p-3 rounded-xl transition-all relative ${
                activeTab === 'home' && !showProfileDrawer
                  ? 'bg-red-600 text-white shadow-[0_0_16px_rgba(220,38,38,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-[#14141c]'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {/* Groups Tab */}
            <button
              type="button"
              onClick={() => {
                setShowProfileDrawer(false);
                setActiveTab('groups');
              }}
              title="Groups"
              className={`p-3 rounded-xl transition-all relative ${
                activeTab === 'groups' && !showProfileDrawer
                  ? 'bg-red-600 text-white shadow-[0_0_16px_rgba(220,38,38,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-[#14141c]'
              }`}
            >
              <Users className="w-5 h-5" />
            </button>

            {/* All Users Tab */}
            <button
              type="button"
              onClick={() => {
                setShowProfileDrawer(false);
                setActiveTab('users');
              }}
              title="All Users"
              className={`p-3 rounded-xl transition-all relative ${
                activeTab === 'users' && !showProfileDrawer
                  ? 'bg-red-600 text-white shadow-[0_0_16px_rgba(220,38,38,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-[#14141c]'
              }`}
            >
              <UserPlus className="w-5 h-5" />
            </button>

            {/* Posts Tab */}
            <button
              type="button"
              onClick={() => {
                setShowProfileDrawer(false);
                setActiveTab('posts');
                setRightPaneMode('posts');
              }}
              title="Posts"
              className={`p-3 rounded-xl transition-all relative ${
                activeTab === 'posts' && !showProfileDrawer
                  ? 'bg-red-600 text-white shadow-[0_0_16px_rgba(220,38,38,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-[#14141c]'
              }`}
            >
              <Flame className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom User Profile & DP Trigger (WhatsApp style) */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setShowProfileDrawer((v) => !v)}
              title="Profile, Username & DP"
              className={`p-0.5 rounded-full border-2 transition-transform ${
                showProfileDrawer
                  ? 'border-red-500 scale-105 shadow-[0_0_14px_#ef4444]'
                  : 'border-transparent hover:border-red-500/60'
              }`}
            >
              <UserAvatar
                src={currentUser.dp}
                name={currentUser.displayName || currentUser.username}
                size="sm"
              />
            </button>
          </div>
        </aside>

        {/* 2. WHATSAPP LEFT LIST COLUMN (Chats / Groups / All Users / Posts / Profile Drawer) */}
        <section
          className={`${
            isMobileRightOpen ? 'hidden md:flex' : 'flex'
          } flex-col w-full md:w-[360px] lg:w-[400px] h-full bg-[#0b0b0f] border-r border-red-950/60 shrink-0`}
        >
          {showProfileDrawer ? (
            <ProfileModal
              currentUser={currentUser}
              token={token}
              onClose={() => setShowProfileDrawer(false)}
              onUpdated={(updated) => {
                setCurrentUser(updated);
                setAllUsers((prev) =>
                  prev.map((u) => (u._id === updated._id ? updated : u))
                );
              }}
              onSwitchedAccount={(newToken, switchedUser) => {
                localStorage.setItem(STORAGE_TOKEN_KEY, newToken);
                setToken(newToken);
                setCurrentUser(switchedUser);
              }}
            />
          ) : (
            <>
              {/* WhatsApp Left Column Header */}
              <div className="h-16 px-4 bg-[#10090c] border-b border-red-950/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-display text-lg font-extrabold tracking-tight text-red-500 truncate">
                    {activeTab === 'home' && 'OPAI Chats'}
                    {activeTab === 'groups' && 'OPAI Groups'}
                    {activeTab === 'users' && 'All Users'}
                    {activeTab === 'posts' && 'Community Posts'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {activeTab === 'groups' && (
                    <button
                      type="button"
                      onClick={() => setShowCreateGroupModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Group</span>
                    </button>
                  )}

                  {/* Quick button to open Profile / Username / DP settings */}
                  <button
                    type="button"
                    onClick={() => setShowProfileDrawer(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171216] hover:bg-red-950/50 border border-red-900/50 text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0"
                    title="Set Username, DP & Optional Password"
                  >
                    <UserAvatar
                      src={currentUser.dp}
                      name={currentUser.displayName}
                      size="xs"
                    />
                    <span className="max-w-[90px] truncate">
                      {currentUser.displayName}
                    </span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Search & Filter Bar */}
              <div className="p-3 bg-[#0b0b0f] border-b border-zinc-900 space-y-2.5 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={leftSearch}
                    onChange={(e) => setLeftSearch(e.target.value)}
                    placeholder={
                      activeTab === 'groups'
                        ? 'Search groups...'
                        : activeTab === 'posts'
                        ? 'Search posts...'
                        : 'Search or start new chat...'
                    }
                    className="w-full pl-9 pr-3.5 py-2 rounded-full bg-[#15151c] border border-zinc-800/80 focus:border-red-500 focus:outline-none text-xs text-white placeholder-zinc-500"
                  />
                </div>

                {(activeTab === 'home' || activeTab === 'users') && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUserFilter('all')}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                        userFilter === 'all'
                          ? 'bg-red-600 text-white'
                          : 'bg-[#15151c] text-zinc-400 hover:text-white'
                      }`}
                    >
                      All ({activeTab === 'home' ? otherUsers.length : allUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserFilter('saved')}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                        userFilter === 'saved'
                          ? 'bg-red-600 text-white'
                          : 'bg-[#15151c] text-zinc-400 hover:text-white'
                      }`}
                    >
                      Saved Friends ({savedSet.size})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserFilter('online')}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                        userFilter === 'online'
                          ? 'bg-red-600 text-white'
                          : 'bg-[#15151c] text-zinc-400 hover:text-white'
                      }`}
                    >
                      Online ({onlineUserIds.length})
                    </button>
                  </div>
                )}
              </div>

              {/* Scrollable WhatsApp Left List Content */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/70">
                {/* TAB 1: HOME (CHATS) */}
                {activeTab === 'home' &&
                  (homeChatUsers.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <MessageSquare className="w-8 h-8 text-red-500/60 mx-auto" />
                      <div className="text-sm font-medium text-zinc-300">
                        No chats found
                      </div>
                      <p className="text-xs text-zinc-500">
                        Open All Users to see everyone or invite a friend to OPAI Chat.
                      </p>
                    </div>
                  ) : (
                    homeChatUsers.map((u) => {
                      const r = resolveUserName(u._id);
                      const lastMsg = recentPartnerMap[u._id];
                      const isOnline = onlineUserIds.includes(u._id);
                      const isSelected =
                        rightPaneMode === 'direct' && selectedFriendId === u._id;

                      return (
                        <div
                          key={u._id}
                          onClick={() => {
                            setSelectedFriendId(u._id);
                            setRightPaneMode('direct');
                          }}
                          className={`px-4 py-3 flex items-center gap-3.5 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#1c0d12]' : 'hover:bg-[#121218]'
                          }`}
                        >
                          <UserAvatar
                            src={u.dp}
                            name={r.primaryName}
                            size="md"
                            isOnline={isOnline}
                            showOnlineStatus
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm font-semibold text-white truncate">
                                  {r.primaryName}
                                </span>
                                {r.isPrivateSaved && (
                                  <Lock
                                    className="w-3 h-3 text-red-400 shrink-0"
                                    title="Private saved friend name (only visible to you)"
                                  />
                                )}
                              </div>
                              {lastMsg && (
                                <span className="text-[11px] font-mono tabular-nums text-zinc-500 shrink-0">
                                  {new Date(lastMsg.createdAt).toLocaleTimeString(
                                    [],
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 truncate mt-0.5">
                              {typingUserMap[u._id] ? (
                                <span className="text-red-400 font-medium">
                                  typing...
                                </span>
                              ) : lastMsg ? (
                                lastMsg.text || '📷 Photo'
                              ) : (
                                <span className="text-zinc-500">
                                  {u.bio || `@${u.username}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ))}

                {/* TAB 2: GROUPS */}
                {activeTab === 'groups' && (
                  <>
                    <div
                      onClick={() => setShowCreateGroupModal(true)}
                      className="px-4 py-3.5 flex items-center gap-3.5 cursor-pointer bg-[#12090c] hover:bg-[#1a0d11] transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-[0_0_12px_rgba(220,38,38,0.4)] shrink-0">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Create New Group
                        </div>
                        <div className="text-xs text-zinc-400">
                          You become the permanent Group Owner
                        </div>
                      </div>
                    </div>

                    {filteredGroups.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500">
                        No groups yet. Tap "Create New Group" above to start one.
                      </div>
                    ) : (
                      filteredGroups.map((g) => {
                        const isSelected =
                          rightPaneMode === 'group' && selectedGroupId === g._id;
                        const amOwner = g.ownerId === myId;
                        const amAdmin = g.admins.includes(myId);

                        return (
                          <div
                            key={g._id}
                            onClick={() => {
                              setSelectedGroupId(g._id);
                              setRightPaneMode('group');
                            }}
                            className={`px-4 py-3 flex items-center gap-3.5 cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#1c0d12]' : 'hover:bg-[#121218]'
                            }`}
                          >
                            <UserAvatar src={g.dp} name={g.name} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-white truncate">
                                  {g.name}
                                </span>
                                <span className="text-[11px] font-mono tabular-nums text-red-400 shrink-0">
                                  {g.members.length} members
                                </span>
                              </div>
                              <div className="text-xs text-zinc-400 truncate mt-0.5">
                                {amOwner
                                  ? 'Owner · Full Control'
                                  : amAdmin
                                  ? 'Admin · Moderator'
                                  : g.description || 'Group Chat'}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                {/* TAB 3: ALL USERS (WhatsApp Contacts List) */}
                {activeTab === 'users' &&
                  filteredAllUsers.map((u) => {
                    const isMe = u._id === myId;
                    const r = resolveUserName(u._id);
                    const isOnline = onlineUserIds.includes(u._id);

                    return (
                      <div
                        key={u._id}
                        onClick={() => {
                          if (isMe) {
                            setShowProfileDrawer(true);
                          } else {
                            setSelectedFriendId(u._id);
                            setRightPaneMode('direct');
                          }
                        }}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#121218] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <UserAvatar
                            src={u.dp}
                            name={r.primaryName}
                            size="md"
                            isOnline={isOnline}
                            showOnlineStatus
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white truncate">
                                {r.primaryName}
                              </span>
                              {isMe && (
                                <span className="text-xs text-red-400 font-mono">
                                  (You)
                                </span>
                              )}
                              {r.isPrivateSaved && (
                                <Lock
                                  className="w-3 h-3 text-red-400 shrink-0"
                                  title="Private saved friend name (visible only to you)"
                                />
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 truncate">
                              @{u.username} · {u.bio || 'OPAI Member'}
                            </div>
                          </div>
                        </div>

                        {!isMe && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setContactModalTarget(u);
                            }}
                            title="Save Private Friend Name (Visible only to you)"
                            className="px-2.5 py-1.5 rounded-lg bg-[#181216] hover:bg-red-600 text-red-300 hover:text-white border border-red-900/50 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0"
                          >
                            {r.isPrivateSaved ? 'Edit Name' : 'Save Friend'}
                          </button>
                        )}
                      </div>
                    );
                  })}

                {/* TAB 4: POSTS (Left Column Quick Composer & Post List) */}
                {activeTab === 'posts' && (
                  <div className="p-4 space-y-4">
                    <form
                      onSubmit={handlePublishPost}
                      className="p-3.5 rounded-2xl bg-[#121218] border border-red-900/50 space-y-3"
                    >
                      <div className="text-xs font-semibold text-red-400">
                        Create New Post
                      </div>
                      <textarea
                        rows={3}
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="Share a status or post with everyone..."
                        className="w-full p-2.5 rounded-xl bg-[#0b0b0f] border border-zinc-800 focus:border-red-500 focus:outline-none text-xs text-white resize-none"
                      />
                      {postImage && (
                        <div className="relative inline-block">
                          <img
                            src={postImage}
                            alt="Preview"
                            className="h-20 rounded-lg object-cover border border-red-900/50"
                          />
                          <button
                            type="button"
                            onClick={() => setPostImage('')}
                            className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-black text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => postFileRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1a1a22] text-xs text-zinc-300 hover:text-red-400"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-red-500" />
                          <span>Photo</span>
                        </button>
                        <input
                          ref={postFileRef}
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = await compressImageFile(
                                file,
                                800,
                                800,
                                0.84
                              );
                              setPostImage(url);
                            }
                          }}
                          className="hidden"
                        />
                        <button
                          type="submit"
                          disabled={
                            publishingPost || (!postContent.trim() && !postImage)
                          }
                          className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-semibold text-white"
                        >
                          {publishingPost ? 'Posting...' : 'Post Now'}
                        </button>
                      </div>
                    </form>

                    <div className="space-y-2">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                        Recent Community Posts ({posts.length})
                      </div>
                      {posts.map((p) => {
                        const author = resolveUserName(p.authorId);
                        return (
                          <div
                            key={p._id}
                            onClick={() => setRightPaneMode('posts')}
                            className="p-3 rounded-xl bg-[#111116] hover:bg-[#181216] border border-zinc-800/80 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <UserAvatar
                                src={author.dp}
                                name={author.primaryName}
                                size="xs"
                              />
                              <span className="text-xs font-semibold text-white truncate">
                                {author.primaryName}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                                {p.comments.length} comments
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 line-clamp-2">
                              {p.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Bottom Navigation Bar (WhatsApp Mobile style) */}
              <div className="flex md:hidden items-center justify-around h-14 bg-[#09090d] border-t border-red-950/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
                    activeTab === 'home' ? 'text-red-500' : 'text-zinc-400'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chats</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('groups')}
                  className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
                    activeTab === 'groups' ? 'text-red-500' : 'text-zinc-400'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Groups</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
                    activeTab === 'users' ? 'text-red-500' : 'text-zinc-400'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>All Users</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('posts');
                    setRightPaneMode('posts');
                  }}
                  className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
                    activeTab === 'posts' ? 'text-red-500' : 'text-zinc-400'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span>Posts</span>
                </button>
              </div>
            </>
          )}
        </section>

        {/* 3. WHATSAPP RIGHT MAIN CONVERSATION / FEED VIEWPORT */}
        <main
          className={`${
            isMobileRightOpen ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col h-full opai-whatsapp-bg relative overflow-hidden`}
        >
          {/* CASE A: 1-ON-1 DIRECT FRIEND CHAT */}
          {rightPaneMode === 'direct' && selectedFriendId && activePartner ? (
            <>
              {/* WhatsApp Chat Top Bar */}
              <div className="h-16 px-4 bg-[#10090c] border-b border-red-950/70 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setRightPaneMode(null)}
                    className="md:hidden p-1.5 rounded-full text-zinc-300 hover:text-white"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <UserAvatar
                    src={activePartner.dp}
                    name={activePartner.primaryName}
                    size="sm"
                    isOnline={onlineUserIds.includes(selectedFriendId)}
                    showOnlineStatus
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display text-sm font-bold text-white truncate">
                        {activePartner.primaryName}
                      </h3>
                      {activePartner.isPrivateSaved && (
                        <Lock
                          className="w-3 h-3 text-red-400 shrink-0"
                          title="Private saved friend name (visible only to you)"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {typingUserMap[selectedFriendId] ? (
                        <span className="text-red-400 font-medium">
                          typing...
                        </span>
                      ) : onlineUserIds.includes(selectedFriendId) ? (
                        'online'
                      ) : (
                        `@${activePartner.username}`
                      )}
                    </div>
                  </div>
                </div>

                {activePartner.userObj && (
                  <button
                    type="button"
                    onClick={() => setContactModalTarget(activePartner.userObj!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1115] hover:bg-red-600 border border-red-900/60 text-xs font-medium text-red-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>
                      {activePartner.isPrivateSaved
                        ? 'Edit Private Name'
                        : 'Save Friend Name'}
                    </span>
                  </button>
                )}
              </div>

              {/* WhatsApp Direct Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
                {loadingDirect ? (
                  <div className="text-center py-10 text-xs font-mono text-zinc-500">
                    Loading messages...
                  </div>
                ) : directMessages.length === 0 ? (
                  <div className="max-w-xs mx-auto my-12 p-4 rounded-xl bg-[#110c0f]/90 border border-red-950/60 text-center space-y-1">
                    <div className="text-xs font-semibold text-red-400">
                      End-to-End Live MongoDB Sync
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Say hello to {activePartner.primaryName} to start chatting live.
                    </p>
                  </div>
                ) : (
                  directMessages.map((msg) => {
                    const isMine = msg.senderId === myId;
                    return (
                      <div
                        key={msg._id}
                        className={`flex ${
                          isMine ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[78%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-md ${
                            isMine
                              ? 'bg-gradient-to-br from-[#c81e1e] to-[#7f1d1d] text-white rounded-tr-none'
                              : 'bg-[#15151c] border border-red-950/50 text-zinc-100 rounded-tl-none'
                          }`}
                        >
                          {msg.image && (
                            <img
                              src={msg.image}
                              alt="Attachment"
                              referrerPolicy="no-referrer"
                              className="max-h-64 rounded-xl object-cover mb-1.5"
                            />
                          )}
                          {msg.text && (
                            <p className="text-sm leading-relaxed break-words select-text">
                              {msg.text}
                            </p>
                          )}
                          <div
                            className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] font-mono tabular-nums ${
                              isMine ? 'text-red-200' : 'text-zinc-500'
                            }`}
                          >
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isMine && (
                              <>
                                <CheckCheck className="w-3.5 h-3.5 text-red-200" />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteDirectMessage(msg._id)
                                  }
                                  title="Delete message"
                                  className="hover:text-white ml-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={directEndRef} />
              </div>

              {/* WhatsApp Bottom Message Bar */}
              <form
                onSubmit={handleSendDirect}
                className="px-4 py-3 bg-[#10090c] border-t border-red-950/70 shrink-0"
              >
                {directImage && (
                  <div className="mb-2 inline-flex items-center gap-2 p-1.5 rounded-xl bg-[#181820] border border-red-900/50">
                    <img
                      src={directImage}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setDirectImage('')}
                      className="p-1 text-zinc-400 hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => directFileRef.current?.click()}
                    className="p-2.5 rounded-full bg-[#17171f] hover:bg-red-950/50 text-zinc-300 hover:text-red-400 transition-colors shrink-0"
                    title="Attach Photo"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <input
                    ref={directFileRef}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = await compressImageFile(
                          file,
                          720,
                          720,
                          0.82
                        );
                        setDirectImage(url);
                      }
                    }}
                    className="hidden"
                  />

                  <input
                    type="text"
                    value={directText}
                    onChange={(e) => {
                      setDirectText(e.target.value);
                      if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(
                          JSON.stringify({
                            type: 'typing:direct',
                            receiverId: selectedFriendId,
                            isTyping: e.target.value.trim().length > 0,
                          })
                        );
                        if (typingTimeoutRef.current)
                          window.clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = window.setTimeout(() => {
                          wsRef.current?.send(
                            JSON.stringify({
                              type: 'typing:direct',
                              receiverId: selectedFriendId,
                              isTyping: false,
                            })
                          );
                        }, 2000);
                      }
                    }}
                    placeholder="Type a message"
                    className="flex-1 px-4 py-2.5 rounded-full bg-[#17171f] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-500"
                  />

                  <button
                    type="submit"
                    disabled={
                      sendingDirect || (!directText.trim() && !directImage)
                    }
                    className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-40 flex items-center justify-center text-white shadow-[0_0_14px_rgba(220,38,38,0.45)] transition-colors shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : rightPaneMode === 'group' && activeGroup ? (
            /* CASE B: WHATSAPP GROUP CHAT + SLIDING GROUP INFO DRAWER */
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Group Top Header */}
                <div className="h-16 px-4 bg-[#10090c] border-b border-red-950/70 flex items-center justify-between gap-3 shrink-0">
                  <div
                    onClick={() => setShowGroupInfoDrawer((v) => !v)}
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRightPaneMode(null);
                      }}
                      className="md:hidden p-1.5 rounded-full text-zinc-300 hover:text-white"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <UserAvatar
                      src={activeGroup.dp}
                      name={activeGroup.name}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold text-white truncate">
                        {activeGroup.name}
                      </h3>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {activeGroup.members
                          .map((id) => resolveUserName(id).primaryName)
                          .join(', ')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowGroupInfoDrawer((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      showGroupInfoDrawer
                        ? 'bg-red-600 text-white border-red-500'
                        : 'bg-[#1a1115] text-red-300 border-red-900/60 hover:bg-red-950/60'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Group Info ({activeGroup.members.length})</span>
                  </button>
                </div>

                {groupError && (
                  <div className="px-4 py-2 bg-red-950/80 border-b border-red-500/50 text-xs text-red-200 flex items-center justify-between">
                    <span>{groupError}</span>
                    <button
                      type="button"
                      onClick={() => setGroupError('')}
                      className="text-red-300 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Group Messages Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
                  {loadingGroup ? (
                    <div className="text-center py-10 text-xs font-mono text-zinc-500">
                      Loading group chat...
                    </div>
                  ) : groupMessages.length === 0 ? (
                    <div className="max-w-sm mx-auto my-12 p-4 rounded-xl bg-[#110c0f]/90 border border-red-950/60 text-center space-y-1">
                      <div className="text-xs font-semibold text-red-400">
                        {activeGroup.name}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Owner & Admins can delete any member message. Members can delete their own messages.
                      </p>
                    </div>
                  ) : (
                    groupMessages.map((msg) => {
                      const isMine = msg.senderId === myId;
                      const sender = resolveUserName(msg.senderId);
                      const isSenderOwner =
                        msg.senderId === activeGroup.ownerId;
                      const isSenderAdmin = activeGroup.admins.includes(
                        msg.senderId
                      );

                      // Owner & Admins can delete ANY message; Members can only delete their own
                      const canDelete =
                        isMyGroupOwner || isMyGroupAdmin || isMine;

                      return (
                        <div
                          key={msg._id}
                          className={`flex ${
                            isMine ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[78%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-md ${
                              isMine
                                ? 'bg-gradient-to-br from-[#c81e1e] to-[#7f1d1d] text-white rounded-tr-none'
                                : 'bg-[#15151c] border border-red-950/50 text-zinc-100 rounded-tl-none'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-[11px] mb-0.5">
                              <span
                                className={`font-bold ${
                                  isMine ? 'text-red-100' : 'text-red-400'
                                }`}
                              >
                                {isMine ? 'You' : sender.primaryName}
                              </span>
                              {!isMine && sender.isPrivateSaved && (
                                <Lock className="w-2.5 h-2.5 text-red-400" />
                              )}
                              <span
                                className={
                                  isMine ? 'text-red-200/80' : 'text-zinc-500'
                                }
                              >
                                ·{' '}
                                {isSenderOwner
                                  ? 'Owner'
                                  : isSenderAdmin
                                  ? 'Admin'
                                  : 'Member'}
                              </span>
                            </div>

                            {msg.image && (
                              <img
                                src={msg.image}
                                alt="Attachment"
                                referrerPolicy="no-referrer"
                                className="max-h-64 rounded-xl object-cover mb-1.5"
                              />
                            )}
                            {msg.text && (
                              <p className="text-sm leading-relaxed break-words select-text">
                                {msg.text}
                              </p>
                            )}

                            <div
                              className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] font-mono tabular-nums ${
                                isMine ? 'text-red-200' : 'text-zinc-500'
                              }`}
                            >
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  [],
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </span>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteGroupMessage(msg._id)
                                  }
                                  title={
                                    isMine
                                      ? 'Delete your message'
                                      : 'Delete member message (Owner/Admin)'
                                  }
                                  className="hover:text-red-300 ml-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={groupEndRef} />
                </div>

                {/* WhatsApp Group Bottom Input Bar */}
                <form
                  onSubmit={handleSendGroupMessage}
                  className="px-4 py-3 bg-[#10090c] border-t border-red-950/70 shrink-0"
                >
                  {groupImage && (
                    <div className="mb-2 inline-flex items-center gap-2 p-1.5 rounded-xl bg-[#181820] border border-red-900/50">
                      <img
                        src={groupImage}
                        alt="Preview"
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setGroupImage('')}
                        className="p-1 text-zinc-400 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => groupFileRef.current?.click()}
                      className="p-2.5 rounded-full bg-[#17171f] hover:bg-red-950/50 text-zinc-300 hover:text-red-400 transition-colors shrink-0"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <input
                      ref={groupFileRef}
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await compressImageFile(
                            file,
                            720,
                            720,
                            0.82
                          );
                          setGroupImage(url);
                        }
                      }}
                      className="hidden"
                    />

                    <input
                      type="text"
                      value={groupText}
                      onChange={(e) => setGroupText(e.target.value)}
                      placeholder={`Message ${activeGroup.name}`}
                      className="flex-1 px-4 py-2.5 rounded-full bg-[#17171f] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-500"
                    />

                    <button
                      type="submit"
                      disabled={
                        sendingGroup || (!groupText.trim() && !groupImage)
                      }
                      className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-40 flex items-center justify-center text-white shadow-[0_0_14px_rgba(220,38,38,0.45)] transition-colors shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* WhatsApp Right Sliding Group Info & Roles Drawer */}
              {showGroupInfoDrawer && (
                <aside className="w-80 bg-[#0b0b0f] border-l border-red-950/70 flex flex-col h-full overflow-y-auto p-4 space-y-5 shrink-0">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
                    <h4 className="font-display text-sm font-bold text-white">
                      Group Info & Roles
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowGroupInfoDrawer(false)}
                      className="p-1 text-zinc-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Members List with Owner / Admin Controls */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      {activeGroup.members.length} Participants
                    </div>
                    {activeGroup.members.map((memberId) => {
                      const r = resolveUserName(memberId);
                      const isOwner = memberId === activeGroup.ownerId;
                      const isAdmin = activeGroup.admins.includes(memberId);

                      const canToggleAdmin = isMyGroupOwner && !isOwner;
                      // Owner can NEVER be removed by anyone!
                      const canRemoveMember =
                        !isOwner &&
                        (isMyGroupOwner || (isMyGroupAdmin && !isAdmin));

                      return (
                        <div
                          key={memberId}
                          className="p-2.5 rounded-xl bg-[#121218] border border-zinc-800/80 space-y-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              src={r.dp}
                              name={r.primaryName}
                              size="xs"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-semibold text-white truncate">
                                  {r.primaryName}
                                </span>
                                {r.isPrivateSaved && (
                                  <Lock className="w-2.5 h-2.5 text-red-400" />
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                {isOwner
                                  ? 'Group Owner (Cannot be removed)'
                                  : isAdmin
                                  ? 'Group Admin'
                                  : 'Member'}
                              </div>
                            </div>
                          </div>

                          {(canToggleAdmin || canRemoveMember) && (
                            <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/80">
                              {canToggleAdmin && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleAdmin(memberId, !isAdmin)
                                  }
                                  className="flex-1 py-1 px-2 rounded-lg bg-[#1c1216] hover:bg-red-950/60 border border-red-900/50 text-[11px] font-medium text-red-300"
                                >
                                  {isAdmin ? 'Dismiss Admin' : 'Make Admin'}
                                </button>
                              )}
                              {canRemoveMember && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveGroupMember(memberId)
                                  }
                                  className="py-1 px-2.5 rounded-lg bg-red-950/40 hover:bg-red-600 text-[11px] font-medium text-red-300 hover:text-white"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Participants */}
                  <div className="pt-3 border-t border-zinc-900 space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Add Users to Group
                    </div>
                    {allUsers
                      .filter((u) => !activeGroup.members.includes(u._id))
                      .map((u) => {
                        const r = resolveUserName(u._id);
                        return (
                          <div
                            key={u._id}
                            className="p-2 rounded-xl bg-[#121218] border border-zinc-800/80 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                src={u.dp}
                                name={r.primaryName}
                                size="xs"
                              />
                              <span className="text-xs font-medium text-white truncate">
                                {r.primaryName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddGroupMember(u._id)}
                              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-[11px] font-semibold text-white"
                            >
                              Add
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </aside>
              )}
            </div>
          ) : rightPaneMode === 'posts' || activeTab === 'posts' ? (
            /* CASE C: COMMUNITY POSTS & COMMENTS FEED INSIDE WHATSAPP VIEWPORT */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="h-16 px-4 bg-[#10090c] border-b border-red-950/70 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setRightPaneMode(null)}
                  className="md:hidden p-1.5 rounded-full text-zinc-300 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Flame className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="font-display text-sm font-bold text-white">
                    OPAI Community Posts & Updates
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Every user can comment on posts in real time
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {posts.length === 0 ? (
                  <div className="max-w-sm mx-auto my-16 p-6 rounded-2xl bg-[#100b0e] border border-red-950/60 text-center space-y-2">
                    <Flame className="w-8 h-8 text-red-500 mx-auto" />
                    <div className="text-sm font-semibold text-white">
                      No posts shared yet
                    </div>
                    <p className="text-xs text-zinc-400">
                      Use the "Create New Post" box in the left panel to share the first update!
                    </p>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto space-y-4">
                    {posts.map((post) => {
                      const author = resolveUserName(post.authorId);
                      const isMyPost = post.authorId === myId;
                      const isLiked = post.likes.includes(myId);

                      return (
                        <article
                          key={post._id}
                          className="p-5 rounded-2xl bg-[#0e0e13] border border-red-900/45 space-y-3.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                src={author.dp}
                                name={author.primaryName}
                                size="sm"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-white">
                                    {author.primaryName}
                                  </span>
                                  {author.isPrivateSaved && (
                                    <Lock className="w-3 h-3 text-red-400" />
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500">
                                  @{author.username} ·{' '}
                                  {new Date(post.createdAt).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>

                            {isMyPost && (
                              <button
                                type="button"
                                onClick={() => handleDeletePost(post._id)}
                                className="p-1.5 text-zinc-500 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line select-text">
                            {post.content}
                          </p>

                          {post.image && (
                            <img
                              src={post.image}
                              alt="Post"
                              referrerPolicy="no-referrer"
                              className="w-full max-h-80 object-cover rounded-xl border border-red-950/60"
                            />
                          )}

                          <div className="flex items-center gap-6 pt-2 border-t border-zinc-900 text-xs">
                            <button
                              type="button"
                              onClick={() => handleToggleLikePost(post._id)}
                              className={`inline-flex items-center gap-1.5 font-medium ${
                                isLiked
                                  ? 'text-red-500'
                                  : 'text-zinc-400 hover:text-red-400'
                              }`}
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  isLiked ? 'fill-red-500 text-red-500' : ''
                                }`}
                              />
                              <span>{post.likes.length} Likes</span>
                            </button>
                            <div className="inline-flex items-center gap-1.5 text-zinc-400">
                              <MessageCircle className="w-4 h-4 text-red-400" />
                              <span>{post.comments.length} Comments</span>
                            </div>
                          </div>

                          {/* Comments list */}
                          {post.comments.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-zinc-900/80">
                              {post.comments.map((c) => {
                                const cAuthor = resolveUserName(c.authorId);
                                return (
                                  <div
                                    key={c._id}
                                    className="p-2.5 rounded-xl bg-[#14141c] flex items-start gap-2.5"
                                  >
                                    <UserAvatar
                                      src={cAuthor.dp}
                                      name={cAuthor.primaryName}
                                      size="xs"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <span className="font-semibold text-white">
                                          {cAuthor.primaryName}
                                        </span>
                                        {cAuthor.isPrivateSaved && (
                                          <Lock className="w-2.5 h-2.5 text-red-400" />
                                        )}
                                        <span className="text-[10px] font-mono text-zinc-500">
                                          @{cAuthor.username}
                                        </span>
                                      </div>
                                      <p className="text-xs text-zinc-300 mt-0.5 break-words select-text">
                                        {c.text}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add Comment Input */}
                          <form
                            onSubmit={(e) => handleAddComment(e, post._id)}
                            className="flex items-center gap-2 pt-1"
                          >
                            <input
                              type="text"
                              value={commentInputs[post._id] || ''}
                              onChange={(e) =>
                                setCommentInputs((prev) => ({
                                  ...prev,
                                  [post._id]: e.target.value,
                                }))
                              }
                              placeholder="Write a comment..."
                              className="flex-1 px-3.5 py-2 rounded-full bg-[#16161f] border border-zinc-800 focus:border-red-500 focus:outline-none text-xs text-white placeholder-zinc-500"
                            />
                            <button
                              type="submit"
                              disabled={
                                submittingCommentId === post._id ||
                                !(commentInputs[post._id] || '').trim()
                              }
                              className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-semibold text-white"
                            >
                              Send
                            </button>
                          </form>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* DEFAULT WHATSAPP EMPTY RIGHT VIEWPORT */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-red-950/40 border border-red-800/50 flex items-center justify-center mb-4 opai-rgb-border">
                <MessageSquare className="w-9 h-9 text-red-500" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">
                OPAI Web · Red & Black Messenger
              </h2>
              <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-6">
                Select a friend or group on the left to start chatting live. Click your profile
                name in the top-left anytime to customize your Username, DP, or set an optional
                password.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#120b0e] border border-red-950/70 text-[11px] font-mono text-zinc-400">
                <Lock className="w-3.5 h-3.5 text-red-500" />
                <span>Real-Time MongoDB Sync · Private Saved Contact Names</span>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0b0b0f] border border-red-900/60 rounded-2xl overflow-hidden opai-rgb-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-red-950/60 bg-[#12080b]">
              <h3 className="font-display text-sm font-bold text-white">
                New Group (You are Permanent Owner)
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="p-5 space-y-4">
              <div className="flex items-center gap-3.5">
                <UserAvatar
                  src={newGroupDp}
                  name={newGroupName || 'GR'}
                  size="md"
                />
                <button
                  type="button"
                  onClick={() => groupDpFileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-xs font-medium text-red-300"
                >
                  Upload Group DP
                </button>
                <input
                  ref={groupDpFileRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = await compressImageFile(
                        file,
                        360,
                        360,
                        0.85
                      );
                      setNewGroupDp(url);
                    }
                  }}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Group Subject / Name
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#14141c] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Group Description
                </label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Optional group description..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#14141c] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Select Friends to Add ({selectedInitialMembers.length})
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl bg-[#111116] border border-zinc-800">
                  {otherUsers.length === 0 ? (
                    <div className="text-xs text-zinc-500 text-center py-2">
                      No other users yet. You can add members later.
                    </div>
                  ) : (
                    otherUsers.map((u) => {
                      const r = resolveUserName(u._id);
                      const checked = selectedInitialMembers.includes(u._id);
                      return (
                        <label
                          key={u._id}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-zinc-900 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              src={u.dp}
                              name={r.primaryName}
                              size="xs"
                            />
                            <span className="text-xs text-white">
                              {r.primaryName}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedInitialMembers((prev) =>
                                checked
                                  ? prev.filter((id) => id !== u._id)
                                  : [...prev, u._id]
                              )
                            }
                            className="accent-red-600"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
                >
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save Private Friend Name Modal */}
      {contactModalTarget && (
        <SaveContactModal
          targetUser={contactModalTarget}
          existingCustomName={existingSavedNameForTarget}
          token={token}
          onClose={() => setContactModalTarget(null)}
          onSaved={(updatedSelf) => setCurrentUser(updatedSelf)}
        />
      )}
    </div>
  );
}
