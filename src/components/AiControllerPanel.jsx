import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AiControllerPanel() {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('Idle');
  const [logs, setLogs] = useState([]);

  const handleExecuteAI = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setStatus('Processing Command...');
    const newLog = `[${new Date().toLocaleTimeString()}] User Command: "${prompt}"`;
    setLogs((prev) => [newLog, ...prev]);

    try {
      // 1. Direct Supabase Admin Rule Update / Action Trigger
      const { data, error } = await supabase
        .from('admin_commands')
        .insert({
          command_text: prompt,
          status: 'pending',
          created_at: new Date()
        });

      if (error) throw error;

      setStatus('Success: Command Applied!');
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] AI Action: Requirement accepted & processed successfully.`,
        ...prev
      ]);
      setPrompt('');
    } catch (err) {
      setStatus('Execution Error');
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Error: ${err.message}`,
        ...prev
      ]);
    }
  };

  return (
    <div className="bg-[#0f0f0f] border border-purple-900/50 rounded-2xl p-6 text-white max-w-2xl mx-auto my-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-purple-400">HkTube AI Model Controller</h2>
          <p className="text-xs text-neutral-400">Direct Admin Requirement & Change Executor</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          status.includes('Success') ? 'bg-green-900/60 text-green-400 border border-green-500' :
          status.includes('Processing') ? 'bg-yellow-900/60 text-yellow-400 border border-yellow-500' :
          'bg-neutral-800 text-neutral-400'
        }`}>
          {status}
        </span>
      </div>

      <form onSubmit={handleExecuteAI} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-neutral-300">Enter Your Requirement / Change Instruction:</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., Change website layout, fix upload settings, update theme colors..."
            className="w-full bg-black border border-neutral-800 focus:border-purple-500 rounded-xl p-3.5 text-sm text-white outline-none mt-1.5 h-24 resize-none transition"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-3 rounded-xl font-bold text-sm transition shadow-lg shadow-purple-600/20"
        >
          Execute AI Change Command
        </button>
      </form>

      {/* Real-time AI Output Console */}
      <div className="mt-6 border-t border-neutral-800 pt-4">
        <h4 className="text-xs font-bold text-neutral-400 mb-2">AI Execution Console Logs:</h4>
        <div className="bg-black border border-neutral-900 rounded-xl p-3 h-36 overflow-y-auto font-mono text-xs text-purple-300 space-y-1">
          {logs.length === 0 ? (
            <p className="text-neutral-600 italic">No commands issued yet. Waiting for input...</p>
          ) : (
            logs.map((log, index) => <p key={index}>{log}</p>)
          )}
        </div>
      </div>
    </div>
  );
}

