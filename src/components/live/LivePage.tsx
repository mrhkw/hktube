import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, Camera, Check, Crown, Gift, Headphones, Heart, Laptop, Lock,
  MessageCircle, Mic, MicOff, MonitorPlay, MoreHorizontal, Pause, Play,
  Plus, Radio, Send, Settings, Sparkles, Star, ToggleLeft, ToggleRight,
  Users, VideoOff, X, Zap,
} from 'lucide-react'
import {
  PREMIUM_CURRENCY,
  PREMIUM_MONTHLY_PRICE,
  activatePremiumFromWebhook,
  hasPremiumLiveStatus,
  isPayFastConfigured,
  isPayFastTestMode,
  startPayFastCheckout,
} from '../../lib/payfast'
import { createLiveStream, updateLiveStream } from '../../lib/supabase'

type LivePageProps = { userId: string; userEmail?: string }
type LiveTab = 'control' | 'analytics' | 'monetization'

type ChatMessage = { id: number; name: string; level: number; text: string; vip?: boolean }
type Gift = { id: number; name: string; icon: string; coins: number; color: string }

const gifts: Gift[] = [
  { id: 1, name: 'Rose', icon: '🌹', coins: 1, color: '#ff5f8f' },
  { id: 2, name: 'Treasure Chest', icon: '🪙', coins: 99, color: '#f4b63d' },
  { id: 3, name: 'Lion', icon: '🦁', coins: 499, color: '#f78c45' },
  { id: 4, name: 'Galaxy', icon: '🌌', coins: 999, color: '#9a7cff' },
]

const initialChat: ChatMessage[] = [
  { id: 1, name: 'Ayesha K.', level: 24, text: 'This setup looks amazing!', vip: true },
  { id: 2, name: 'HamzaLive', level: 12, text: 'Welcome everyone to the stream' },
  { id: 3, name: 'Sana Malik', level: 31, text: 'Can you show the new camera angle?' },
]

