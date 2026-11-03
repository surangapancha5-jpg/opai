import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Image as ImageIcon,
  Trash2,
  Bookmark,
  MessageSquare,
  Search,
  Users,
  X,
  Lock,
} from 'lucide-react';
import { User, DirectMessage } from '../types';
import { UserAvatar } from './UserAvatar';
import { compressImageFile } from '../utils/imageUtils';

interface HomeViewProps {
  currentUser: User;
  allUsers: User[];
  onlineUserIds: string[];
  token: string;
  selectedFriendId: string | null;
  onSelectFriend: (userId: string) => void;
  onOpenSaveContact: (user: User) => void;
  onNavigateTab: (tab: 'home' | 'groups' | 'users' | 'posts') => void;
  resolveUserName: (userId: string) => {
    primaryName: string;
    username: string;
    isPrivateSaved: boolean;
    dp: string;
    userObj?: User;
  };
  incomingDirectMessage: DirectMessage | null;
  deletedDirectMessageId: string | null;
  typingUserMap: Record<string, boolean>;
  onSendTyping: (receiverId: string, isTyping: boolean) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  allUsers,
  onlineUserIds,
  token,
  selectedFriendId,
  onSelectFriend,
  onOpenSaveContact,
  onNavigateTab,
  resolveUserName,
  incomingDirectMessage,
  deletedDirectMessageId,
  typingUserMap,
  onSendTyping,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [contactFilter, setContactFilter] = useState<'all' | 'saved'>('all');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [recentPartnerMap, setRecentPartnerMap] = useState<Record<string, DirectMessage>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const otherUsers = allUsers.filter((u) => u._id !== currentUser._id);
  const savedFriendIds = new Set(
    (currentUser.savedContacts || []).map((c) => String(c.userId))
  );

