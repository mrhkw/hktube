import React, { useState } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('Signals');

  return (
    <div style={{ backgroundColor: '#0A0D12', color: '#F0F4F8', minHeight: '100vh', paddingBottom: '100px', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10, 13, 18, 0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, fontSize: '1.25rem', textDecoration: 'none', color: '#F0F4F8' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #CCFF00, #00F0FF)', clipPath: 'polygon(25% 0%, 100% 50%, 25% 100%, 0% 75%, 0% 25%)', boxShadow: '0 0 15px rgba(204, 255, 0, 0.25)' }}></div>
          <span>HkTube<span style={{ color: '#CCFF00' }}>.</span></span>
        </a>
        <button onClick={() => alert('Studio Creator Ready!')} style={{ background: '#CCFF00', color: '#000', fontWeight: 700, padding: '8px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer' }}>+ Create</button>
      </nav>

      {/* Main Container */}
      <div style={{ maxWidth: '600px', margin: '20px auto', padding: '0 16px' }}>
        {/* Spotlight Card */}
        <div style={{ background: 'rgba(22, 28, 36, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ height: '180px', background: '#111722', borderRadius: '16px', backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent), url(https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80)', backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
          <div style={{ marginTop: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '4px' }}>Rhythm Live - Ambient Beats</h3>
            <p style={{ fontSize: '0.8rem', color: '#8E9BAE' }}>@musjinmenan • 175K subscribers</p>
          </div>
        </div>

        {/* Signal Compass Hub */}
        <div style={{ background: 'rgba(18, 24, 34, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '16px', marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8E9BAE', marginBottom: '12px', fontWeight: 700 }}>Signal Compass Hub</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', overflowX: 'auto' }}>
            {['Signals', 'Fields', 'Notes', 'Reels'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: activeTab === tab ? '#CCFF00' : 'rgba(255,255,255,0.04)', color: activeTab === tab ? '#000' : '#8E9BAE', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Puzzle Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(22, 28, 36, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '120px 1fr' }}>
            <div style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=300&q=80)', backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Chasing the last light</div>
                <div style={{ fontSize: '0.75rem', color: '#8E9BAE' }}>@musjinmenan</div>
              </div>
              <span style={{ color: '#CCFF00', fontSize: '0.7rem', fontWeight: 700 }}>WATCH</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(18, 24, 34, 0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '40px', padding: '8px 20px', display: 'flex', gap: '24px', zIndex: 90 }}>
        <a href="#" style={{ color: '#CCFF00', textDecoration: 'none', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span>🏠</span><span>Home</span></a>
        <a href="#" style={{ color: '#8E9BAE', textDecoration: 'none', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span>⚡</span><span>Reels</span></a>
        <a href="#" style={{ color: '#8E9BAE', textDecoration: 'none', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span>👥</span><span>Subs</span></a>
        <a href="#" style={{ color: '#8E9BAE', textDecoration: 'none', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span>👤</span><span>You</span></a>
      </div>
    </div>
  );
            }
          
