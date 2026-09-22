import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Share2, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VideoProps {
  id: string;
  title: string;
  description: string;
  video_url: string;
  user_name: string;
  views: number;
  likes: number;
}

export const LongVideoPlayer: React.FC<{ video: VideoProps }> = ({ video }) => {
  const [likes, setLikes] = useState(video.likes || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchComments();
  }, [video.id]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('video_id', video.id)
      .order('created_at', { ascending: false });
    if (data) setComments(data);
  };

  const handleLike = async () => {
    const updatedLikes = hasLiked ? likes - 1 : likes + 1;
    setLikes(updatedLikes);
    setHasLiked(!hasLiked);
    await supabase.from('videos').update({ likes: updatedLikes }).eq('id', video.id);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentObj = {
      video_id: video.id,
      text: newComment,
      user_name: 'User',
      created_at: new Date().toISOString(),
    };

    setComments([commentObj, ...comments]);
    setNewComment('');
    await supabase.from('comments').insert([commentObj]);
  };

  return (
    <div className="w-full flex flex-col gap-4 text-white p-4 max-w-6xl mx-auto">
      <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
        <video src={video.video_url} controls controlsList="nodownload" className="w-full h-full object-contain" />
      </div>

      <h1 className="text-xl md:text-2xl font-bold">{video.title}</h1>
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-500 to-purple-600 flex items-center justify-center font-bold text-lg">
            {video.user_name?.[0] || 'D'}
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-1">
              {video.user_name || 'Deeplay Creator'} <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </h3>
            <p className="text-xs text-gray-400">{video.views || 0} views</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 backdrop-blur-md hover:bg-gray-800 transition ${hasLiked ? 'text-red-500 border-red-500' : 'text-white'}`}
          >
            <ThumbsUp className="w-5 h-5" />
            <span>{likes}</span>
          </button>
          <button className="p-2 rounded-full border border-gray-700 hover:bg-gray-800 text-white transition">
            <ThumbsDown className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 hover:bg-gray-800 text-white transition">
            <Share2 className="w-5 h-5" /> Share
          </button>
        </div>
      </div>

      <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-800 text-sm text-gray-300">
        <p>{video.description || 'No description provided.'}</p>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-bold mb-4">{comments.length} Comments</h2>
        <form onSubmit={handleAddComment} className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-red-500"
          />
          <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl flex items-center gap-1 transition">
            <Send className="w-4 h-4" /> Post
          </button>
        </form>

        <div className="flex flex-col gap-4">
          {comments.map((c, i) => (
            <div key={i} className="flex gap-3 bg-gray-900/40 p-3 rounded-lg border border-gray-800/50">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-white">
                {c.user_name?.[0] || 'U'}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">{c.user_name || 'Anonymous User'}</p>
                <p className="text-sm text-white mt-1">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
