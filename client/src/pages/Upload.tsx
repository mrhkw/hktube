import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const UploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isShort, setIsShort] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) {
      setMessage({ type: 'error', text: 'Please select a video file and enter a title.' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: storageError } = await supabase.storage.from('videos').upload(fileName, file);
      if (storageError) throw storageError;

      const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('videos').insert([
        {
          title,
          description,
          video_url: publicUrlData.publicUrl,
          is_short: isShort,
          views: 0,
          likes: 0,
          created_at: new Date().toISOString(),
        },
      ]);

      if (dbError) throw dbError;

      setMessage({ type: 'success', text: 'Video published successfully on Deeplay!' });
      setTitle('');
      setDescription('');
      setFile(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-900 border border-gray-800 rounded-2xl text-white my-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <UploadCloud className="text-red-500" /> Upload Video
      </h2>

      {message && (
        <div className={`p-4 rounded-xl mb-4 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Select Video File</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input
            type="text"
            placeholder="Video title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea
            placeholder="Video description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm focus:outline-none h-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="shortToggle"
            checked={isShort}
            onChange={(e) => setIsShort(e.target.checked)}
            className="w-4 h-4 accent-red-500"
          />
          <label htmlFor="shortToggle" className="text-sm">Upload as Short Clip (TikTok Style)</label>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="bg-red-600 hover:bg-red-700 font-bold py-3 rounded-xl transition disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Publish Video'}
        </button>
      </form>
    </div>
  );
};
