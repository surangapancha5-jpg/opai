import React, { useState, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  Image as ImageIcon,
  Trash2,
  X,
  Lock,
} from 'lucide-react';
import { User, Post } from '../types';
import { UserAvatar } from './UserAvatar';
import { compressImageFile } from '../utils/imageUtils';

interface PostsViewProps {
  currentUser: User;
  posts: Post[];
  token: string;
  onPostCreated: (post: Post) => void;
  onPostUpdated: (post: Post) => void;
  onPostDeleted: (postId: string) => void;
  resolveUserName: (userId: string) => {
    primaryName: string;
    username: string;
    isPrivateSaved: boolean;
    dp: string;
    userObj?: User;
  };
}

export const PostsView: React.FC<PostsViewProps> = ({
  currentUser,
  posts,
  token,
  onPostCreated,
  onPostUpdated,
  onPostDeleted,
  resolveUserName,
}) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !image) || publishing) return;
    setPublishing(true);
    setError('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: content.trim(), image }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        onPostCreated(data.post);
        setContent('');
        setImage('');
      } else {
        setError(data.error || 'Could not publish post.');
      }
    } catch {
      setError('Network error while publishing post.');
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.post) {
        onPostUpdated(data.post);
      }
    } catch {
      // Ignore network error
    }
  };

  const handleAddComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const commentText = (commentInputs[postId] || '').trim();
    if (!commentText || submittingCommentId === postId) return;

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
        onPostUpdated(data.post);
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      }
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.post) {
        onPostUpdated(data.post);
      }
    } catch {
      // Ignore
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onPostDeleted(postId);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Create Post Composer */}
      <form
        onSubmit={handlePublishPost}
        className="p-6 rounded-2xl bg-[#0b0b0e] border border-red-900/50 space-y-4 opai-rgb-border"
      >
        <div className="flex items-start gap-3.5">
          <UserAvatar
            src={currentUser.dp}
            name={currentUser.displayName || currentUser.username}
            size="md"
          />
          <div className="flex-1">
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Share an update with the OPAI community, ${currentUser.displayName}...`}
              className="w-full p-3.5 rounded-xl bg-[#121217] border border-zinc-800 focus:border-red-500 focus:outline-none text-sm text-white placeholder-zinc-500 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-600/50 text-xs text-red-200">
            {error}
          </div>
        )}

        {image && (
          <div className="relative inline-block">
            <img
              src={image}
              alt="Post upload preview"
              className="max-h-60 rounded-xl object-cover border border-red-900/50"
            />
            <button
              type="button"
              onClick={() => setImage('')}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/80 text-zinc-300 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#141419] hover:bg-red-950/40 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-red-300 transition-colors whitespace-nowrap shrink-0"
            >
              <ImageIcon className="w-4 h-4 text-red-500" />
              <span>Attach Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const dataUrl = await compressImageFile(file, 800, 800, 0.84);
                  setImage(dataUrl);
                }
              }}
              className="hidden"
            />
          </div>

          <button
            type="submit"
            disabled={publishing || (!content.trim() && !image)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-[0_0_18px_rgba(220,38,38,0.4)] whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{publishing ? 'Publishing...' : 'Publish Post'}</span>
          </button>
        </div>
      </form>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0b0b0e] border border-red-950/60 text-center space-y-2">
          <MessageCircle className="w-8 h-8 text-red-500/60 mx-auto" />
          <div className="text-sm font-semibold text-white">No posts yet</div>
          <p className="text-xs text-zinc-500">
            Be the first to publish a post above. Every user in OPAI Chat can comment on posts.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => {
            const author = resolveUserName(post.authorId);
            const isMyPost = post.authorId === currentUser._id;
            const isLiked = post.likes.includes(currentUser._id);

            return (
              <article
                key={post._id}
                className="p-6 rounded-2xl bg-[#0b0b0e] border border-red-900/40 space-y-4"
              >
                {/* Post Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      src={author.dp}
                      name={author.primaryName}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-sm font-bold text-white truncate">
                          {author.primaryName}
                        </span>
                        {author.isPrivateSaved && (
                          <Lock
                            className="w-3 h-3 text-red-400 shrink-0"
                            title="Private saved friend name (visible only to you)"
                          />
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono tabular-nums">
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
                      title="Delete your post"
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Post Body */}
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
                  {post.content}
                </p>

                {post.image && (
                  <img
                    src={post.image}
                    alt="Post media"
                    referrerPolicy="no-referrer"
                    className="w-full max-h-96 object-cover rounded-xl border border-red-950/60"
                  />
                )}

                {/* Like & Comment Counts Bar */}
                <div className="flex items-center gap-6 pt-2 border-t border-zinc-900 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(post._id)}
                    className={`inline-flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isLiked ? 'text-red-500' : 'text-zinc-400 hover:text-red-400'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`}
                    />
                    <span className="font-mono tabular-nums">{post.likes.length} Likes</span>
                  </button>

                  <div className="inline-flex items-center gap-1.5 text-zinc-400 font-mono tabular-nums">
                    <MessageCircle className="w-4 h-4 text-red-400/80" />
                    <span>{post.comments.length} Comments</span>
                  </div>
                </div>

                {/* Comments List (Every User Can Comment) */}
                <div className="pt-3 border-t border-zinc-900/90 space-y-3">
                  {post.comments.length > 0 && (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {post.comments.map((c) => {
                        const cAuthor = resolveUserName(c.authorId);
                        const canDeleteComment =
                          c.authorId === currentUser._id || isMyPost;

                        return (
                          <div
                            key={c._id}
                            className="p-3 rounded-xl bg-[#111116] border border-zinc-800/80 flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <UserAvatar
                                src={cAuthor.dp}
                                name={cAuthor.primaryName}
                                size="xs"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="font-semibold text-white">
                                    {cAuthor.primaryName}
                                  </span>
                                  {cAuthor.isPrivateSaved && (
                                    <Lock className="w-2.5 h-2.5 text-red-400" />
                                  )}
                                  <span className="text-zinc-500 font-mono text-[10px] tabular-nums">
                                    @{cAuthor.username} ·{' '}
                                    {new Date(c.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-300 mt-1 break-words">
                                  {c.text}
                                </p>
                              </div>
                            </div>

                            {canDeleteComment && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(post._id, c._id)}
                                className="text-zinc-500 hover:text-red-400 p-1 shrink-0"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Comment Input */}
                  <form
                    onSubmit={(e) => handleAddComment(e, post._id)}
                    className="flex items-center gap-2"
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
                      className="flex-1 px-3.5 py-2 rounded-xl bg-[#131318] border border-zinc-800 focus:border-red-500 focus:outline-none text-xs text-white placeholder-zinc-500"
                    />
                    <button
                      type="submit"
                      disabled={
                        submittingCommentId === post._id ||
                        !(commentInputs[post._id] || '').trim()
                      }
                      className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      Comment
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
