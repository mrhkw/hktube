import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

export default function HkTubeModularStudio() {
  const [activeNode, setActiveNode] = useState('metadata');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    verifySession();
  }, []);

  const verifySession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      setAuthError(true);
    } else {
      setAuthError(false);
    }
  };

  const handleSessionRefresh = async () => {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) {
      setAuthError(false);
      alert("Session successfully re-authenticated!");
    } else {
      alert("Please log in again.");
    }
  };

  const handleSecureUpload = async (e) => {
    e.preventDefault();
    setUploading(true);

    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session) {
      setAuthError(true);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('videos').insert({
      title,
      description,
      user_id: session.user.id,
      created_at: new Date()
    });

    setUploading(false);
    if (dbError) {
      alert("Upload Error: " + dbError.message);
    } else {
      alert("Content Published Successfully via HkTube Engine!");
      setTitle('');
      setDescription('');
    }
  };

  if (authError) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen p-6 text-white flex items-center justify-center">
        <div className="bg-neutral-900 border border-red-500/50 p-8 rounded-[2rem] text-center max-w-md space-y-4">
          <h3 className="text-red-400 font-bold text-xl">Session Expired</h3>
          <p className="text-sm text-neutral-400">Authentication token needs a refresh to secure creator uploads.</p>
          <button onClick={handleSessionRefresh} className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-xl font-bold transition">
            Refresh Secure Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-screen p-6 text-white">
      {/* Proprietary Header */}
      <div className="mb-8 border-l-4 border-purple-500 pl-4">
        <h1 className="text-3xl font-black tracking-tighter">HKTUBE ENGINE</h1>
        <p className="text-purple-400 text-sm italic">Core Creator Operations & Secure Node</p>
      </div>

      {/* Floating Control Bubbles */}
      <div className="flex gap-4 mb-8">
        {['metadata', 'analytics', 'monetization'].map((node) => (
          <button 
            key={node}
            onClick={() => setActiveNode(node)}
            className={`px-6 py-2 rounded-full border transition ${activeNode === node ? 'bg-purple-600 border-purple-400 shadow-lg shadow-purple-600/20' : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500'}`}
          >
            {node.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Modular Content Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          layout
          className="bg-neutral-900/50 p-6 rounded-[2rem] border border-neutral-800"
        >
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 
            Secure Upload Node
          </h3>
          <form onSubmit={handleSecureUpload} className="space-y-4">
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project Title Identifier" 
              className="w-full bg-black p-4 rounded-xl border border-neutral-700 focus:border-purple-500 outline-none transition text-sm"
              required 
            />
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Content description..." 
              className="w-full bg-black p-4 rounded-xl border border-neutral-700 focus:border-purple-500 outline-none transition text-sm h-24 resize-none"
            />
            <button 
              type="submit" 
              disabled={uploading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-3.5 rounded-xl font-bold transition shadow-lg shadow-purple-600/20 text-sm"
            >
              {uploading ? 'Processing Secure Upload...' : 'Deploy to HkTube Network'}
            </button>
          </form>
        </motion.div>

        <motion.div 
          layout
          className="bg-neutral-900/50 p-6 rounded-[2rem] border border-neutral-800"
        >
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Advanced Creator Stats
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black p-4 rounded-2xl text-center border border-neutral-800">
              <p className="text-neutral-500 text-xs">Reach</p>
              <h4 className="text-2xl font-black mt-1">1.2M</h4>
            </div>
            <div className="bg-black p-4 rounded-2xl text-center border border-neutral-800">
              <p className="text-neutral-500 text-xs">Engagement</p>
              <h4 className="text-2xl font-black mt-1">94%</h4>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

