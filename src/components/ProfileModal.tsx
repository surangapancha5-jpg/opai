import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Check, KeyRound, LogIn, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { compressImageFile, PRESET_RED_BLACK_AVATARS } from '../utils/imageUtils';
import { UserAvatar } from './UserAvatar';

interface ProfileDrawerProps {
  currentUser: User;
  token: string;
  onClose: () => void;
  onUpdated: (updatedUser: User) => void;
  onSwitchedAccount: (newToken: string, user: User) => void;
}

export const ProfileModal: React.FC<ProfileDrawerProps> = ({
  currentUser,
  token,
  onClose,
  onUpdated,
  onSwitchedAccount,
}) => {
  const [displayName, setDisplayName] = useState(currentUser.displayName || currentUser.username);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio || 'Hey there! I am using OPAI Chat.');
  const [dp, setDp] = useState(currentUser.dp || '');
  const [optionalPassword, setOptionalPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Optional Switch Account section
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [switching, setSwitching] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 360, 360, 0.85);
      setDp(dataUrl);
      setError('');
    } catch {
      setError('Failed to process image.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          displayName,
          bio,
          dp,
          password: optionalPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update profile.');
      } else {
        onUpdated(data.user);
        setOptionalPassword('');
        setMessage('Profile saved to MongoDB!');
      }
    } catch {
      setError('Network error while saving profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim()) return;
    setSwitching(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not switch account.');
      } else {
        onSwitchedAccount(data.token, data.user);
        onClose();
      }
    } catch {
      setError('Network error.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0b0f] text-[#f5f5f7] overflow-y-auto">
      {/* WhatsApp Drawer Header */}
      <div className="h-16 px-4 bg-[#12080b] border-b border-red-950/70 flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-red-950/50 text-zinc-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-display text-base font-bold text-white">Profile & Account</h2>
      </div>

      <div className="p-5 space-y-6 flex-1 overflow-y-auto">
        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-600/60 text-xs text-red-200">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 text-xs text-red-200">
            {message}
          </div>
        )}

        {/* WhatsApp Centered Circular DP Picker */}
        <div className="flex flex-col items-center gap-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative group cursor-pointer"
          >
            <UserAvatar src={dp} name={displayName || username} size="xl" />
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
              <Camera className="w-6 h-6 text-red-400 mb-1" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white">
                Change DP
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            {PRESET_RED_BLACK_AVATARS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDp(preset.dataUri)}
                title={preset.label}
                className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-transform ${
                  dp === preset.dataUri
                    ? 'border-red-500 scale-110'
                    : 'border-zinc-800 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={preset.dataUri} alt={preset.label} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#111116] border border-red-950/50 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-red-400 mb-1">
                Your Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="w-full px-3 py-2 rounded-lg bg-[#0b0b0e] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-red-400 mb-1">
                About / Status
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Hey there! I am using OPAI Chat."
                className="w-full px-3 py-2 rounded-lg bg-[#0b0b0e] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white"
              />
            </div>
          </div>

          {/* Optional Username & Password Section */}
          <div className="p-3.5 rounded-xl bg-[#111116] border border-red-950/50 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <KeyRound className="w-3.5 h-3.5 text-red-500" />
              <span>Username & Password (Optional)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Set your own custom username and password only if you want to save or access this
              account later.
            </p>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0b0e] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Set / Change Password (Optional)
              </label>
              <input
                type="password"
                value={optionalPassword}
                onChange={(e) => setOptionalPassword(e.target.value)}
                placeholder="Leave blank if you don't want a password"
                className="w-full px-3 py-2 rounded-lg bg-[#0b0b0e] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-[0_0_16px_rgba(220,38,38,0.4)] whitespace-nowrap shrink-0"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>

        {/* Optional: Switch to another existing username/password account */}
        <div className="pt-4 border-t border-zinc-900">
          <button
            type="button"
            onClick={() => setShowSwitchAccount((v) => !v)}
            className="w-full py-2 px-3 rounded-xl bg-[#14141a] hover:bg-red-950/30 border border-zinc-800 text-xs font-medium text-zinc-300 flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5 text-red-400" />
            <span>
              {showSwitchAccount ? 'Hide Account Switcher' : 'Have an existing account? Sign In'}
            </span>
          </button>

          {showSwitchAccount && (
            <form
              onSubmit={handleSwitchAccount}
              className="mt-3 p-3.5 rounded-xl bg-[#111116] border border-red-950/50 space-y-3"
            >
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Existing Username
                </label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter your saved username"
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0b0e] border border-zinc-800 focus:border-red-500 focus:outline-none text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Password (if set)
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0b0e] border border-zinc-800 focus:border-red-500 focus:outline-none text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={switching}
                className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                {switching ? 'Switching...' : 'Switch to Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
