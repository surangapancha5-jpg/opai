import React, { useState, useRef } from 'react';
import { Camera, Lock, User as UserIcon, Sparkles, ArrowRight, Upload } from 'lucide-react';
import { User } from '../types';
import { compressImageFile, PRESET_RED_BLACK_AVATARS } from '../utils/imageUtils';
import { UserAvatar } from './UserAvatar';

interface AuthViewProps {
  onSuccess: (token: string, user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [dp, setDp] = useState(PRESET_RED_BLACK_AVATARS[0].dataUri);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 360, 360, 0.85);
      setDp(compressed);
      setError('');
    } catch {
      setError('Could not process the selected image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { username, password }
          : {
              username,
              displayName: displayName.trim() || username.trim(),
              password,
              dp,
              bio: bio.trim() || 'OPAI Red & Black Member',
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
      } else {
        onSuccess(data.token, data.user);
      }
    } catch {
      setError('Network error while connecting to OPAI server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#f5f5f7] flex flex-col justify-between relative overflow-hidden">
      {/* Top animated Red & Black RGB hairline strip */}
      <div className="h-1 w-full opai-rgb-strip" />

      {/* Subtle ambient crimson glow in background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[320px] bg-red-600/12 blur-[130px] rounded-full" />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-10 relative z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-[#0b0b0e] border border-red-900/45 rounded-2xl overflow-hidden opai-rgb-border">
          {/* Left Hero / Brand Panel */}
          <div className="lg:col-span-5 p-8 bg-gradient-to-b from-[#160608] via-[#0c0708] to-[#08080a] border-b lg:border-b-0 lg:border-r border-red-950/60 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono tracking-widest text-red-400 mb-3">
                OPAI REAL-TIME NETWORK
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
                OPAI Chat
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Connect live with real friends, build role-controlled groups, save private contact
                names visible only to you, and share community posts.
              </p>

              <div className="space-y-4 pt-2 border-t border-red-950/60 text-xs text-zinc-300">
                <div>
                  <div className="font-semibold text-red-400 mb-0.5">Live Friend & Group Chat</div>
                  <p className="text-zinc-400">
                    Instant WebSocket messaging backed directly by MongoDB.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-red-400 mb-0.5">
                    Private Friend Nicknames
                  </div>
                  <p className="text-zinc-400">
                    Save any user with a custom name that only you can see across the entire app.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-red-400 mb-0.5">
                    Group Owner & Admin Hierarchy
                  </div>
                  <p className="text-zinc-400">
                    Group creators are permanent Owners who can appoint Admins and moderate group
                    messages.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-8 text-xs text-zinc-500 font-mono">
              100% Real Users · MongoDB Atlas Sync
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-7 p-8 bg-[#0b0b0e]">
            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-[#121216] border border-red-950/60 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'login'
                    ? 'bg-red-600 text-white shadow-[0_0_14px_rgba(220,38,38,0.45)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'register'
                    ? 'bg-red-600 text-white shadow-[0_0_14px_rgba(220,38,38,0.45)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-red-950/50 border border-red-600/60 text-xs text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="p-4 rounded-xl bg-[#101014] border border-red-950/60">
                  <label className="block text-xs font-medium text-zinc-300 mb-3">
                    Profile Picture (DP)
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <UserAvatar src={dp} name={displayName || username || 'OP'} size="lg" />
                    <div className="flex-1 min-w-[180px] space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-xs font-medium text-red-300 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload Photo
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-zinc-500 mr-1">Or preset:</span>
                        {PRESET_RED_BLACK_AVATARS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setDp(preset.dataUri)}
                            title={preset.label}
                            className={`w-7 h-7 rounded-lg overflow-hidden border transition-transform ${
                              dp === preset.dataUri
                                ? 'border-red-500 scale-105'
                                : 'border-zinc-800 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={preset.dataUri}
                              alt={preset.label}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. kavindu_lk"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121216] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-600"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How your public profile name appears"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121216] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (min 4 chars)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121216] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-600"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Short Bio (Optional)
                  </label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Red & Black OPAI enthusiast..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121216] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-600"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(220,38,38,0.4)] cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>
                  {loading
                    ? 'Connecting...'
                    : mode === 'login'
                    ? 'Enter OPAI Chat'
                    : 'Create Account & Join'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
