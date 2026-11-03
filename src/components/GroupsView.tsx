import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Users,
  Shield,
  Crown,
  Trash2,
  UserPlus,
  UserMinus,
  Send,
  Image as ImageIcon,
  X,
  Lock,
  Settings,
} from 'lucide-react';
import { User, Group, GroupMessage } from '../types';
import { UserAvatar } from './UserAvatar';
import { compressImageFile } from '../utils/imageUtils';

interface GroupsViewProps {
  currentUser: User;
  allUsers: User[];
  groups: Group[];
  token: string;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onGroupUpdated: (group: Group) => void;
  resolveUserName: (userId: string) => {
    primaryName: string;
    username: string;
    isPrivateSaved: boolean;
    dp: string;
    userObj?: User;
  };
  incomingGroupMessage: GroupMessage | null;
  deletedGroupMessageInfo: { groupId: string; messageId: string } | null;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  currentUser,
  allUsers,
  groups,
  token,
  selectedGroupId,
  onSelectGroup,
  onGroupUpdated,
  resolveUserName,
  incomingGroupMessage,
  deletedGroupMessageInfo,
}) => {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState('');
  const [sending, setSending] = useState(false);
  const [showManagePanel, setShowManagePanel] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionError, setActionError] = useState('');

  // Create Group Modal state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupDp, setNewGroupDp] = useState('');
  const [selectedInitialMembers, setSelectedInitialMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupDpInputRef = useRef<HTMLInputElement>(null);

  const activeGroup = groups.find((g) => g._id === selectedGroupId) || null;

  // Fetch messages for selected group
  useEffect(() => {
    if (!selectedGroupId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setActionError('');
    fetch(`/api/groups/${selectedGroupId}/messages`, {
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
  }, [selectedGroupId, token]);

  // Live incoming group message via WebSocket
  useEffect(() => {
    if (!incomingGroupMessage) return;
    if (incomingGroupMessage.groupId === selectedGroupId) {
      setMessages((prev) => {
        if (prev.some((m) => m._id === incomingGroupMessage._id)) return prev;
        return [...prev, incomingGroupMessage];
      });
    }
  }, [incomingGroupMessage, selectedGroupId]);

  // Live deleted group message via WebSocket
  useEffect(() => {
    if (!deletedGroupMessageInfo) return;
    if (deletedGroupMessageInfo.groupId === selectedGroupId) {
      setMessages((prev) =>
        prev.filter((m) => m._id !== deletedGroupMessageInfo.messageId)
      );
    }
  }, [deletedGroupMessageInfo, selectedGroupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedGroupId]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    setActionError('');
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
        onGroupUpdated(data.group);
        onSelectGroup(data.group._id);
        setShowCreateModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setNewGroupDp('');
        setSelectedInitialMembers([]);
      } else {
        setActionError(data.error || 'Could not create group.');
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || (!text.trim() && !attachedImage) || sending) return;
    setSending(true);
    setActionError('');
    try {
      const res = await fetch(`/api/groups/${activeGroup._id}/messages`, {
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
        setMessages((prev) =>
          prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]
        );
      } else {
        setActionError(data.error || 'Failed to send message.');
      }
    } finally {
      setSending(false);
    }
  };

  // Delete message handler:
  // Owner & Admins can delete ANY message; Members can only delete their own message
  const handleDeleteGroupMessage = async (messageId: string) => {
    if (!activeGroup) return;
    setActionError('');
    try {
      const res = await fetch(
        `/api/groups/${activeGroup._id}/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      } else {
        setActionError(data.error || 'Cannot delete this message.');
      }
    } catch {
      setActionError('Network error while deleting message.');
    }
  };

  // Toggle Admin role (Only Owner can do this)
  const handleToggleAdmin = async (targetUserId: string, makeAdmin: boolean) => {
    if (!activeGroup) return;
    setActionError('');
    try {
      const res = await fetch(`/api/groups/${activeGroup._id}/admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId, makeAdmin }),
      });
      const data = await res.json();
      if (res.ok && data.group) {
        onGroupUpdated(data.group);
      } else {
        setActionError(data.error || 'Failed to update admin status.');
      }
    } catch {
      setActionError('Network error while updating role.');
    }
  };

  // Add Member to Group
  const handleAddMember = async (userId: string) => {
    if (!activeGroup) return;
    setActionError('');
    try {
      const res = await fetch(`/api/groups/${activeGroup._id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds: [userId] }),
      });
      const data = await res.json();
      if (res.ok && data.group) {
        onGroupUpdated(data.group);
      } else {
        setActionError(data.error || 'Could not add user to group.');
      }
    } catch {
      setActionError('Network error while adding user.');
    }
  };

  // Remove Member from Group (Owner can NEVER be removed)
  const handleRemoveMember = async (targetUserId: string) => {
    if (!activeGroup) return;
    setActionError('');
    try {
      const res = await fetch(
        `/api/groups/${activeGroup._id}/members/${targetUserId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok && data.group) {
        onGroupUpdated(data.group);
      } else {
        setActionError(data.error || 'Could not remove member.');
      }
    } catch {
      setActionError('Network error while removing member.');
    }
  };

  const myId = currentUser._id;
  const isMyGroupOwner = activeGroup ? activeGroup.ownerId === myId : false;
  const isMyGroupAdmin = activeGroup
    ? isMyGroupOwner || activeGroup.admins.includes(myId)
    : false;

  const nonMemberUsers = activeGroup
    ? allUsers.filter((u) => !activeGroup.members.includes(u._id))
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-5.5rem)] min-h-[580px]">
      {/* Left Sidebar: Groups List & Create Group Button */}
      <aside className="lg:col-span-3 bg-[#0b0b0e] border border-red-900/45 rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-red-950/60 bg-[#0f080a] flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-white">Groups</h2>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors shadow-[0_0_12px_rgba(220,38,38,0.4)] whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Group</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/80">
          {groups.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Users className="w-8 h-8 text-red-500/60 mx-auto" />
              <div className="text-sm font-medium text-zinc-300">No groups yet</div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Create a group to become the permanent Group Owner, add friends, and appoint Admins.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                Create First Group
              </button>
            </div>
          ) : (
            groups.map((g) => {
              const isSelected = g._id === selectedGroupId;
              const amOwner = g.ownerId === myId;
              const amAdmin = g.admins.includes(myId);

              return (
                <div
                  key={g._id}
                  onClick={() => onSelectGroup(g._id)}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-red-950/35 border border-red-600/50'
                      : 'hover:bg-[#121217]'
                  }`}
                >
                  <UserAvatar src={g.dp} name={g.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {g.name}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-zinc-400 shrink-0">
                        {g.members.length} members
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 truncate mt-0.5">
                      {amOwner
                        ? 'Your Role: Owner'
                        : amAdmin
                        ? 'Your Role: Admin'
                        : 'Your Role: Member'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Center + Right: Group Live Chat & Role Management */}
      <section className="lg:col-span-9 bg-[#0b0b0e] border border-red-900/45 rounded-2xl flex flex-col overflow-hidden">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-800/50 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-2">
              OPAI Group Hierarchy & Live Rooms
            </h3>
            <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
              Select a group on the left or create a new group. Group creators are permanent Owners
              who cannot be removed, can promote Admins, and moderate all messages.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors shadow-[0_0_20px_rgba(220,38,38,0.4)] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Group</span>
            </button>
          </div>
        ) : (
          <>
            {/* Group Header */}
            <div className="px-6 py-4 border-b border-red-950/60 bg-[#0f080a] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <UserAvatar src={activeGroup.dp} name={activeGroup.name} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold text-white truncate">
                      {activeGroup.name}
                    </h3>
                    <span className="text-xs text-red-400 font-mono tabular-nums">
                      · {activeGroup.members.length} members
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">
                    {activeGroup.description ||
                      'Owner & Admins can moderate all messages · Members can delete their own messages'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManagePanel((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  showManagePanel
                    ? 'bg-red-600 text-white border-red-500'
                    : 'bg-[#15151b] text-zinc-300 border-zinc-800 hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Members & Roles</span>
              </button>
            </div>

            {actionError && (
              <div className="px-6 py-2.5 bg-red-950/70 border-b border-red-600/50 text-xs text-red-200 flex items-center justify-between">
                <span>{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError('')}
                  className="text-red-300 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex-1 flex overflow-hidden">
              {/* Group Chat Messages Column */}
              <div className="flex-1 flex flex-col overflow-hidden bg-[#08080b]">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {loadingMessages ? (
                    <div className="text-center py-12 text-xs text-zinc-500 font-mono">
                      Loading group messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-16 space-y-2">
                      <div className="text-sm font-medium text-zinc-300">
                        No messages in {activeGroup.name} yet
                      </div>
                      <p className="text-xs text-zinc-500">
                        Send the first message to start the live group discussion.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.senderId === myId;
                      const senderResolved = resolveUserName(msg.senderId);
                      const isSenderOwner = msg.senderId === activeGroup.ownerId;
                      const isSenderAdmin = activeGroup.admins.includes(msg.senderId);

                      // CRITICAL RULE:
                      // Owner and Admins can delete ANY member's message.
                      // Regular members can ONLY delete their OWN message.
                      const canDeleteThisMessage = isMyGroupOwner || isMyGroupAdmin || isMine;

                      return (
                        <div
                          key={msg._id}
                          className={`flex items-end gap-2.5 ${
                            isMine ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isMine && (
                            <UserAvatar
                              src={senderResolved.dp}
                              name={senderResolved.primaryName}
                              size="xs"
                            />
                          )}

                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              isMine
                                ? 'bg-gradient-to-br from-red-600 to-red-800 text-white rounded-br-sm shadow-[0_2px_14px_rgba(220,38,38,0.25)]'
                                : 'bg-[#141419] border border-zinc-800/90 text-zinc-100 rounded-bl-sm'
                            }`}
                          >
                            {/* Sender header with role & private name indicator */}
                            <div className="flex items-center gap-1.5 text-[11px] mb-1">
                              <span
                                className={`font-semibold ${
                                  isMine ? 'text-red-100' : 'text-red-400'
                                }`}
                              >
                                {isMine ? 'You' : senderResolved.primaryName}
                              </span>
                              {!isMine && senderResolved.isPrivateSaved && (
                                <Lock
                                  className="w-2.5 h-2.5 text-red-400"
                                  title={`Private saved name (@${senderResolved.username})`}
                                />
                              )}
                              <span
                                className={
                                  isMine ? 'text-red-200/80' : 'text-zinc-500'
                                }
                              >
                                · {isSenderOwner ? 'Owner' : isSenderAdmin ? 'Admin' : 'Member'}
                              </span>
                            </div>

                            {msg.image && (
                              <img
                                src={msg.image}
                                alt="Group attachment"
                                referrerPolicy="no-referrer"
                                className="max-h-60 rounded-xl object-cover mb-2 border border-black/20"
                              />
                            )}

                            {msg.text && (
                              <p className="text-sm leading-relaxed break-words">
                                {msg.text}
                              </p>
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
                              {canDeleteThisMessage && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGroupMessage(msg._id)}
                                  title={
                                    isMine
                                      ? 'Delete your message'
                                      : 'Delete member message (Owner/Admin privilege)'
                                  }
                                  className="opacity-75 hover:opacity-100 text-current hover:text-red-300 transition-opacity inline-flex items-center gap-0.5"
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

                {/* Group Message Input */}
                <form
                  onSubmit={handleSendGroupMessage}
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
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const dataUrl = await compressImageFile(file, 720, 720, 0.82);
                          setAttachedImage(dataUrl);
                        }
                      }}
                      className="hidden"
                    />

                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={`Message ${activeGroup.name}...`}
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
              </div>

              {/* Group Members & Role Permissions Drawer */}
              {showManagePanel && (
                <div className="w-80 border-l border-red-950/60 bg-[#0c0c10] flex flex-col overflow-y-auto p-4 space-y-5">
                  <div>
                    <h4 className="font-display text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Group Members ({activeGroup.members.length})
                    </h4>
                    <div className="space-y-2">
                      {activeGroup.members.map((memberId) => {
                        const resolved = resolveUserName(memberId);
                        const isOwner = memberId === activeGroup.ownerId;
                        const isAdmin = activeGroup.admins.includes(memberId);

                        // Owner can promote/demote any non-owner member
                        const canToggleAdmin = isMyGroupOwner && !isOwner;
                        // Owner cannot be removed by ANYONE!
                        // Owner can remove any member; Admin can remove regular members.
                        const canRemoveMember =
                          !isOwner &&
                          (isMyGroupOwner || (isMyGroupAdmin && !isAdmin));

                        return (
                          <div
                            key={memberId}
                            className="p-2.5 rounded-xl bg-[#121217] border border-zinc-800/80 space-y-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                src={resolved.dp}
                                name={resolved.primaryName}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-semibold text-white truncate">
                                    {resolved.primaryName}
                                  </span>
                                  {resolved.isPrivateSaved && (
                                    <Lock className="w-3 h-3 text-red-400 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                                  <span>@{resolved.username}</span>
                                  <span>·</span>
                                  <span
                                    className={
                                      isOwner
                                        ? 'text-red-400 font-semibold'
                                        : isAdmin
                                        ? 'text-red-300 font-medium'
                                        : 'text-zinc-500'
                                    }
                                  >
                                    {isOwner
                                      ? 'Owner (Protected)'
                                      : isAdmin
                                      ? 'Admin'
                                      : 'Member'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {(canToggleAdmin || canRemoveMember) && (
                              <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/70">
                                {canToggleAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleAdmin(memberId, !isAdmin)}
                                    className="flex-1 py-1 px-2 rounded-lg bg-[#1a1215] hover:bg-red-950/60 border border-red-900/50 text-[11px] font-medium text-red-300 transition-colors whitespace-nowrap shrink-0"
                                  >
                                    {isAdmin ? 'Remove Admin' : 'Make Admin'}
                                  </button>
                                )}
                                {canRemoveMember && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMember(memberId)}
                                    className="py-1 px-2.5 rounded-lg bg-red-950/40 hover:bg-red-600 text-[11px] font-medium text-red-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
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
                  </div>

                  {/* Add Other Users to Group */}
                  <div className="pt-3 border-t border-zinc-900">
                    <h4 className="font-display text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Add Users to Group
                    </h4>
                    {nonMemberUsers.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        All registered users are already in this group.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {nonMemberUsers.map((u) => {
                          const resolved = resolveUserName(u._id);
                          return (
                            <div
                              key={u._id}
                              className="p-2 rounded-xl bg-[#121217] border border-zinc-800/70 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <UserAvatar
                                  src={u.dp}
                                  name={resolved.primaryName}
                                  size="xs"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-white truncate">
                                    {resolved.primaryName}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 font-mono truncate">
                                    @{u.username}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddMember(u._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-[11px] font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0b0b0e] border border-red-900/60 rounded-2xl overflow-hidden opai-rgb-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-red-950/60 bg-[#11080a]">
              <h2 className="font-display text-base font-bold text-white">
                Create New Group (You become Owner)
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
              <div className="flex items-center gap-3.5">
                <UserAvatar src={newGroupDp} name={newGroupName || 'GR'} size="lg" />
                <div>
                  <button
                    type="button"
                    onClick={() => groupDpInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-xs font-medium text-red-300 transition-colors whitespace-nowrap shrink-0"
                  >
                    Upload Group DP
                  </button>
                  <input
                    ref={groupDpInputRef}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const dataUrl = await compressImageFile(file, 360, 360, 0.85);
                        setNewGroupDp(dataUrl);
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Red & Black Squad"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#121216] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="What is this group about?"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#121216] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Add Initial Members ({selectedInitialMembers.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-[#111115] border border-zinc-800">
                  {allUsers.filter((u) => u._id !== myId).length === 0 ? (
                    <div className="text-xs text-zinc-500 py-2 text-center">
                      No other users yet — you can add members anytime after creating.
                    </div>
                  ) : (
                    allUsers
                      .filter((u) => u._id !== myId)
                      .map((u) => {
                        const resolved = resolveUserName(u._id);
                        const checked = selectedInitialMembers.includes(u._id);
                        return (
                          <label
                            key={u._id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                src={u.dp}
                                name={resolved.primaryName}
                                size="xs"
                              />
                              <span className="text-xs font-medium text-white">
                                {resolved.primaryName}
                              </span>
                              <span className="text-[11px] text-zinc-500 font-mono">
                                @{u.username}
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedInitialMembers((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== u._id)
                                    : [...prev, u._id]
                                );
                              }}
                              className="accent-red-600"
                            />
                          </label>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                >
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
