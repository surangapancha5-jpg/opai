import React, { useState } from 'react';
import { X, Lock, UserCheck, Trash2 } from 'lucide-react';
import { User } from '../types';
import { UserAvatar } from './UserAvatar';

interface SaveContactModalProps {
  targetUser: User;
  existingCustomName: string;
  token: string;
  onClose: () => void;
  onSaved: (updatedSelf: User) => void;
}

export const SaveContactModal: React.FC<SaveContactModalProps> = ({
  targetUser,
  existingCustomName,
  token,
  onClose,
  onSaved,
}) => {
  const [customName, setCustomName] = useState(
    existingCustomName || targetUser.displayName || targetUser.username
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          friendId: targetUser._id,
          customName: customName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save friend contact.');
      } else {
        onSaved(data.user);
        onClose();
      }
    } catch {
      setError('Network error while saving private contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/contacts/${targetUser._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data.user);
        onClose();
      } else {
        setError(data.error || 'Failed to remove contact.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0b0b0e] border border-red-900/60 rounded-2xl overflow-hidden opai-rgb-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-950/60 bg-[#11080a]">
          <h2 className="font-display text-base font-bold text-white">
            Save Friend (Private Name)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-red-950/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-600/60 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#111115] border border-zinc-800/80">
            <UserAvatar src={targetUser.dp} name={targetUser.displayName || targetUser.username} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">
                {targetUser.displayName}
              </div>
              <div className="text-xs text-zinc-400 font-mono truncate">
                @{targetUser.username}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Private Saved Name (Visible Only to You)
            </label>
            <input
              type="text"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Enter custom nickname for your friend..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#121216] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-600"
            />
            <div className="flex items-center gap-1.5 mt-2 text-xs text-red-300/90">
              <Lock className="w-3.5 h-3.5 shrink-0 text-red-500" />
              <span>
                This saved name is 100% private. Only you will see this name across chats, groups, and posts.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-900">
            {existingCustomName ? (
              <button
                type="button"
                disabled={saving}
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-950/40 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Saved Friend</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Private Name'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