export default function LivePage({ userId, userEmail }: LivePageProps) {
  const [isPremium, setIsPremium] = useState(() => hasPremiumLiveStatus(userId))
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [isLive, setIsLive] = useState(false)
  const [liveStreamId, setLiveStreamId] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [guestMode, setGuestMode] = useState(false)
  const [subscriberChat, setSubscriberChat] = useState(false)
  const [virtualBackground, setVirtualBackground] = useState(false)
  const [activeTab, setActiveTab] = useState<LiveTab>('control')
  const [viewerCount, setViewerCount] = useState(248)
  const [coins, setCoins] = useState(18420)
  const [goalOne, setGoalOne] = useState(68)
  const [goalTwo, setGoalTwo] = useState(42)
  const [chat, setChat] = useState(initialChat)
  const [chatText, setChatText] = useState('')
  const [giftAlert, setGiftAlert] = useState<Gift | null>(null)
  const [selectedGift, setSelectedGift] = useState<Gift>(gifts[0])
  const [pollOpen, setPollOpen] = useState(false)
  const [pollVotes, setPollVotes] = useState([62, 38])
  const [clipSaved, setClipSaved] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const onActivated = () => setIsPremium(true)
    window.addEventListener('hktube:premium-activated', onActivated)
    return () => window.removeEventListener('hktube:premium-activated', onActivated)
  }, [])

  useEffect(() => {
    if (!isLive) return
    const timer = window.setInterval(() => {
      setViewerCount(value => value + (Math.random() > 0.55 ? 1 : -1))
    }, 4500)
    return () => window.clearInterval(timer)
  }, [isLive])

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), [])

  const previewStyle = useMemo(() => ({ filter: virtualBackground ? 'saturate(1.15) contrast(1.08)' : 'none' }), [virtualBackground])

  const openLive = async () => {
    if (!isPremium) {
      setCheckoutMessage('')
      setShowPremiumModal(true)
      return
    }
    const { data } = await createLiveStream({
      user_id: userId,
      status: 'live',
      started_at: new Date().toISOString(),
    })
    setLiveStreamId((data as { id?: string } | null)?.id ?? null)
    setIsLive(true)
  }

  const endLive = async () => {
    if (liveStreamId) {
      await updateLiveStream(liveStreamId, {
        status: 'ended',
        ended_at: new Date().toISOString(),
        viewer_count: viewerCount,
      })
    }
    setLiveStreamId(null)
    setIsLive(false)
  }

  const startCameraPreview = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      streamRef.current?.getTracks().forEach(track => track.stop())
      const stream = await navigator.mediaDevices.getUserMedia({ video: cameraOn, audio: micOn })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setCameraOn(false)
      setMicOn(false)
    }
  }

  const toggleCamera = () => {
    setCameraOn(value => {
      const next = !value
      streamRef.current?.getVideoTracks().forEach(track => { track.enabled = next })
      return next
    })
  }

  const toggleMic = () => {
    setMicOn(value => {
      const next = !value
      streamRef.current?.getAudioTracks().forEach(track => { track.enabled = next })
      return next
    })
  }

  const handleCheckout = async () => {
    setCheckoutLoading(true)
    setCheckoutMessage('Opening secure PayFast checkout…')
    try {
      if (isPayFastConfigured()) {
        const response = await startPayFastCheckout(userId, userEmail)
        if (response.status === 'success' && (isPayFastTestMode() || response.transactionId?.startsWith('PF-TEST-'))) {
          activatePremiumFromWebhook(userId, { status: 'success', transaction_id: response.transactionId })
          setCheckoutMessage(response.message || 'Sandbox payment simulated successfully.')
          setShowPremiumModal(false)
        } else if (response.redirectUrl) window.location.assign(response.redirectUrl)
        else setCheckoutMessage(response.message || 'Checkout created. Complete payment to activate Live.')
      } else {
        setCheckoutMessage('PayFast is not configured yet. Add the server-side credentials and checkout endpoint, then try again.')
      }
    } catch {
      setCheckoutMessage('Unable to reach the payment service. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const simulateWebhookConfirmation = () => {
    activatePremiumFromWebhook(userId, { status: 'success', transaction_id: `PF-${Date.now()}` })
    setShowPremiumModal(false)
  }

  const sendChat = () => {
    const text = chatText.trim()
    if (!text) return
    setChat(messages => [...messages.slice(-4), { id: Date.now(), name: 'You', level: 18, text, vip: true }])
    setChatText('')
  }

  const sendGift = () => {
    setCoins(value => value + selectedGift.coins)
    setGiftAlert(selectedGift)
    window.setTimeout(() => setGiftAlert(null), 2600)
  }

  const vote = (index: number) => {
    setPollVotes(values => values.map((value, itemIndex) => itemIndex === index ? value + 1 : value))
  }

  return (
    <section className="live-page live-mobile-stage">
      <div className="live-page-header">
        <div>
          <div className="live-kicker"><span className="live-wave-mark"><i /><i /><i /><i /></span> HKTUBE LIVE</div>
          <h1>Go Live</h1>
          <p>Build your community in real time with creator tools, gifts, and interactive sessions.</p>
        </div>
        <div className="live-header-actions">
          <span className="coin-balance"><Sparkles size={15} /> {coins.toLocaleString()} coins</span>
          <button className={isLive ? 'live-stop-button' : 'live-primary-button'} onClick={isLive ? endLive : openLive}>
            {isLive ? <><Pause size={16} /> End stream</> : <><Radio size={16} /> Launch stream</>}
          </button>
        </div>
      </div>

      <div className="live-status-strip">
        <span className="live-status-dot" /> {isLive ? 'You are live now' : 'Ready to broadcast'}
        <span className="status-divider" /> <Users size={15} /> {viewerCount} estimated viewers
        <span className="status-divider" /> <Crown size={15} /> {isPremium ? 'Premium creator' : 'Premium required to launch'}
      </div>

      <div className="live-tabs">
        {([['control', 'Control panel', MonitorPlay], ['analytics', 'Setup & analytics', BarChart3], ['monetization', 'Monetization options', Gift]] as const).map(([id, label, Icon]) => (
          <button key={id} className={activeTab === id ? 'live-tab active' : 'live-tab'} onClick={() => setActiveTab(id)}><Icon size={16} /> {label}</button>
        ))}
      </div>

      {activeTab === 'control' && <>
        <div className="live-workspace">
          <div className="live-preview-column">
            <div className={`live-preview ${virtualBackground ? 'virtual-background' : ''}`}>
              <video ref={videoRef} autoPlay muted playsInline style={previewStyle} />
              {!cameraOn && <div className="camera-off-state"><VideoOff size={36} /><span>Camera is off</span></div>}
              <div className="preview-label"><span className="preview-rec-dot" /> PREVIEW</div>
              {isLive && <div className="on-air-label"><Radio size={13} /> ON AIR</div>}
              <div className="preview-viewers"><Users size={14} /> {viewerCount}</div>
              <div className="live-overlay-topbar">
                <span className="live-overlay-status"><span className="preview-rec-dot" /> {isLive ? 'LIVE NOW' : 'PREVIEW'}</span>
                <span className="live-overlay-coins"><Sparkles size={14} /> {coins.toLocaleString()}</span>
              </div>
              <div className="live-overlay-chat-feed">
                {chat.slice(-3).map(message => <div className="live-overlay-chat-message" key={`overlay-${message.id}`}><span className="chat-avatar">{message.name.slice(0, 1)}</span><span><strong>{message.name}</strong> {message.text}</span></div>)}
              </div>
              <div className="live-overlay-bottom">
                <div className="live-overlay-controls">
                  <button className={cameraOn ? 'overlay-control active' : 'overlay-control'} onClick={toggleCamera} aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}>{cameraOn ? <Camera size={17} /> : <VideoOff size={17} />}</button>
                  <button className={micOn ? 'overlay-control active' : 'overlay-control'} onClick={toggleMic} aria-label={micOn ? 'Mute audio' : 'Unmute audio'}>{micOn ? <Mic size={17} /> : <MicOff size={17} />}</button>
                  <button className={guestMode ? 'overlay-control active' : 'overlay-control'} onClick={() => setGuestMode(value => !value)} aria-label="Invite guest"><Users size={17} /></button>
                  <button className={virtualBackground ? 'overlay-control active' : 'overlay-control'} onClick={() => setVirtualBackground(value => !value)} aria-label="Toggle background"><Laptop size={17} /></button>
                  <button className={isLive ? 'overlay-end-button' : 'overlay-go-button'} onClick={isLive ? endLive : openLive}>{isLive ? <Pause size={15} /> : <Radio size={15} />}{isLive ? 'End' : 'Go Live'}</button>
                </div>
                <div className="live-overlay-gifts">{gifts.map(gift => <button key={`overlay-gift-${gift.id}`} className={selectedGift.id === gift.id ? 'overlay-gift selected' : 'overlay-gift'} onClick={() => setSelectedGift(gift)} aria-label={`Select ${gift.name}`}>{gift.icon}</button>)}<button className="overlay-send-gift" onClick={sendGift}><Gift size={15} /> Send</button></div>
                <div className="live-overlay-chat-input"><input value={chatText} onChange={event => setChatText(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendChat()} placeholder="Say something…" /><button onClick={sendChat} aria-label="Send chat message"><Send size={15} /></button></div>
              </div>
              {giftAlert && <div className="gift-received-alert"><span className="gift-burst">{giftAlert.icon}</span><div><strong>GIFT RECEIVED!</strong><span>{giftAlert.name} · +{giftAlert.coins} coins</span></div></div>}
            </div>
            <div className="preview-controls">
              <button className={cameraOn ? 'preview-control active' : 'preview-control'} onClick={toggleCamera}>{cameraOn ? <Camera size={17} /> : <VideoOff size={17} />} Camera</button>
              <button className={micOn ? 'preview-control active' : 'preview-control'} onClick={toggleMic}>{micOn ? <Mic size={17} /> : <MicOff size={17} />} Audio</button>
              <button className={guestMode ? 'preview-control active' : 'preview-control'} onClick={() => setGuestMode(value => !value)}><Users size={17} /> {guestMode ? 'Guests on' : 'Invite guest'}</button>
              <button className={virtualBackground ? 'preview-control active' : 'preview-control'} onClick={() => setVirtualBackground(value => !value)}><Laptop size={17} /> Background</button>
              <button className="preview-control" onClick={startCameraPreview}><Play size={17} /> Test preview</button>
            </div>
          </div>

          <aside className="live-chat-panel">
            <div className="panel-heading"><div><strong>Live chat</strong><small>Community conversation</small></div><button aria-label="More chat options"><MoreHorizontal size={18} /></button></div>
            <div className="chat-mode"><Lock size={13} /> {subscriberChat ? 'Subscribers only' : 'Everyone can chat'} <button onClick={() => setSubscriberChat(value => !value)}>{subscriberChat ? <ToggleRight size={21} /> : <ToggleLeft size={21} />}</button></div>
            <div className="chat-feed">{chat.map(message => <div className="chat-message" key={message.id}><div className="chat-avatar">{message.name.slice(0, 1)}</div><div><div className="chat-name"><strong>{message.name}</strong><span className="level-badge">LVL {message.level}</span>{message.vip && <span className="vip-badge">VIP</span>}</div><p>{message.text}</p></div></div>)}</div>
            <div className="chat-input"><input value={chatText} onChange={event => setChatText(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendChat()} placeholder="Say something…" /><button onClick={sendChat} aria-label="Send message"><Send size={16} /></button></div>
          </aside>
        </div>

        <div className="live-tools-grid">
          <div className="live-card goals-card"><div className="card-title-row"><div><span className="eyebrow">STREAM GOALS</span><h2>Keep the momentum going</h2></div><button className="icon-button"><Settings size={17} /></button></div><Goal label="Goal 1 · Community likes" value={goalOne} detail="680 / 1,000 likes" /><Goal label="Goal 2 · Gift milestone" value={goalTwo} detail="4,200 / 10,000 coins" /><div className="goal-actions"><button onClick={() => { setGoalOne(value => Math.min(value + 4, 100)); setGoalTwo(value => Math.min(value + 3, 100)) }}><Plus size={14} /> Add goal</button><span>Goals update live during your broadcast</span></div></div>
          <div className="live-card gifts-card"><div className="card-title-row"><div><span className="eyebrow">INTERACTIVE GIFTS</span><h2>Send a little love</h2></div><span className="gift-wallet"><Sparkles size={14} /> {coins.toLocaleString()}</span></div><div className="gift-grid">{gifts.map(gift => <button key={gift.id} className={selectedGift.id === gift.id ? 'gift-option selected' : 'gift-option'} onClick={() => setSelectedGift(gift)}><span style={{ background: `${gift.color}20`, color: gift.color }}>{gift.icon}</span><strong>{gift.name}</strong><small>{gift.coins} coins</small></button>)}</div><button className="send-gift-button" onClick={sendGift}><Gift size={16} /> Send {selectedGift.name}</button></div>
          <div className="live-card poll-card"><div className="card-title-row"><div><span className="eyebrow">INTERACTION</span><h2>Live poll & Q&A</h2></div><button className="text-button" onClick={() => setPollOpen(value => !value)}>{pollOpen ? 'Close' : 'Start poll'}</button></div>{pollOpen ? <div className="poll-content"><strong>Which topic should we cover next?</strong>{['Creator setup tour', 'Editing shortcuts'].map((option, index) => <button className="poll-option" key={option} onClick={() => vote(index)}><span>{option}</span><span>{pollVotes[index]}%</span><i style={{ width: `${pollVotes[index]}%` }} /></button>)}<small>Audience votes update in real time</small></div> : <div className="empty-tool"><MessageCircle size={25} /><span>Ask your audience a question or start a poll from here.</span></div>}</div>
        </div>
      </>}

      {activeTab === 'analytics' && <AnalyticsPanel viewerCount={viewerCount} goalOne={goalOne} goalTwo={goalTwo} onClip={() => setClipSaved(true)} clipSaved={clipSaved} />}
      {activeTab === 'monetization' && <MonetizationPanel coins={coins} onWithdraw={() => setCheckoutMessage('Withdrawal review opened. Connect your payout details in Studio Settings.')} message={checkoutMessage} />}

      {showPremiumModal && <div className="premium-modal-backdrop" role="dialog" aria-modal="true"><div className="premium-modal"><button className="modal-close" onClick={() => setShowPremiumModal(false)} aria-label="Close"><X size={18} /></button><div className="premium-crown"><Crown size={26} /></div><span className="eyebrow">HKTUBE LIVE PREMIUM</span><h2>Unlock your creator stage</h2><p>Launch streams, invite guests, receive gifts, and turn your community into an income stream.</p><div className="premium-price"><strong>{PREMIUM_CURRENCY} {PREMIUM_MONTHLY_PRICE}</strong><span>/ month</span></div><div className="premium-features"><span><Check size={15} /> Go Live & creator controls</span><span><Check size={15} /> Gifts, coins, polls, and Q&A</span><span><Check size={15} /> Withdraw eligible creator earnings</span></div><button className="payfast-button" onClick={handleCheckout} disabled={checkoutLoading}><Lock size={15} /> {checkoutLoading ? 'Connecting to PayFast…' : 'Continue with PayFast'}</button><small className="payment-methods">JazzCash · EasyPaisa · Debit/Credit Cards · Bank Transfer</small>{checkoutMessage && <div className="checkout-message">{checkoutMessage}</div>}{!isPayFastConfigured() && <button className="demo-confirm-button" onClick={simulateWebhookConfirmation}>Simulate successful webhook for local testing</button>}</div></div>}
    </section>
  )
}

function Goal({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="goal-item"><div className="goal-label"><span>{label}</span><strong>{value}%</strong></div><div className="goal-track"><i style={{ width: `${value}%` }} /></div><small>{detail}</small></div>
}

function AnalyticsPanel({ viewerCount, goalOne, goalTwo, onClip, clipSaved }: { viewerCount: number; goalOne: number; goalTwo: number; onClip: () => void; clipSaved: boolean }) {
  return <div className="analytics-view"><div className="analytics-hero"><div><span className="eyebrow">REAL-TIME SNAPSHOT</span><h2>Your room is building momentum.</h2><p>Use the signals below to adjust your stream while the conversation is happening.</p></div><div className="analytics-big-number"><Users size={18} /><strong>{viewerCount}</strong><span>viewers now</span></div></div><div className="analytics-stat-grid"><Stat icon={<Heart size={18} />} label="Engagement rate" value="82.4%" trend="+12.8%" /><Stat icon={<Gift size={18} />} label="Coins this stream" value="18,420" trend="+2,140" /><Stat icon={<Headphones size={18} />} label="Guest minutes" value="24m" trend="2 guests" /><Stat icon={<Star size={18} />} label="New subscribers" value="146" trend="+18 today" /></div><div className="analytics-lower"><div className="live-card"><div className="card-title-row"><div><span className="eyebrow">GOAL PERFORMANCE</span><h2>Audience response</h2></div></div><div className="bar-chart"><i style={{ height: '40%' }} /><i style={{ height: '62%' }} /><i style={{ height: '50%' }} /><i style={{ height: '78%' }} /><i style={{ height: '68%' }} /><i style={{ height: '92%' }} /><i style={{ height: '84%' }} /><i style={{ height: `${Math.max(goalOne, goalTwo)}%` }} /></div><div className="chart-labels"><span>Start</span><span>Now</span></div></div><div className="live-card clip-card"><span className="eyebrow">STREAM CLIPS</span><h2>Capture your best moments</h2><p>Save a highlight when the chat spikes, then share it with your followers.</p><button className="live-secondary-button" onClick={onClip}>{clipSaved ? <><Check size={16} /> Highlight saved</> : <><Zap size={16} /> Create highlight</>}</button></div></div></div>
}

function Stat({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string; trend: string }) {
  return <div className="analytics-stat"><span>{icon}</span><small>{label}</small><strong>{value}</strong><em>{trend}</em></div>
}

function MonetizationPanel({ coins, onWithdraw, message }: { coins: number; onWithdraw: () => void; message: string }) {
  return <div className="monetization-view"><div className="analytics-hero monetization-hero"><div><span className="eyebrow">CREATOR EARNINGS</span><h2>Turn interaction into momentum.</h2><p>Received coins are tracked to your creator balance. Withdrawals can be requested after payout details and eligibility are verified.</p></div><div className="earnings-total"><small>Available balance</small><strong>PKR {(coins * 0.25).toLocaleString()}</strong><span>{coins.toLocaleString()} coins</span></div></div><div className="monetization-grid"><div className="live-card"><span className="eyebrow">GIFT CATALOG</span><h2>Make every moment interactive</h2>{gifts.map(gift => <div className="catalog-row" key={gift.id}><span className="catalog-icon" style={{ color: gift.color }}>{gift.icon}</span><div><strong>{gift.name}</strong><small>Creator receives {gift.coins} coins</small></div><span className="catalog-total">{gift.coins} coins</span></div>)}</div><div className="live-card"><span className="eyebrow">PAYOUTS</span><h2>Withdrawals</h2><p className="muted-copy">Connect your payout account in Studio Settings to withdraw available earnings securely.</p><button className="live-primary-button" onClick={onWithdraw}><Sparkles size={16} /> Open withdrawal setup</button>{message && <div className="checkout-message">{message}</div>}</div></div></div>
}
