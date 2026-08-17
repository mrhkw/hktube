import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ChannelEditModal({ user, onClose, onUpdate }) {
  const [channelName, setChannelName] = useState(user?.channel_name || '');
  const [description, setDescription] = useState(user?.description || '');
  const [category, setCategory] = useState(user?.category || 'Gaming');
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = await supabase
      .from('channels')
      .upsert({
        user_id: user.id,
        channel_name: channelName,
        description: description,
        category: category,
        updated_at: new Date()
      }, { onConflict: 'user_id' });

    setLoading(false);
    if (error) {
      alert("Save Error: " + error.message);
    } else {
      alert("Channel saved successfully!");
      onUpdate(data);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-neutral-800 rounded-2xl p-6 w-full max-w-md text-white">
        <h2 className="text-xl font-bold mb-4">Edit Channel Profile</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400">Channel Name</label>
            <input 
              type="text" 
              value={channelName} 
              onChange={(e) => setChannelName(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white mt-1"
              required 
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400">Category</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white mt-1"
            >
              <option value="Gaming">Gaming</option>
              <option value="Animation">Animation</option>
              <option value="Tech">Tech</option>
              <option value="Vlogs">Vlogs</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400">About / Description</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white mt-1 h-24"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-neutral-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg font-bold">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
