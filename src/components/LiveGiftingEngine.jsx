import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export default function LiveGiftingEngine({ streamId, user }) {
  const [activeAnimation, setActiveAnimation] = useState(null);

  const sendGift = async (giftName, giftCost) => {
    setActiveAnimation(giftName);
    setTimeout(() => setActiveAnimation(null), 3000);

    await supabase.from('live_gifts').insert({
      stream_id: streamId,
      sender_name: user?.username || 'Anonymous',
      gift_name: giftName,
      cost: giftCost,
      created_at: new Date()
    });
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {activeAnimation && (
          <motion.div 
            initial={{ scale: 0, y: 50, opacity: 0 }}
            animate={{ scale: 1.2, y: -100, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 rounded-full text-white font-bold shadow-2xl z-50 pointer-events-none"
          >
            🎁 Sent a {activeAnimation}! ✨
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-neutral-800">
        <button onClick={() => sendGift('Rose', 10)} className="hover:scale-110 transition bg-neutral-900 p-2 rounded-xl text-xl">🌹</button>
        <button onClick={() => sendGift('Crown', 50)} className="hover:scale-110 transition bg-neutral-900 p-2 rounded-xl text-xl">👑</button>
        <button onClick={() => sendGift('Lion', 100)} className="hover:scale-110 transition bg-neutral-900 p-2 rounded-xl text-xl">🦁</button>
        <button onClick={() => sendGift('Galaxy', 500)} className="hover:scale-110 transition bg-neutral-900 p-2 rounded-xl text-xl">🌌</button>
      </div>
    </div>
  );
}
