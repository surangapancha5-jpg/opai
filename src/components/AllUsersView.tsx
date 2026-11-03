import React, { useState } from 'react';
import { Search, MessageSquare, Bookmark, Lock, Users } from 'lucide-react';
import { User } from '../types';
import { UserAvatar } from './UserAvatar';

interface AllUsersViewProps {
  currentUser: User;
  allUsers: User[];
  onlineUserIds: string[];
  onStartChat: (userId: string) => void;
  onOpenSaveContact: (user: User) => void;
  resolveUserName: (userId: string) => {
    primaryName: string;
    username: string;
    isPrivateSaved: boolean;
    dp: string;
    userObj?: User;
  };
}

export const AllUsersView: React.FC<AllUsersViewProps> = ({
  currentUser,
  allUsers,
  onlineUserIds,
  onStartChat,
  onOpenSaveContact,
  resolveUserName,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'saved' | 'online'>('all');

  const savedSet = new Set(
    (currentUser.savedContacts || []).map((c) => String(c.userId))
  );

  const filteredUsers = allUsers.filter((u) => {
    if (filter === 'saved' && !savedSet.has(u._id)) return false;
    if (filter === 'online' && !onlineUserIds.includes(u._id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const resolved = resolveUserName(u._id);
    return (
      resolved.primaryName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.bio || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="p-6 rounded-2xl bg-[#0b0b0e] border border-red-900/45 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">
            All Registered Users ({allUsers.length})
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Every user listed here is a real account stored in MongoDB. Save any friend with a
            private custom name visible only to you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username or saved name..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#121217] border border-zinc-800 focus:border-red-500 focus:outline-none text-xs text-white placeholder-zinc-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#121217] rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === 'all'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All ({allUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('saved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === 'saved'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Saved Friends ({savedSet.size})
            </button>
            <button
              type="button"
              onClick={() => setFilter('online')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === 'online'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Live Now ({onlineUserIds.length})
            </button>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      {filteredUsers.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0b0b0e] border border-red-950/60 text-center space-y-2">
          <Users className="w-8 h-8 text-red-500/60 mx-auto" />
          <div className="text-sm font-semibold text-white">No matching users found</div>
          <p className="text-xs text-zinc-500">
            Try clearing your search or switching the filter tab above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => {
            const isMe = u._id === currentUser._id;
            const resolved = resolveUserName(u._id);
            const isOnline = onlineUserIds.includes(u._id);

            return (
              <div
                key={u._id}
                className="p-5 rounded-2xl bg-[#0b0b0e] border border-red-900/40 hover:border-red-600/60 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <UserAvatar
                    src={u.dp}
                    name={resolved.primaryName}
                    size="lg"
                    isOnline={isOnline}
                    showOnlineStatus
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display text-base font-bold text-white truncate">
                        {resolved.primaryName}
                      </h3>
                      {isMe && (
                        <span className="text-xs font-mono text-red-400">(You)</span>
                      )}
                      {resolved.isPrivateSaved && (
                        <Lock
                          className="w-3.5 h-3.5 text-red-400 shrink-0"
                          title="Private saved friend name (visible only to you)"
                        />
                      )}
                    </div>

                    <div className="text-xs text-zinc-400 font-mono truncate mt-0.5">
                      @{u.username}
                      {resolved.isPrivateSaved && ` · Public: ${u.displayName}`}
                    </div>

                    <p className="text-xs text-zinc-300 mt-2 line-clamp-2">
                      {u.bio || 'OPAI Red & Black Member'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-900 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-mono tabular-nums text-zinc-500">
                    {isOnline ? 'Online now' : 'Registered Member'}
                  </div>

                  {!isMe && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSaveContact(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151216] hover:bg-red-950/50 border border-red-900/50 text-xs font-medium text-red-300 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>
                          {resolved.isPrivateSaved ? 'Edit Private Name' : 'Save Friend'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onStartChat(u._id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors shadow-[0_0_12px_rgba(220,38,38,0.35)] whitespace-nowrap shrink-0"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Live Chat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
