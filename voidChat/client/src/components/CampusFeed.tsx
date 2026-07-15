import React, { useState } from 'react';
import { Post, Identity } from '../types';

interface CampusFeedProps {
  posts: Post[];
  identity: Identity | null;
  addPost: (content: string, imageFile?: File | null, pollOptions?: string[] | null) => Promise<void>;
  votePost: (postId: string, delta: number) => Promise<void>;
  reactPost: (postId: string, type: string) => Promise<void>;
  votePoll: (postId: string, optionIdx: number) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<any>;
}

export function CampusFeed({ posts, identity, addPost, votePost, reactPost, votePoll, addComment }: CampusFeedProps) {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  // Poll state
  const [showPollEditor, setShowPollEditor] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Thread expansion
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !imageFile) return;
    
    const validPollOptions = pollOptions.filter(o => o.trim() !== '');
    const optionsPayload = showPollEditor && validPollOptions.length >= 2 ? validPollOptions : null;

    await addPost(content, imageFile, optionsPayload);
    setContent('');
    setImageFile(null);
    setShowPollEditor(false);
    setPollOptions(['', '']);
  };

  const handleExpandPost = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    try {
      const res = await fetch(`/api/feed/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(prev => ({ ...prev, [postId]: data }));
      }
    } catch {}
  };

  const handleCommentSubmit = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const commentText = newCommentText[postId] || '';
    if (!commentText.trim()) return;

    const newCmt = await addComment(postId, commentText);
    if (newCmt) {
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newCmt]
      }));
      setNewCommentText(prev => ({ ...prev, [postId]: '' }));
    }
  };

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h2 className="section-title">// CAMPUS FEED: HAUNTED CHRONICLES</h2>
        <p className="section-subtitle">Whisper your thoughts, create polls, or share visions. Everything remains anonymous.</p>
      </div>

      <form onSubmit={handlePostSubmit} className="creepy-form post-editor">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What dark thoughts possess you today?..."
          maxLength={300}
          className="creepy-input post-textarea"
          required={!imageFile}
        />
        
        {showPollEditor && (
          <div className="poll-editor-box">
            <label className="creepy-label">// MATERIALIZE POLL OPTIONS</label>
            {pollOptions.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                value={opt}
                onChange={(e) => {
                  const next = [...pollOptions];
                  next[idx] = e.target.value;
                  setPollOptions(next);
                }}
                placeholder={`Option ${idx + 1}...`}
                className="creepy-input poll-input"
              />
            ))}
            <button
              type="button"
              className="flat-btn border-blood small-btn"
              onClick={() => setPollOptions([...pollOptions, ''])}
              disabled={pollOptions.length >= 5}
            >
              + Add Choice
            </button>
          </div>
        )}

        <div className="editor-controls">
          <div className="file-input-wrapper">
            <button type="button" className="flat-btn border-fog small-btn">
              📷 {imageFile ? imageFile.name.slice(0, 15) : 'Add Image'}
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>

          <button
            type="button"
            className={`flat-btn border-fog small-btn ${showPollEditor ? 'active-border' : ''}`}
            onClick={() => setShowPollEditor(!showPollEditor)}
          >
            📊 Create Poll
          </button>

          <button type="submit" className="flat-btn blood-bg post-submit-btn">
            Whisper Post ☠
          </button>
        </div>
      </form>

      <div className="posts-list">
        {posts.length === 0 ? (
          <div className="empty-wall-message">
            <span className="empty-skull">💀</span>
            <p>The mist is quiet. No whispers have emerged yet.</p>
          </div>
        ) : (
          posts.map((post) => {
            const hasVotedPoll = !!(post.pollVotes && Object.values(post.pollVotes).some(v => v.includes(identity?.deviceId || '')));
            const totalPollVotes = post.pollVotes ? Object.values(post.pollVotes).reduce((sum, v) => sum + v.length, 0) : 0;

            return (
              <div key={post.id} className="post-card">
                <div className="post-card-header">
                  <span className="post-avatar">{post.authorAvatar}</span>
                  <div className="post-author-meta">
                    <span className="post-author-name">{post.authorName}</span>
                    <span className="post-timestamp">{new Date(post.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="post-content">
                  {post.imageUrl && (
                    <div className="post-image-container">
                      <img src={post.imageUrl} alt="Chronicle snippet" className="post-attached-image" />
                    </div>
                  )}
                  <p className="post-text">{post.content}</p>

                  {post.pollOptions && post.pollVotes && (
                    <div className="poll-display-box">
                      {post.pollOptions.map((opt, idx) => {
                        const votes = post.pollVotes?.[String(idx)] || [];
                        const userVoted = votes.includes(identity?.deviceId || '');
                        const pct = totalPollVotes > 0 ? Math.round((votes.length / totalPollVotes) * 100) : 0;

                        return (
                          <button
                            key={idx}
                            className={`poll-option-row ${userVoted ? 'voted' : ''}`}
                            onClick={() => votePoll(post.id, idx)}
                            disabled={hasVotedPoll}
                          >
                            <div className="poll-option-fill" style={{ width: `${pct}%` }} />
                            <span className="poll-option-text">{opt}</span>
                            <span className="poll-option-pct">{pct}% ({votes.length})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="post-actions-bar">
                  <div className="votes-bar">
                    <button className="vote-btn up" onClick={() => votePost(post.id, 1)}>▲</button>
                    <span className={`votes-count ${post.votes > 0 ? 'good' : post.votes < 0 ? 'bad' : ''}`}>
                      {post.votes}
                    </span>
                    <button className="vote-btn down" onClick={() => votePost(post.id, -1)}>▼</button>
                  </div>

                  <div className="reactions-wrap">
                    {['skull', 'blood', 'eye'].map((type) => {
                      const emojis: Record<string, string> = { skull: '💀', blood: '🩸', eye: '👁️' };
                      const reactList = post.reactions?.[type] || [];
                      const active = reactList.includes(identity?.deviceId || '');

                      return (
                        <button
                          key={type}
                          className={`reaction-badge ${active ? 'user-reacted' : ''}`}
                          onClick={() => reactPost(post.id, type)}
                        >
                          <span>{emojis[type]}</span>
                          <span className="react-count">{reactList.length}</span>
                        </button>
                      );
                    })}
                  </div>

                  <button className="flat-btn border-fog comment-toggle-btn" onClick={() => handleExpandPost(post.id)}>
                    💬 Threads ({comments[post.id]?.length || 0})
                  </button>
                </div>

                {expandedPostId === post.id && (
                  <div className="comment-thread-section">
                    <h3 className="thread-title">// DISCUSSION CHAIN</h3>
                    <div className="comments-list">
                      {(comments[post.id] || []).map((cmt) => (
                        <div key={cmt.id} className="comment-card">
                          <div className="comment-header">
                            <span className="cmt-avatar">{cmt.authorAvatar}</span>
                            <span className="cmt-author-name">{cmt.authorName}</span>
                            <span className="cmt-time">{new Date(cmt.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="cmt-text">{cmt.content}</p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={(e) => handleCommentSubmit(post.id, e)} className="creepy-form comment-editor">
                      <input
                        type="text"
                        value={newCommentText[post.id] || ''}
                        onChange={(e) => setNewCommentText({ ...newCommentText, [post.id]: e.target.value })}
                        placeholder="Add your echo to this thread..."
                        className="creepy-input comment-input"
                        required
                      />
                      <button type="submit" className="flat-btn border-blood comment-submit">
                        Echo ☠
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