  // Fetch recent direct messages summary
  useEffect(() => {
    fetch('/api/direct-messages-recent', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.recentMessages)) {
          const map: Record<string, DirectMessage> = {};
          for (const item of data.recentMessages) {
            if (item.partnerId && item.lastMessage) {
              map[item.partnerId] = item.lastMessage;
            }
          }
          setRecentPartnerMap(map);
        }
      })
      .catch(() => {});
  }, [token]);

  // Load direct messages for selected friend
  useEffect(() => {
    if (!selectedFriendId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    fetch(`/api/direct-messages/${selectedFriendId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [selectedFriendId, token]);

  // Listen to live incoming direct message via WS
  useEffect(() => {
    if (!incomingDirectMessage) return;
    const msg = incomingDirectMessage;
    const partnerId =
      msg.senderId === currentUser._id ? msg.receiverId : msg.senderId;

    setRecentPartnerMap((prev) => ({
      ...prev,
      [partnerId]: msg,
    }));

    if (
      selectedFriendId &&
      ((msg.senderId === currentUser._id && msg.receiverId === selectedFriendId) ||
        (msg.senderId === selectedFriendId && msg.receiverId === currentUser._id))
    ) {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    }
  }, [incomingDirectMessage, selectedFriendId, currentUser._id]);

  // Listen to live deleted direct message via WS
  useEffect(() => {
    if (!deletedDirectMessageId) return;
    setMessages((prev) => prev.filter((m) => m._id !== deletedDirectMessageId));
  }, [deletedDirectMessageId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedFriendId]);

  const handleTextChange = (val: string) => {
    setText(val);
    if (selectedFriendId) {
      onSendTyping(selectedFriendId, val.trim().length > 0);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        onSendTyping(selectedFriendId, false);
      }, 2000);
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 720, 720, 0.82);
      setAttachedImage(dataUrl);
    } catch {
      // Ignore invalid image
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendId || (!text.trim() && !attachedImage) || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/direct-messages/${selectedFriendId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: text.trim(),
          image: attachedImage,
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setText('');
        setAttachedImage('');
        onSendTyping(selectedFriendId, false);
        setMessages((prev) =>
          prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]
        );
        setRecentPartnerMap((prev) => ({
          ...prev,
          [selectedFriendId]: data.message,
        }));
      }
    } finally {
      setSending(false);
    }
  };

  const handleDeleteDirectMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/direct-messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    } catch {
      // Ignore network error
    }
  };

  // Sort sidebar contacts: saved friends & recent chat partners first
  const filteredContacts = otherUsers
    .filter((u) => {
      if (contactFilter === 'saved' && !savedFriendIds.has(u._id)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const resolved = resolveUserName(u._id);
      return (
        resolved.primaryName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aLast = recentPartnerMap[a._id]?.createdAt || '';
      const bLast = recentPartnerMap[b._id]?.createdAt || '';
      if (aLast !== bLast) return bLast.localeCompare(aLast);
      const aSaved = savedFriendIds.has(a._id) ? 1 : 0;
      const bSaved = savedFriendIds.has(b._id) ? 1 : 0;
      return bSaved - aSaved;
    });

  const activePartner = selectedFriendId ? resolveUserName(selectedFriendId) : null;
  const isPartnerOnline = selectedFriendId
    ? onlineUserIds.includes(selectedFriendId)
    : false;
  const isPartnerTyping = selectedFriendId ? Boolean(typingUserMap[selectedFriendId]) : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-5.5rem)] min-h-[580px]">
      {/* Left Column: Friends & Direct Messages Sidebar */}
      <aside className="lg:col-span-4 bg-[#0b0b0e] border border-red-900/45 rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-red-950/60 space-y-3 bg-[#0f080a]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">
              Live Friend Chats
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('users')}
              className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors whitespace-nowrap shrink-0"
            >
              Find Friends
            </button>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends or private names..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#131318] border border-zinc-800 focus:border-red-500 focus:outline-none text-xs text-white placeholder-zinc-500"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#121216] rounded-xl border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setContactFilter('all')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                contactFilter === 'all'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Contacts ({otherUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setContactFilter('saved')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                contactFilter === 'saved'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Saved Friends ({savedFriendIds.size})
            </button>
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/80">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Users className="w-8 h-8 text-red-500/60 mx-auto" />
              <div className="text-sm font-medium text-zinc-300">
                {contactFilter === 'saved'
                  ? 'No saved friends yet'
                  : 'No other registered users yet'}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {contactFilter === 'saved'
                  ? 'Open All Users to save any friend with a private custom name visible only to you.'
                  : 'Invite a friend to register on OPAI Chat to start chatting live in real time.'}
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('users')}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                Browse All Users
              </button>
            </div>
          ) : (
            filteredContacts.map((u) => {
              const resolved = resolveUserName(u._id);
              const lastMsg = recentPartnerMap[u._id];
              const isSelected = selectedFriendId === u._id;
              const isOnline = onlineUserIds.includes(u._id);

              return (
                <div
                  key={u._id}
                  onClick={() => onSelectFriend(u._id)}
                  className={`w-full p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-red-950/35 border border-red-600/50'
                      : 'hover:bg-[#121217]'
                  }`}
                >
                  <UserAvatar
                    src={u.dp}
                    name={resolved.primaryName}
                    size="md"
                    isOnline={isOnline}
                    showOnlineStatus
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-white truncate">
                          {resolved.primaryName}
                        </span>
                        {resolved.isPrivateSaved && (
                          <Lock
                            className="w-3 h-3 text-red-400 shrink-0"
                            title="Private saved friend name (visible only to you)"
                          />
                        )}
                      </div>
                      {lastMsg && (
                        <span className="text-[11px] font-mono tabular-nums text-zinc-500 shrink-0">
                          {new Date(lastMsg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                      {typingUserMap[u._id] ? (
                        <span className="text-red-400 font-medium">Typing...</span>
                      ) : lastMsg ? (
                        lastMsg.text || 'Sent a photo'
                      ) : (
                        <span className="text-zinc-500 font-mono">@{u.username}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Column: Live 1-on-1 Chat Workspace */}
      <section className="lg:col-span-8 bg-[#0b0b0e] border border-red-900/45 rounded-2xl flex flex-col overflow-hidden">
        {!selectedFriendId || !activePartner ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-800/50 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-2">
              Welcome to OPAI Live Chat, {currentUser.displayName}
            </h3>
            <p className="text-sm text-zinc-400 max-w-md mb-8 leading-relaxed">
              Select any friend from the left panel to chat live in real time, or save custom
              private nicknames for your friends that only you can see.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg text-left">
              <button
                type="button"
                onClick={() => onNavigateTab('users')}
                className="p-4 rounded-xl bg-[#111116] hover:bg-[#161215] border border-red-950/60 transition-colors"
              >
                <div className="font-mono text-lg font-bold text-red-400 tabular-nums">
                  {allUsers.length}
                </div>
                <div className="text-xs font-medium text-zinc-300 mt-1">Registered Users</div>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('groups')}
                className="p-4 rounded-xl bg-[#111116] hover:bg-[#161215] border border-red-950/60 transition-colors"
              >
                <div className="font-mono text-lg font-bold text-red-400 tabular-nums">
                  Groups
                </div>
                <div className="text-xs font-medium text-zinc-300 mt-1">Owner & Admin Rooms</div>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('posts')}
                className="p-4 rounded-xl bg-[#111116] hover:bg-[#161215] border border-red-950/60 transition-colors"
              >
                <div className="font-mono text-lg font-bold text-red-400 tabular-nums">
                  Posts
                </div>
                <div className="text-xs font-medium text-zinc-300 mt-1">Community Feed</div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Active Chat Header */}
            <div className="px-6 py-4 border-b border-red-950/60 bg-[#0f080a] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <UserAvatar
                  src={activePartner.dp}
                  name={activePartner.primaryName}
                  size="md"
                  isOnline={isPartnerOnline}
                  showOnlineStatus
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold text-white truncate">
                      {activePartner.primaryName}
                    </h3>
                    {activePartner.isPrivateSaved && (
                      <span className="text-xs text-red-400 font-mono">
                        · Private Name (@{activePartner.username})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span>{isPartnerOnline ? 'Online now' : `@${activePartner.username}`}</span>
                    {isPartnerTyping && (
                      <span className="text-red-400 font-medium">· typing live...</span>
                    )}
                  </div>
                </div>
              </div>

              {activePartner.userObj && (
                <button
                  type="button"
                  onClick={() => onOpenSaveContact(activePartner.userObj!)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#161216] hover:bg-red-950/50 border border-red-900/50 text-xs font-medium text-red-300 transition-colors whitespace-nowrap shrink-0"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>
                    {activePartner.isPrivateSaved ? 'Edit Private Name' : 'Save Friend Name'}
                  </span>
                </button>
              )}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#08080b]">
              {loadingMessages ? (
                <div className="text-center py-12 text-xs text-zinc-500 font-mono">
                  Loading conversation...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <div className="text-sm font-medium text-zinc-300">
                    Start your live conversation with {activePartner.primaryName}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Messages are delivered live via WebSockets and saved in MongoDB.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === currentUser._id;
                  return (
                    <div
                      key={msg._id}
                      className={`flex items-end gap-2.5 ${
                        isMine ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {!isMine && (
                        <UserAvatar
                          src={activePartner.dp}
                          name={activePartner.primaryName}
                          size="xs"
                        />
                      )}

                      <div
                        className={`group relative max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isMine
                            ? 'bg-gradient-to-br from-red-600 to-red-800 text-white rounded-br-sm shadow-[0_2px_14px_rgba(220,38,38,0.25)]'
                            : 'bg-[#141419] border border-zinc-800/90 text-zinc-100 rounded-bl-sm'
                        }`}
                      >
                        {msg.image && (
                          <img
                            src={msg.image}
                            alt="Chat attachment"
                            referrerPolicy="no-referrer"
                            className="max-h-60 rounded-xl object-cover mb-2 border border-black/20"
                          />
                        )}
                        {msg.text && (
                          <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                        )}
                        <div
                          className={`flex items-center justify-end gap-2 mt-1 text-[10px] font-mono tabular-nums ${
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
                            <button
                              type="button"
                              onClick={() => handleDeleteDirectMessage(msg._id)}
                              title="Delete your message"
                              className="opacity-70 hover:opacity-100 text-white hover:text-red-200 transition-opacity"
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
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-red-950/60 bg-[#0d0d11]"
            >
              {attachedImage && (
                <div className="mb-3 inline-flex items-center gap-2 p-2 rounded-xl bg-[#16161c] border border-red-900/50">
                  <img
                    src={attachedImage}
                    alt="Preview"
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachedImage('')}
                    className="p-1 text-zinc-400 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach photo"
                  className="p-2.5 rounded-xl bg-[#15151b] hover:bg-red-950/40 border border-zinc-800 text-zinc-400 hover:text-red-400 transition-colors shrink-0"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImagePick}
                  className="hidden"
                />

                <input
                  type="text"
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder={`Message ${activePartner.primaryName}...`}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#141419] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-500"
                />

                <button
                  type="submit"
                  disabled={sending || (!text.trim() && !attachedImage)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-[0_0_16px_rgba(220,38,38,0.35)] whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
};
