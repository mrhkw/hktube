// @ts-nocheck
// ╔═══════════════════════════════════════════════════════════╗
// ║   HkTube — App UI v4  |  YouTube-style · No Zoom        ║
// ║   Nav: Home · Shorts · ➕ · Feeds · Menu                 ║
// ║   Themes: Dark · AMOLED · Light  |  Streaming Removed  ║
// ╚═══════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { formatDate, formatDuration, formatViews } from "@/lib/video";
import { useLocation } from "wouter";
import {
  Home, Play, Search, Bell, Plus, Users, Heart,
  MessageCircle, Share2, Bookmark, MoreVertical,
  MoreHorizontal, Eye, X, Moon, Sun, Zap, User,
  Video, ChevronRight, Check, Volume2, VolumeX,
  BarChart2, LogOut, Upload, Award, DollarSign,
  HelpCircle, ImageOff, Rss, ChevronLeft, AlertTriangle,
  Info, Menu, Settings, Shield, TrendingUp,
  Clock, Flame, FileText, Download
} from "lucide-react";

// ─────────────────────────────────────────
// 🎨  THEMES
// ─────────────────────────────────────────
const T = {
  dark: {
    id:"dark", name:"HkTube Dark",
    bg:"#0F0F0F", surf:"#0F0F0F", card:"#0F0F0F",
    elev:"#1A1A1A", hover:"#272727", input:"#121212",
    pri:"#7B5EFF", priDim:"rgba(123,94,255,0.14)", priGlow:"rgba(123,94,255,0.30)",
    sec:"#FF4C93", secDim:"rgba(255,76,147,0.14)",
    gold:"#FFB800", goldDim:"rgba(255,184,0,0.14)",
    t1:"#F1F1F1", t2:"#AAAAAA", t3:"#717171",
    bdr:"#272727", bdrH:"rgba(123,94,255,0.5)",
    ok:"#00C980", okD:"rgba(0,201,128,0.14)",
    warn:"#FFA000", warnD:"rgba(255,160,0,0.14)",
    live:"#FF0000", liveD:"rgba(255,0,0,0.14)",
  },
  amoled: {
    id:"amoled", name:"AMOLED Dark",
    bg:"#000000", surf:"#000000", card:"#000000",
    elev:"#0D0D0D", hover:"#1A1A1A", input:"#080808",
    pri:"#8866FF", priDim:"rgba(136,102,255,0.14)", priGlow:"rgba(136,102,255,0.30)",
    sec:"#FF55AA", secDim:"rgba(255,85,170,0.14)",
    gold:"#FFAA00", goldDim:"rgba(255,170,0,0.14)",
    t1:"#FFFFFF", t2:"#AAAAAA", t3:"#606060",
    bdr:"#1A1A1A", bdrH:"rgba(136,102,255,0.5)",
    ok:"#00BB77", okD:"rgba(0,187,119,0.14)",
    warn:"#FF9900", warnD:"rgba(255,153,0,0.14)",
    live:"#FF0000", liveD:"rgba(255,0,0,0.14)",
  },
  light: {
    id:"light", name:"HkTube Light",
    bg:"#FFFFFF", surf:"#FFFFFF", card:"#FFFFFF",
    elev:"#F2F2F2", hover:"#E5E5E5", input:"#F8F8F8",
    pri:"#5B3FCE", priDim:"rgba(91,63,206,0.1)", priGlow:"rgba(91,63,206,0.25)",
    sec:"#CC2E6E", secDim:"rgba(204,46,110,0.1)",
    gold:"#AA7700", goldDim:"rgba(170,119,0,0.1)",
    t1:"#0F0F0F", t2:"#606060", t3:"#909090",
    bdr:"#E5E5E5", bdrH:"rgba(91,63,206,0.4)",
    ok:"#007050", okD:"rgba(0,112,80,0.1)",
    warn:"#8A5A00", warnD:"rgba(138,90,0,0.1)",
    live:"#CC0000", liveD:"rgba(204,0,0,0.1)",
  }
};

// ─────────────────────────────────────────
// 📊  DISPLAY DATA  (UI demo — real app uses Supabase)
// ─────────────────────────────────────────
const BADGE = {
  blue:"#3EA6FF", gold:"#FFB800", purple:"#AA44FF",
  cyan:"#00CCFF", platinum:"#B0B0C0"
};
const CATS = ["All","Trending","Gaming","Music","Sports","Education","Technology","Following","Posts"];
const SETTINGS_GROUPS = [
  {group:"Account & Identity",items:[
    {id:"account",icon:"👤",label:"Account",desc:"Username, email, phone"},
    {id:"security",icon:"🔐",label:"Security",desc:"Password, 2FA, sessions"},
    {id:"privacy",icon:"🔒",label:"Privacy",desc:"Who can see your content"},
    {id:"notifications",icon:"🔔",label:"Notifications",desc:"Alerts and updates"},
    {id:"account-center",icon:"🪪",label:"Account Center",desc:"Profile, sessions and connected accounts"},
    {id:"blocked",icon:"🚫",label:"Blocked Accounts",desc:"Manage blocked users"},
  ]},
  {group:"Preferences",items:[
    {id:"language",icon:"🌐",label:"Language & Region",desc:"App language"},
    {id:"theme",icon:"🎨",label:"Theme",desc:"System, Dark, Light, AMOLED"},
    {id:"playback",icon:"▶️",label:"Playback",desc:"Autoplay, quality, speed"},
    {id:"data",icon:"📶",label:"Data Usage",desc:"Mobile data controls"},
    {id:"captions",icon:"💬",label:"Captions",desc:"Subtitle settings"},
    {id:"audio",icon:"🔊",label:"Audio & Dubbing",desc:"Audio track preferences"},
    {id:"content",icon:"🎯",label:"Content Preferences",desc:"Customize your feed"},
    {id:"family",icon:"👨‍👩‍👧",label:"Family & Safety",desc:"Parental controls"},
    {id:"accessibility",icon:"♿",label:"Accessibility",desc:"Text, motion and display assistance"},
    {id:"appearance",icon:"🖼️",label:"Appearance",desc:"Light, Dark or System"},
  ]},
  {group:"Creator & Monetization",items:[
    {id:"payments",icon:"💳",label:"Payments",desc:"Payment methods"},
    {id:"creator",icon:"🎬",label:"Creator Settings",desc:"Channel settings"},
    {id:"monetization",icon:"💵",label:"Monetization",desc:"Revenue and payouts"},
    {id:"boost",icon:"⚡",label:"Boost & Promote",desc:"Promote content"},
    {id:"ai-settings",icon:"🤖",label:"AI Assistant",desc:"Personal AI settings"},
    {id:"dubbing",icon:"🗣️",label:"Dubbing & Audio Tracks",desc:"Viewer and creator audio preferences"},
    {id:"ads",icon:"📣",label:"Ads & Sponsored Content",desc:"Ad preferences and transparency"},
    {id:"payouts",icon:"🏦",label:"Payouts",desc:"Creator payout status"},
  ]},
  {group:"Support & Legal",items:[
    {id:"verification",icon:"✅",label:"Verification",desc:"Apply for a badge"},
    {id:"help",icon:"❓",label:"Help & Feedback",desc:"Get support"},
    {id:"reports",icon:"🚩",label:"My Reports",desc:"View your reports"},
    {id:"appeals",icon:"⚖️",label:"Appeals",desc:"Track your appeals"},
    {id:"data-export",icon:"📥",label:"Data Export",desc:"Download your data"},
    {id:"delete",icon:"🗑️",label:"Delete Account",desc:"Permanently delete",danger:true},
    {id:"terms",icon:"📜",label:"Terms & Policies",desc:"Privacy, community and payments policies"},
  ]},
];

// ─────────────────────────────────────────
// 🧩  ATOMS
// ─────────────────────────────────────────
function HkLogo({ size=32, text=true }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none",flexShrink:0}}>
      <svg width={size} height={size} viewBox="0 0 40 40">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7B5EFF"/>
            <stop offset="50%" stopColor="#CC40CC"/>
            <stop offset="100%" stopColor="#FF4C93"/>
          </linearGradient>
          <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF4C93"/>
            <stop offset="100%" stopColor="#7B5EFF"/>
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#g1)"/>
        <rect x="6" y="10" width="3" height="20" rx="1.5" fill="white"/>
        <rect x="6" y="18.5" width="9" height="3" rx="1.5" fill="white"/>
        <rect x="12" y="10" width="3" height="20" rx="1.5" fill="white"/>
        <rect x="19" y="10" width="3" height="20" rx="1.5" fill="white"/>
        <polygon points="22,20 31,10 34.5,10 25.5,20.5 34.5,30 31,30" fill="white"/>
        <circle cx="35" cy="8" r="4" fill="url(#g2)"/>
        <polygon points="33.5,6.5 37,8 33.5,9.5" fill="white"/>
      </svg>
      {text && (
        <span style={{
          fontSize:18, fontWeight:800, letterSpacing:"-0.5px",
          background:"linear-gradient(135deg,#7B5EFF,#FF4C93)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"
        }}>HkTube</span>
      )}
    </div>
  );
}

function VBadge({ type }) {
  if (!type || !BADGE[type]) return null;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      width:14, height:14, borderRadius:"50%",
      background:BADGE[type], marginLeft:4, flexShrink:0, verticalAlign:"middle"
    }}>
      <Check size={8} color="white" strokeWidth={3.5}/>
    </span>
  );
}

function Av({ char, size=32, seed=0 }) {
  const h=[250,290,320,200,160,340,220,270][seed%8];
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`linear-gradient(135deg,hsl(${h},65%,42%),hsl(${h+40},75%,58%))`,
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"white", fontWeight:800, fontSize:size*0.38
    }}>{char}</div>
  );
}

function Toggle({ on, onChange, t }) {
  return (
    <button type="button" aria-pressed={on} onClick={()=>onChange(!on)} style={{
      width:44, height:24, borderRadius:12, position:"relative",
      background:on?t.pri:t.elev,
      border:`1px solid ${on?t.pri:t.bdr}`,
      cursor:"pointer", transition:"background 0.2s, border-color 0.2s",
      flexShrink:0
    }}>
      <div style={{
        position:"absolute", top:2,
        left:on?20:2, width:18, height:18,
        borderRadius:"50%", background:"white",
        transition:"left 0.2s",
        boxShadow:"0 1px 3px rgba(0,0,0,0.3)"
      }}/>
    </button>
  );
}

// ─────────────────────────────────────────
// ─────────────────────────────────────────
// 🖼️  REAL THUMBNAIL (never fabricate media)
// ─────────────────────────────────────────
function Thumb({ src, dur, aspect="16/9", radius=0, t }) {
  return (
    <div style={{
      width:"100%", aspectRatio:aspect,
      background:t.elev, borderRadius:radius, overflow:"hidden",
      position:"relative", flexShrink:0
    }}>
      {src ? (
        <img src={src} alt="Video thumbnail" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
      ) : (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:7,color:t.t3}}>
          <ImageOff size={28} strokeWidth={1.5}/>
          <span style={{fontSize:11}}>No thumbnail available</span>
        </div>
      )}
      {dur && (
        <span style={{
          position:"absolute", bottom:7, right:7,
          background:"rgba(0,0,0,0.88)", color:"#fff",
          fontSize:12, fontWeight:600, padding:"1px 5px", borderRadius:3
        }}>{dur}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 🃏  VIDEO CARD (YouTube style — no zoom)
// ─────────────────────────────────────────
function VideoCard({ v, t, fullWidth=false }) {
  const [hov,setHov]=useState(false);
  const [,navigate]=useLocation();
  return (
    <div
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={()=>navigate(`/watch/${v.id}`)}
      onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();navigate(`/watch/${v.id}`);}}}
      role="link" tabIndex={0}
      style={{
        cursor:"pointer",
        background:hov?t.hover:t.card,
        transition:"background 0.15s",
        borderRadius: fullWidth?0:8,
        overflow:"hidden",
      }}
    >
      <Thumb src={v.thumbnailUrl} t={t} dur={v.dur} radius={fullWidth?0:6}/>
      <div style={{
        display:"flex", gap:10,
        padding: fullWidth?"12px 12px 8px":"10px 4px 8px"
      }}>
        <Av char={v.av} size={36} seed={v.id}/>
        <div style={{flex:1, minWidth:0}}>
          <p style={{
            color:t.t1, fontWeight:600, fontSize:14, margin:"0 0 4px",
            lineHeight:1.4,
            display:"-webkit-box", WebkitLineClamp:2,
            WebkitBoxOrient:"vertical", overflow:"hidden"
          }}>{v.title}</p>
          <div style={{display:"flex",alignItems:"center"}}>
            <span style={{color:t.t2,fontSize:13}}>{v.creator}</span>
            <VBadge type={v.badge}/>
          </div>
          <p style={{color:t.t3,fontSize:12,margin:"2px 0 0"}}>
            {v.views} views · {v.ago}
          </p>
        </div>
        <button style={{background:"none",border:"none",color:t.t3,cursor:"pointer",padding:"0 2px",alignSelf:"flex-start"}}>
          <MoreVertical size={16}/>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ─────────────────────────────────────────
// ▶️  SHORTS CARD (real thumbnail only)
// ─────────────────────────────────────────
function ShortCard({ s, t }) {
  const [hov,setHov]=useState(false);
  const [,navigate]=useLocation();
  return (
    <div
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={()=>navigate(`/watch/${s.id}`)}
      onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();navigate(`/watch/${s.id}`);}}}
      role="link" tabIndex={0}
      style={{
        width:140, flexShrink:0, cursor:"pointer",
        borderRadius:8, overflow:"hidden",
        background:hov?t.hover:t.card,
        transition:"background 0.15s"
      }}
    >
      <div style={{
        width:"100%", aspectRatio:"9/16",
        background:t.elev, position:"relative", borderRadius:8, overflow:"hidden"
      }}>
        {s.thumbnailUrl ? <img src={s.thumbnailUrl} alt="Short thumbnail" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} /> : (
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,color:t.t3}}>
            <ImageOff size={24} strokeWidth={1.5}/><span style={{fontSize:10}}>No thumbnail</span>
          </div>
        )}
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"30px 8px 8px",background:"linear-gradient(to top,rgba(0,0,0,0.85),transparent)"}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <Eye size={11} color="white"/><span style={{color:"white",fontSize:11,fontWeight:600}}>{s.likes}</span>
          </div>
        </div>
      </div>
      <div style={{padding:"8px 8px 10px"}}>
        <p style={{color:t.t1,fontSize:12,fontWeight:500,margin:0,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{s.title}</p>
        <p style={{color:t.t3,fontSize:11,margin:"3px 0 0"}}>{s.creator}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 📰  FEED POST (no zoom)
// ─────────────────────────────────────────
function FeedPost({ p, t }) {
  const [liked,setLiked]=useState(false);
  const [saved,setSaved]=useState(false);
  return (
    <div style={{borderBottom:`1px solid ${t.bdr}`, padding:"14px 0"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <Av char={p.av} size={40} seed={p.id+20}/>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center"}}>
            <span style={{color:t.t1,fontWeight:700,fontSize:14}}>{p.creator}</span>
            <VBadge type={p.badge}/>
          </div>
          <span style={{color:t.t3,fontSize:12}}>{p.ago} ago</span>
        </div>
        <button style={{background:"none",border:"none",color:t.t3,cursor:"pointer"}}>
          <MoreHorizontal size={18}/>
        </button>
      </div>
      <p style={{color:t.t1,fontSize:14,lineHeight:1.7,margin:"0 0 12px"}}>{p.text}</p>
      {p.imageUrl&&<img src={p.imageUrl} alt="Post media" loading="lazy" style={{width:"100%",aspectRatio:"16/9",objectFit:"cover",borderRadius:8,marginBottom:12,display:"block"}}/>}
      <div style={{display:"flex",gap:4}}>
        {[
          {icon:<Heart size={15} fill={liked?t.sec:"none"} color={liked?t.sec:t.t2}/>,label:liked?(p.likes+1).toLocaleString():p.likes.toLocaleString(),action:()=>setLiked(x=>!x),active:liked,col:t.sec,dim:t.secDim},
          {icon:<MessageCircle size={15}/>,label:p.comments,col:t.t2},
          {icon:<Share2 size={15}/>,label:"Share",col:t.t2},
          {icon:<Bookmark size={15} fill={saved?t.pri:"none"} color={saved?t.pri:t.t2}/>,action:()=>setSaved(x=>!x),active:saved,col:t.pri,dim:t.priDim},
        ].map((b,i)=>(
          <button key={i} onClick={b.action} style={{
            display:"flex",alignItems:"center",justifyContent:"center",gap:5,
            background:b.active?b.dim:"none",
            border:`1px solid ${b.active?b.col:t.bdr}`,
            color:b.active?b.col:t.t2,
            padding:"6px 14px",borderRadius:20,
            fontSize:12,fontWeight:500,cursor:"pointer",
            transition:"background 0.15s,border-color 0.15s,color 0.15s",
            flex:i<3?1:"none"
          }}>
            {b.icon}{b.label!==undefined&&<span>{b.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 🔝  HEADER
// ─────────────────────────────────────────
function Header({ t, setPage, setShowCreate, setShowNotif, setShowMenu, unread }) {
  const [q,setQ]=useState("");
  const [searching,setSearching]=useState(false);
  return (
    <header className="hk-header" style={{
      width:"100%",minWidth:0,position:"sticky", top:0, zIndex:200,
      background:t.surf, borderBottom:`1px solid ${t.bdr}`,
      padding:"0 16px", height:56,
      display:"flex", alignItems:"center", gap:10,
    }}>
      {!searching && <div onClick={()=>setPage("home")}><HkLogo size={30}/></div>}

      {/* Search */}
      <div style={{
        flex:1, display:"flex", alignItems:"center",
        background:t.input, border:`1px solid ${t.bdr}`,
        borderRadius:20, padding:"0 14px", height:36,
        maxWidth: searching?"100%":460,
        transition:"max-width 0.2s"
      }}>
        <Search size={15} color={t.t3}/>
        <input
          value={q} onChange={e=>setQ(e.target.value)}
          onFocus={()=>setSearching(true)}
          onBlur={()=>{if(!q)setSearching(false)}}
          placeholder="Search"
          style={{flex:1,background:"none",border:"none",outline:"none",color:t.t1,fontSize:14,marginLeft:8}}
        />
        {q && <button onClick={()=>{setQ("");setSearching(false)}} style={{background:"none",border:"none",color:t.t3,cursor:"pointer",padding:0}}><X size={14}/></button>}
      </div>

      {/* Actions */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto",flexShrink:0}}>
        <button onClick={()=>setShowCreate(true)} style={{
          display:"flex",alignItems:"center",gap:6,
          background:"none",
          border:`1px solid ${t.bdr}`,
          color:t.t1, padding:"6px 14px",
          borderRadius:20, fontSize:13, fontWeight:600,
          cursor:"pointer", whiteSpace:"nowrap",
          transition:"background 0.15s"
        }}
        onMouseEnter={e=>e.currentTarget.style.background=t.hover}
        onMouseLeave={e=>e.currentTarget.style.background="none"}
        >
          <Plus size={16} color={t.pri}/>
          <span className="hk-txt" style={{color:t.t1}}>Create</span>
        </button>

        <button onClick={()=>setShowNotif(true)} style={{
          background:"none", border:"none",
          color:t.t2, width:36, height:36, borderRadius:"50%",
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          position:"relative", transition:"background 0.15s"
        }}
        onMouseEnter={e=>e.currentTarget.style.background=t.hover}
        onMouseLeave={e=>e.currentTarget.style.background="none"}
        >
          <Bell size={20}/>
          {unread>0&&<span style={{
            position:"absolute", top:4, right:4,
            minWidth:16, height:16, borderRadius:8,
            background:"#FF0000", color:"white",
            fontSize:10, fontWeight:700,
            display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",
            border:`2px solid ${t.surf}`
          }}>{unread>9?"9+":unread}</span>}
        </button>

        <button onClick={()=>setShowMenu(true)} style={{
          background:"none", border:"none", cursor:"pointer",
          width:36, height:36, borderRadius:"50%",
          display:"flex", alignItems:"center", justifyContent:"center",
          overflow:"hidden", transition:"opacity 0.15s"
        }}>
          <Av char="U" size={34} seed={88}/>
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────
// 🗂️  SIDEBAR (Desktop ≥768px)
// ─────────────────────────────────────────
function Sidebar({ t, page, setPage }) {
  const nav=[
    {id:"home",   icon:"🏠", label:"Home"},
    {id:"shorts", icon:"▶️",  label:"Shorts"},
    {id:"feeds",  icon:"📰",  label:"Feeds"},
    null,
    {id:"trending", icon:"🔥", label:"Trending"},
    {id:"following",icon:"👥", label:"Following"},
    {id:"history",  icon:"🕐", label:"History"},
    {id:"saved",    icon:"🔖", label:"Saved"},
    null,
    {id:"studio",       icon:"🎬", label:"Creator Studio"},
    {id:"analytics",    icon:"📊", label:"Analytics"},
    {id:"monetization", icon:"💵", label:"Monetization"},
    null,
    {id:"settings",     icon:"⚙️", label:"Settings"},
  ];
  return (
    <aside className="hk-sidebar" style={{
      width:210, flexShrink:0,
      height:"calc(100vh - 56px)", position:"sticky", top:56,
      borderRight:`1px solid ${t.bdr}`, background:t.surf,
      padding:"8px 0", overflowY:"auto"
    }}>
      {nav.map((item,i)=>{
        if(!item) return <div key={i} style={{height:1,background:t.bdr,margin:"6px 12px"}}/>;
        const active=page===item.id;
        return (
          <button key={item.id} onClick={()=>setPage(item.id)} style={{
            display:"flex", alignItems:"center", gap:14,
            width:"100%", padding:"9px 20px", borderRadius:10,
            background:active?t.hover:"none", border:"none",
            color:active?t.t1:t.t2,
            fontSize:13.5, fontWeight:active?700:400,
            cursor:"pointer", transition:"background 0.1s",
            textAlign:"left"
          }}
          onMouseEnter={e=>{if(!active)e.currentTarget.style.background=t.hover}}
          onMouseLeave={e=>{if(!active)e.currentTarget.style.background="none"}}
          >
            <span style={{fontSize:17,lineHeight:1}}>{item.icon}</span>
            {item.label}
            {active && <div style={{marginLeft:"auto",width:3,height:20,borderRadius:2,background:t.pri}}/>}
          </button>
        );
      })}
    </aside>
  );
}

// ─────────────────────────────────────────
// 📱  BOTTOM NAV — Home · Shorts · ➕ · Feeds · Menu
// ─────────────────────────────────────────
function HomeGlyph({ color="currentColor", size=24 }) { return <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true"><path d="M3.5 13.5 14 4l10.5 9.5M6.5 11.3v11.2h15V11.3M11 22.5v-6h6v6" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 13.1 14 4l10 9.1v10.2a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 23.3V13.1Z" fill={color} opacity=".10"/></svg>; }
function ShortsGlyph({ color="currentColor", size=24 }) { return <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true"><path d="m9 5 10 5.2c1.6.8 1.6 3.1 0 3.9L9 19.3c-1.7.9-3.7-.3-3.7-2.2V7.2C5.3 5.3 7.3 4.1 9 5Z" fill={color} opacity=".12" stroke={color} strokeWidth="2"/><path d="m13 8.2 3.4 1.8M11 19.8l3.5-1.8" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>; }
function CreateGlyph({ color="white", size=38 }) { return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill={color} opacity=".14"/><circle cx="20" cy="20" r="13" fill="none" stroke={color} strokeWidth="1.8"/><path d="M20 12v16M12 20h16" stroke={color} strokeWidth="2.4" strokeLinecap="round"/></svg>; }
function FeedsGlyph({ color="currentColor", size=24 }) { return <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true"><rect x="4" y="5" width="20" height="18" rx="3" fill="none" stroke={color} strokeWidth="2"/><path d="M8 10h12M8 14h8M8 18h10" stroke={color} strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="18" r="2" fill={color}/></svg>; }
function MenuGlyph({ color="currentColor", size=24 }) { return <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="9" r="4" fill={color} opacity=".14" stroke={color} strokeWidth="2"/><path d="M6 23c.8-4 3.5-6 8-6s7.2 2 8 6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>; }

function BottomNav({ t, page, setPage, setShowMenu, setShowCreate }) {
  const items=[
    {id:"home",   icon:HomeGlyph,  label:"Home"},
    {id:"shorts", icon:ShortsGlyph,  label:"Shorts"},
    {id:"create", isPlus:true},
    {id:"feeds",  icon:FeedsGlyph,   label:"Feeds"},
    {id:"menu",   icon:MenuGlyph,  label:"Menu"},
  ];
  return (
    <nav className="hk-bottom-nav" style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:300,
      background:t.surf, borderTop:`1px solid ${t.bdr}`,
      display:"flex", alignItems:"center",
      padding:"4px 0 max(8px,env(safe-area-inset-bottom))",
    }}>
      {items.map(item=>{
        if(item.isPlus) return (
          <button key="create" onClick={()=>setShowCreate(true)} style={{
            flex:1, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            background:"none", border:"none", cursor:"pointer", padding:"2px 0"
          }}>
            <div style={{
              width:48, height:48, borderRadius:16,
              background:`linear-gradient(135deg,${t.pri},${t.sec})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:`0 4px 16px ${t.priGlow}`
            }}>
              <CreateGlyph size={42}/>
            </div>
          </button>
        );
        const active=page===item.id;
        const action=item.id==="menu"?()=>setShowMenu(true):()=>setPage(item.id);
        return (
          <button key={item.id} onClick={action} style={{
            flex:1, display:"flex", flexDirection:"column",
            alignItems:"center", gap:2,
            background:"none", border:"none",
            color:active?t.pri:t.t3,
            cursor:"pointer", padding:"4px 0", position:"relative",
            transition:"color 0.15s"
          }}>
            {(() => { const Icon = item.icon; return <Icon color={active?t.pri:t.t3} size={23}/>; })()}
            <span style={{fontSize:10,fontWeight:active?700:400}}>{item.label}</span>
            {active && <div style={{
              position:"absolute", bottom:0,
              width:24, height:2, borderRadius:2, background:t.pri
            }}/>}
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────
// 🏠  HOME PAGE
// ─────────────────────────────────────────
function SectionHd({ title, t, onMore }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",marginBottom:12}}>
      <h2 style={{color:t.t1,fontSize:16,fontWeight:700,margin:0}}>{title}</h2>
      {onMore&&<button onClick={onMore} style={{
        display:"flex",alignItems:"center",gap:2,background:"none",border:"none",
        color:t.t3,fontSize:12,fontWeight:500,cursor:"pointer"
      }}>See all<ChevronRight size={14}/></button>}
    </div>
  );
}

function CatChips({ t, setShowMenu }) {
  const [a,setA]=useState("All");
  return (
    <div style={{
      display:"flex", gap:8, overflowX:"auto",
      padding:"10px 16px", scrollbarWidth:"none",
      borderBottom:`1px solid ${t.bdr}`
    }}>
      {CATS.map(c=>(
        <button key={c} type="button" onClick={()=>setA(c)} style={{
          flexShrink:0, padding:"5px 14px", borderRadius:20,
          border:`1px solid ${a===c?t.pri:t.bdr}`,
          background:a===c?t.priDim:t.hover,
          color:a===c?t.pri:t.t2,
          fontSize:13, fontWeight:a===c?600:400,
          cursor:"pointer", transition:"all 0.15s", whiteSpace:"nowrap"
        }}>{c}</button>
      ))}
    </div>
  );
}

function FeaturedVideo({ t, video, setPage }) {
  if (!video) return null;
  return <section style={{padding:"16px 16px 0"}}>
    <div style={{position:"relative",overflow:"hidden",borderRadius:14,background:t.elev,border:`1px solid ${t.bdr}`}}>
      {video.videoUrl ? <video src={video.videoUrl} poster={video.thumbnailUrl||undefined} controls playsInline preload="metadata" style={{display:"block",width:"100%",aspectRatio:"16/9",objectFit:"cover",background:"#000"}} /> : video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={video.title} style={{display:"block",width:"100%",aspectRatio:"16/9",objectFit:"cover"}} /> : <div style={{display:"grid",placeItems:"center",aspectRatio:"16/9",color:t.t3}}><ImageOff size={34}/><span style={{fontSize:12,marginTop:8}}>No thumbnail available</span></div>}
    </div>
    <button type="button" onClick={()=>setPage(`watch:${video.id}`)} style={{display:"block",width:"100%",padding:"10px 0 0",border:0,background:"none",color:t.t1,textAlign:"left",cursor:"pointer"}}>
      <div style={{fontSize:17,fontWeight:700,lineHeight:1.35}}>{video.title}</div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:5,color:t.t3,fontSize:12}}><span>{video.creator}</span><span>•</span><span>{video.views}</span><span>•</span><span>{video.ago}</span></div>
    </button>
  </section>;
}

function AgenticToolsCard({ t }) {
  const [open,setOpen]=useState(false);
  const tools=[{label:"Auto-video generation",enabled:false},{label:"Smart subtitles",enabled:false},{label:"SEO tag optimization",enabled:false},{label:"Database self-healing",enabled:false}];
  return <section style={{margin:"4px 16px 16px",border:`1px solid ${t.bdr}`,borderRadius:14,background:t.elev,overflow:"hidden"}}>
    <button type="button" onClick={()=>setOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"none",border:0,color:t.t1,cursor:"pointer",textAlign:"left"}}><span style={{fontSize:12,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>AI agentic features</span><ChevronRight size={16} style={{transform:open?"rotate(90deg)":"none",transition:"transform .18s"}}/></button>
    {open&&<div style={{padding:"0 14px 12px",borderTop:`1px solid ${t.bdr}`}}>{tools.map(tool=><div key={tool.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",color:t.t2,fontSize:13}}><span>{tool.label}</span><span style={{fontSize:11,color:t.t3}}>Not connected</span></div>)}</div>}
  </section>;
}

function BuildStatus({ t, loading, error, videos, shorts }) {
  const state=loading?"Loading real data":error?"Data unavailable":videos.length||shorts.length?"Connected to HkTube data":"Connected · no published content";
  const color=loading?t.warn:error?t.live:videos.length||shorts.length?t.ok:t.t2;
  return <div style={{borderTop:`1px solid ${t.bdr}`,borderBottom:`1px solid ${t.bdr}`,padding:"8px 16px",textAlign:"center",color:t.t3,fontSize:11}}>STATUS: <span style={{color}}>{state}</span> <span style={{opacity:.5}}> | </span> Vercel: <span style={{color:t.ok}}>Production build</span></div>;
}

function HomePage({ t, setPage, setShowMenu, videos=[], shorts=[], loading=false, error=false }) {
  const hero=videos[0];
  const next=videos.slice(1);
  return (
    <div style={{paddingBottom:90}}>
      <CatChips t={t} setShowMenu={setShowMenu}/>
      {loading ? <div style={{minHeight:220,display:"grid",placeItems:"center",color:t.t3,fontSize:13}}>Loading real HkTube content…</div> : error ? <div style={{minHeight:220,display:"grid",placeItems:"center",textAlign:"center",padding:24}}><div><div style={{color:t.t1,fontWeight:700,fontSize:16}}>Content could not load</div><div style={{color:t.t3,fontSize:13,marginTop:6}}>Refresh and try again. HkTube does not fabricate video records.</div></div></div> : <>
        {hero&&<FeaturedVideo t={t} video={hero} setPage={setPage}/>} 
        {shorts.length > 0 && <div style={{marginTop:16,marginBottom:4}}><SectionHd title="Featured Shorts" t={t} onMore={()=>setPage("shorts")}/><div style={{display:"flex",gap:8,overflowX:"auto",padding:"0 16px 12px",scrollbarWidth:"none"}}>{shorts.map(s=><ShortCard key={s.id} s={s} t={t}/>)}</div></div>}
        {next.length > 0 && <div style={{marginTop:6}}><SectionHd title="Next Up" t={t} onMore={()=>setPage("home")}/><div style={{display:"flex",flexDirection:"column",gap:0}} className="hk-video-feed">{next.map(v=><div key={v.id} style={{marginBottom:20}} className="hk-video-item"><VideoCard v={v} t={t} fullWidth={true}/></div>)}</div></div>}
        {!hero&&!shorts.length&&<div style={{minHeight:260,display:"grid",placeItems:"center",textAlign:"center",padding:24}}><div><ImageOff size={30} color={t.t3}/><div style={{color:t.t1,fontWeight:700,fontSize:16,marginTop:10}}>No real videos published yet</div><div style={{color:t.t3,fontSize:13,marginTop:6}}>Upload an authorized video to make it appear here.</div></div></div>}
      </>}
      <BuildStatus t={t} loading={loading} error={error} videos={videos} shorts={shorts}/>
    </div>
  );
}

// ─────────────────────────────────────────
// ▶️  SHORTS PAGE (TikTok/YouTube Shorts style)
// ─────────────────────────────────────────
function ShortsPage({ t, shorts=[] }) {
  const [cur,setCur]=useState(0);
  const [muted,setMuted]=useState(true);
  const [liked,setLiked]=useState({});
  const [saved,setSaved]=useState({});
  const items=shorts;
    if(!items.length) return <div style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#000",color:"#aaa",textAlign:"center",padding:24}}>
<div><ImageOff size={34} color="#666"/><div style={{marginTop:12,fontWeight:700,color:"#fff"}}>No real Shorts published yet</div><div style={{marginTop:6,fontSize:13}}>Upload an authorized vertical video to see it here.</div></div></div>;
  const s=items[cur];
  return (
    <div style={{
      height:"100dvh", overflow:"hidden",
      background:"#000",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      position:"relative"
    }}>
      {/* Main Shorts player */}
      <div style={{
        height:"100%", maxHeight:"100dvh",
        aspectRatio:"9/16", maxWidth:420, width:"100%",
        background:t.elev, position:"relative", overflow:"hidden"
      }}>
        <>{s.videoUrl ? <video src={s.videoUrl} poster={s.thumbnailUrl||undefined} autoPlay muted loop playsInline controls style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",background:"#000"}} /> : s.thumbnailUrl ? <img src={s.thumbnailUrl} alt="Short thumbnail" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} /> : <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:"#666"}}><ImageOff size={42}/><span style={{fontSize:12}}>No thumbnail available</span></div>}</>

        {/* Bottom overlay */}
        <div style={{
          position:"absolute", bottom:0, left:0, right:0,
          padding:"80px 16px 24px",
          background:"linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)"
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <Av char={s.av} size={38} seed={cur}/>
            <div style={{flex:1}}>
              <span style={{color:"white",fontWeight:700,fontSize:14}}>{s.creator}</span>
            </div>
            <button style={{
              background:"none", border:"1.5px solid white",
              color:"white", padding:"5px 14px", borderRadius:20,
              fontSize:13, fontWeight:600, cursor:"pointer"
            }}>Follow</button>
          </div>
          <p style={{color:"white",fontSize:14,margin:"0 0 6px",lineHeight:1.5}}>{s.title}</p>
          <p style={{color:"rgba(255,255,255,0.65)",fontSize:12,margin:0}}>♫ Original Audio</p>
        </div>

        {/* Side actions */}
        <div style={{
          position:"absolute", right:14, bottom:100,
          display:"flex", flexDirection:"column", gap:20, alignItems:"center"
        }}>
          {[
            {icon:<Heart size={28} fill={liked[cur]?"#FF4C93":"none"} color={liked[cur]?"#FF4C93":"white"}/>,
             label:s.likes, action:()=>setLiked(p=>({...p,[cur]:!p[cur]}))},
            {icon:<MessageCircle size={28} color="white"/>, label:"342"},
            {icon:<Share2 size={28} color="white"/>, label:"Share"},
            {icon:<Bookmark size={28} fill={saved[cur]?t.pri:"none"} color={saved[cur]?t.pri:"white"}/>,
             label:"Save", action:()=>setSaved(p=>({...p,[cur]:!p[cur]}))},
          ].map((b,i)=>(
            <button key={i} onClick={b.action} style={{
              background:"none",border:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:0
            }}>
              {b.icon}
              <span style={{color:"white",fontSize:12,fontWeight:600}}>{b.label}</span>
            </button>
          ))}
        </div>

        {/* Mute */}
        <button onClick={()=>setMuted(x=>!x)} style={{
          position:"absolute",top:14,right:14,
          background:"rgba(0,0,0,0.5)",border:"none",color:"white",
          width:36,height:36,borderRadius:"50%",cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center"
        }}>
          {muted?<VolumeX size={16}/>:<Volume2 size={16}/>}
        </button>
      </div>

      {/* Up/Down arrows */}
      <div style={{position:"absolute",right:20,top:"50%",transform:"translateY(-50%)",display:"flex",flexDirection:"column",gap:10}}>
        {[
          {d:"▲",a:()=>setCur(p=>Math.max(0,p-1)),dis:cur===0},
          {d:"▼",a:()=>setCur(p=>Math.min(items.length-1,p+1)),dis:cur===items.length-1},
        ].map((b,i)=>(
          <button key={i} onClick={b.a} disabled={b.dis} style={{
            background:"rgba(255,255,255,0.15)",border:"none",color:"white",
            width:40,height:40,borderRadius:"50%",cursor:b.dis?"default":"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:14,opacity:b.dis?0.2:0.8,backdropFilter:"blur(4px)"
          }}>{b.d}</button>
        ))}
      </div>

      {/* Dots */}
      <div style={{position:"absolute",bottom:20,display:"flex",gap:6}}>
        {items.map((_,i)=>(
          <div key={i} onClick={()=>setCur(i)} style={{
            width:i===cur?20:6,height:6,borderRadius:3,
            background:i===cur?"white":"rgba(255,255,255,0.4)",
            cursor:"pointer",transition:"width 0.25s,background 0.25s"
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 📰  FEEDS PAGE
// ─────────────────────────────────────────
function FeedsPage({ t }) {
  const postsQuery=trpc.posts.latest.useQuery({limit:50});
  const posts=(postsQuery.data??[]).map(post=>({id:post.id,creator:"HkTube creator",av:"H",badge:null,ago:formatDate(post.createdAt),text:post.body,likes:0,comments:0,imageUrl:null}));
  return (
    <div style={{maxWidth:640,margin:"0 auto",padding:"0 16px 100px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 0",borderBottom:`1px solid ${t.bdr}`}}>
        <Av char="U" size={38} seed={99}/>
        <div style={{flex:1,background:t.input,border:`1px solid ${t.bdr}`,borderRadius:20,padding:"9px 16px",color:t.t3,fontSize:14}}>Real posts from the HkTube feed</div>
      </div>
      <div style={{display:"flex",gap:8,padding:"12px 0",borderBottom:`1px solid ${t.bdr}`,marginBottom:4}}>
        {['Following','Trending','All'].map((tab,i)=><button key={tab} type="button" style={{padding:"6px 16px",borderRadius:20,border:`1px solid ${i===0?t.pri:t.bdr}`,background:i===0?t.priDim:t.hover,color:i===0?t.pri:t.t2,fontSize:13,fontWeight:i===0?600:400,cursor:"pointer"}}>{tab}</button>)}
      </div>
      {postsQuery.isLoading ? <div style={{minHeight:220,display:"grid",placeItems:"center",color:t.t3,fontSize:13}}>Loading real posts…</div> : postsQuery.isError ? <div style={{minHeight:220,display:"grid",placeItems:"center",textAlign:"center",color:t.t3,fontSize:13,padding:24}}>Posts could not load. Refresh and try again.</div> : posts.length ? posts.map(p=><FeedPost key={p.id} p={p} t={t}/>) : <div style={{minHeight:220,display:"grid",placeItems:"center",textAlign:"center",padding:24}}><div><FileText size={30} color={t.t3}/><div style={{color:t.t1,fontWeight:700,fontSize:16,marginTop:10}}>No posts yet</div><div style={{color:t.t3,fontSize:13,marginTop:6}}>Real creator posts will appear here after they are published.</div></div></div>}
    </div>
  );
}

// ─────────────────────────────────────────
// 🎬  CREATOR STUDIO
// ─────────────────────────────────────────
function StudioPage({ t }) {
  const [tab,setTab]=useState("dashboard");
  const tabs=["Dashboard","Content","Analytics","Monetization"];
  return (
    <div style={{paddingBottom:100}}>
      {/* Header */}
      <div style={{
        padding:"20px 16px",
        background:`linear-gradient(to right,${t.priDim},${t.secDim})`,
        borderBottom:`1px solid ${t.bdr}`,
        display:"flex",gap:14,alignItems:"center"
      }}>
        <Av char="U" size={52} seed={77}/>
        <div style={{flex:1}}>
          <div style={{color:t.t1,fontWeight:700,fontSize:18}}>Creator Studio</div>
          <div style={{color:t.t2,fontSize:13,marginTop:3}}>Manage your channel</div>
        </div>
        <button style={{
          background:`linear-gradient(135deg,${t.pri},${t.sec})`,
          border:"none",color:"white",padding:"9px 18px",
          borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",
          display:"flex",gap:6,alignItems:"center",
          boxShadow:`0 2px 10px ${t.priGlow}`
        }}>
          <Upload size={14}/> Upload
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display:"flex",gap:0,overflowX:"auto",scrollbarWidth:"none",
        borderBottom:`1px solid ${t.bdr}`,padding:"0 8px"
      }}>
        {tabs.map(tb=>{
          const key=tb.toLowerCase().replace(/ & /,"-").replace(/ /g,"-");
          const active=tab===key;
          return (
            <button key={tb} onClick={()=>setTab(key)} style={{
              flexShrink:0,padding:"14px 16px",background:"none",border:"none",
              borderBottom:active?`2px solid ${t.pri}`:"2px solid transparent",
              color:active?t.t1:t.t2,fontSize:13.5,fontWeight:active?700:400,
              cursor:"pointer",transition:"color 0.15s",whiteSpace:"nowrap",
              marginBottom:-1
            }}>{tb}</button>
          );
        })}
      </div>

      {/* Dashboard */}
      {tab==="dashboard"&&(
        <div style={{padding:"16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
            {[
              {l:"Total Views",v:"—",icon:"👁️"},
              {l:"Followers",v:"—",icon:"👥"},
              {l:"Videos",v:"—",icon:"🎬"},
              {l:"Revenue",v:"—",icon:"💵"},
            ].map((s,i)=>(
              <div key={i} style={{background:t.elev,border:`1px solid ${t.bdr}`,borderRadius:12,padding:16}}>
                <div style={{fontSize:24,marginBottom:8}}>{s.icon}</div>
                <div style={{color:t.t1,fontWeight:700,fontSize:22}}>{s.v}</div>
                <div style={{color:t.t3,fontSize:12,marginTop:3}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{
            background:t.elev,border:`1px solid ${t.bdr}`,
            borderRadius:12,padding:"28px 16px",textAlign:"center"
          }}>
            <div style={{fontSize:44,marginBottom:10}}>📂</div>
            <div style={{color:t.t1,fontWeight:600,fontSize:16,marginBottom:6}}>No content yet</div>
            <div style={{color:t.t3,fontSize:13,maxWidth:260,margin:"0 auto 16px",lineHeight:1.6}}>Upload your first video to start growing your channel.</div>
            <button style={{
              background:`linear-gradient(135deg,${t.pri},${t.sec})`,
              border:"none",color:"white",padding:"10px 22px",
              borderRadius:20,fontSize:14,fontWeight:600,cursor:"pointer"
            }}>Upload Video</button>
          </div>
        </div>
      )}

      {/* Monetization tab */}
      {tab==="monetization"&&(
        <div style={{padding:16}}>
          <div style={{background:t.elev,border:`1px solid ${t.bdr}`,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{color:t.t1,fontWeight:600,fontSize:15,marginBottom:14}}>Eligibility Status</div>
            {[
              {l:"1,000 Followers",ok:false},
              {l:"10,000 Watch Minutes (last 90 days)",ok:false},
              {l:"Account in good standing",ok:true},
              {l:"Policy accepted",ok:false},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:i>0?`1px solid ${t.bdr}`:"none"}}>
                <div style={{
                  width:20,height:20,borderRadius:"50%",flexShrink:0,
                  background:r.ok?t.okD:t.elev,border:`1px solid ${r.ok?t.ok:t.bdr}`,
                  display:"flex",alignItems:"center",justifyContent:"center"
                }}>
                  {r.ok?<Check size={11} color={t.ok} strokeWidth={3}/>:<X size={10} color={t.t3}/>}
                </div>
                <span style={{color:r.ok?t.t1:t.t3,fontSize:13}}>{r.l}</span>
              </div>
            ))}
          </div>
          <div style={{background:t.elev,border:`1px solid ${t.bdr}`,borderRadius:12,padding:16}}>
            <div style={{color:t.t1,fontWeight:600,fontSize:15,marginBottom:12}}>Revenue (90/10 split)</div>
            {["Ad Revenue","Gift Revenue (90%)","Platform Share (10%)","Available for Payout"].map((row,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderTop:i>0?`1px solid ${t.bdr}`:"none"}}>
                <span style={{color:t.t2,fontSize:13}}>{row}</span>
                <span style={{color:t.t1,fontWeight:600,fontSize:14}}>—</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────
// ⚙️  SETTINGS PAGE
// ─────────────────────────────────────────
function SettingsPage({ t, themeId, onTheme, setPage }) {
  const [activeId,setActiveId]=useState(null);
  const defaults={push:true,email:false,follows:true,likes:true,comments:true,twoFA:false,loginAlerts:true,autoplay:true,hdWifi:true,saveData:false,showActivity:true,publicLikes:false,captions:false,restricted:false,personalized:true};
  const [tog,setTog]=useState(()=>{try{const raw=localStorage.getItem("hktube-settings");return {...defaults,...(raw?JSON.parse(raw):{})};}catch{return defaults;}});
  const [quality,setQuality]=useState(()=>localStorage.getItem("hktube-quality")||"auto");
  const [language,setLanguage]=useState(()=>localStorage.getItem("hktube-language")||"English");
  useEffect(()=>{try{localStorage.setItem("hktube-settings",JSON.stringify(tog));}catch{}},[tog]);
  const toggle=k=>setTog(p=>({...p,[k]:!p[k]}));
  const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const active=activeId?SETTINGS_GROUPS.flatMap(g=>g.items).find(item=>item.id===activeId):null;
  const rows={
    notifications:[{l:"Push Notifications",k:"push",d:"Device alerts for activity on your account"},{l:"Email Notifications",k:"email",d:"Product updates and account messages"},{l:"New Followers",k:"follows",d:"When someone follows your channel"},{l:"Likes and Comments",k:"likes",d:"Activity on your videos and posts"}],
    security:[{l:"Two-Step Verification",k:"twoFA",d:"Add another sign-in verification step"},{l:"Login Alerts",k:"loginAlerts",d:"Notify this browser about new sign-ins"}],
    privacy:[{l:"Show Activity Status",k:"showActivity",d:"Let others see when you are active"},{l:"Public Likes",k:"publicLikes",d:"Show liked videos publicly"}],
    data:[{l:"Reduce Media Preload",k:"saveData",d:"Load metadata first to save mobile data"}],
    captions:[{l:"Default Captions",k:"captions",d:"Prefer captions when a real caption track exists"}],
    content:[{l:"Personalized Recommendations",k:"personalized",d:"Use your activity to order the feed"},{l:"Restricted Mode",k:"restricted",d:"Limit potentially mature discovery content"}],
    family:[{l:"Family Mode",k:"restricted",d:"Hide Shorts and discovery surfaces on this browser"}],
  };
  const themes=[{id:"system",icon:"🌓",l:"System",d:"Follow device appearance"},{id:"dark",icon:"🌙",l:"Dark",d:"HkTube dark theme"},{id:"amoled",icon:"⚡",l:"AMOLED",d:"True black theme"},{id:"light",icon:"☀️",l:"Light",d:"Bright theme"}];
  if(active) return <div style={{paddingBottom:100}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${t.bdr}`,padding:"10px 16px"}}><button type="button" onClick={()=>setActiveId(null)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",color:t.t2,fontSize:14,cursor:"pointer",padding:"4px 0"}}><ChevronLeft size={18}/> Settings</button><button type="button" onClick={()=>setPage("home")} aria-label="Close settings" style={{width:36,height:36,display:"grid",placeItems:"center",borderRadius:"50%",background:t.hover,border:"none",color:t.t1,cursor:"pointer"}}><X size={19}/></button></div>
    <div style={{padding:"0 16px 16px"}}><h2 style={{color:t.t1,fontSize:20,fontWeight:700,margin:"0 0 16px"}}>{active.icon} {active.label}</h2>
      {rows[active.id] ? <div style={{display:"flex",flexDirection:"column",gap:1}}>{rows[active.id].map(item=><div key={item.k} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:`1px solid ${t.bdr}`}}><div style={{flex:1,minWidth:0}}><div style={{color:t.t1,fontSize:14}}>{item.l}</div><div style={{color:t.t3,fontSize:12,marginTop:2,lineHeight:1.45}}>{item.d}</div></div><Toggle on={Boolean(tog[item.k])} onChange={()=>toggle(item.k)} t={t}/></div>)}</div> : (active.id==="theme" || active.id==="appearance") ? <div style={{display:"flex",flexDirection:"column",gap:8}}>{themes.map(th=><button key={th.id} onClick={()=>onTheme(th.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px",borderRadius:10,background:themeId===th.id?t.priDim:t.hover,border:`1px solid ${themeId===th.id?t.pri:t.bdr}`,cursor:"pointer",textAlign:"left",width:"100%"}}><span style={{fontSize:22}}>{th.icon}</span><div style={{flex:1}}><div style={{color:t.t1,fontSize:14,fontWeight:600}}>{th.l}</div><div style={{color:t.t3,fontSize:12,marginTop:2}}>{th.d}</div></div>{themeId===th.id?<Check size={18} color={t.pri}/>:<ChevronRight size={16} color={t.t3}/>}</button>)}</div> : active.id==="playback" ? <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${t.bdr}`}}><label style={{display:"block",color:t.t1,fontSize:14,fontWeight:600,marginBottom:8}}>Preferred video quality</label><select value={quality} onChange={e=>{setQuality(e.target.value);save("hktube-quality",e.target.value)}} style={{width:"100%",padding:"11px 12px",borderRadius:9,background:t.input,color:t.t1,border:`1px solid ${t.bdr}`,fontSize:14}}><option>auto</option><option>2160p</option><option>1080p</option><option>720p</option><option>480p</option><option>360p</option></select></div> : active.id==="language" ? <div><label style={{display:"block",color:t.t1,fontSize:14,fontWeight:600,marginBottom:8}}>App language</label><select value={language} onChange={e=>{setLanguage(e.target.value);save("hktube-language",e.target.value)}} style={{width:"100%",padding:"11px 12px",borderRadius:9,background:t.input,color:t.t1,border:`1px solid ${t.bdr}`,fontSize:14}}><option>English</option><option>Urdu</option><option>Hindi</option></select></div> : <div style={{background:t.elev,border:`1px solid ${t.bdr}`,borderRadius:10,padding:"24px 16px",textAlign:"center"}}><div style={{fontSize:36,marginBottom:10}}>{active.icon}</div><div style={{color:t.t1,fontWeight:600,fontSize:15,marginBottom:6}}>{active.label}</div><div style={{color:t.t3,fontSize:13,lineHeight:1.6}}>This control is ready in the settings layout. Account or payment changes require the corresponding authenticated provider.</div></div>}
    </div>
  </div>;
  return <div style={{paddingBottom:100}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${t.bdr}`,padding:"10px 16px"}}><h1 style={{color:t.t1,fontSize:18,fontWeight:700,margin:0}}>Settings</h1><button type="button" onClick={()=>setPage("home")} aria-label="Close settings" style={{width:36,height:36,display:"grid",placeItems:"center",borderRadius:"50%",background:t.hover,border:"none",color:t.t1,cursor:"pointer"}}><X size={19}/></button></div><div style={{color:t.t3,fontSize:12,padding:"12px 16px 0",lineHeight:1.5}}>YouTube-style controls for playback, notifications, privacy, appearance, data usage, and account safety.</div>{SETTINGS_GROUPS.map((group,gi)=><div key={gi}><div style={{color:t.t3,fontSize:12,fontWeight:600,letterSpacing:1,textTransform:"uppercase",padding:"16px 16px 8px"}}>{group.group}</div>{group.items.map(item=><button key={item.id} onClick={()=>setActiveId(item.id)} style={{display:"flex",alignItems:"center",gap:14,width:"100%",padding:"13px 16px",background:"none",border:"none",borderBottom:`1px solid ${t.bdr}`,cursor:"pointer",textAlign:"left"}}><span style={{fontSize:20,width:28,textAlign:"center"}}>{item.icon}</span><div style={{flex:1,minWidth:0}}><div style={{color:item.danger?t.live:t.t1,fontSize:14}}>{item.label}</div><div style={{color:t.t3,fontSize:12,marginTop:2}}>{item.desc}</div></div><ChevronRight size={15} color={t.t3}/></button>)}</div>)}</div>;
}

// ─────────────────────────────────────────
// ✅  VERIFICATION PAGE
// ─────────────────────────────────────────
function VerificationPage({ t }) {
  return (
    <div style={{padding:"0 0 100px"}}>
      <div style={{
        background:`linear-gradient(to right,${t.priDim},${t.goldDim})`,
        padding:"24px 16px 20px",textAlign:"center",
        borderBottom:`1px solid ${t.bdr}`
      }}>
        <div style={{fontSize:44,marginBottom:8}}>✅</div>
        <h1 style={{color:t.t1,fontSize:20,fontWeight:700,margin:"0 0 8px"}}>Creator Verification</h1>
        <p style={{color:t.t2,fontSize:13,margin:0,lineHeight:1.6}}>Apply for a verified badge to build trust with your audience.</p>
      </div>

      <div style={{padding:"16px"}}>
        <div style={{color:t.t3,fontSize:12,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Badge Styles</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
          {Object.entries(BADGE).map(([key,col])=>(
            <div key={key} style={{
              background:t.elev,border:`1px solid ${t.bdr}`,
              borderRadius:10,padding:"12px 4px",textAlign:"center"
            }}>
              <div style={{
                width:32,height:32,borderRadius:"50%",margin:"0 auto 6px",
                background:`${col}22`,border:`2px solid ${col}`,
                display:"flex",alignItems:"center",justifyContent:"center"
              }}>
                <Check size={14} color={col} strokeWidth={3}/>
              </div>
              <div style={{color:t.t1,fontSize:11,fontWeight:600,textTransform:"capitalize"}}>{key}</div>
            </div>
          ))}
        </div>

        <div style={{background:t.elev,border:`1px solid ${t.bdr}`,borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{color:t.t1,fontWeight:600,fontSize:14,marginBottom:12}}>Requirements</div>
          {["Account in good standing","Complete profile with photo and bio","Content follows Community Guidelines","Represents a real person, business, or brand"].map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:i>0?`1px solid ${t.bdr}`:"none"}}>
              <Check size={14} color={t.ok} strokeWidth={3}/>
              <span style={{color:t.t2,fontSize:13}}>{r}</span>
            </div>
          ))}
        </div>

        <div style={{background:t.warnD,border:`1px solid ${t.warn}33`,borderRadius:10,padding:14,marginBottom:16,display:"flex",gap:10}}>
          <Info size={15} color={t.warn} style={{flexShrink:0,marginTop:1}}/>
          <span style={{color:t.t2,fontSize:13,lineHeight:1.6}}>Each application is reviewed individually. Badges can be revoked for policy violations.</span>
        </div>

        <button style={{
          width:"100%",padding:"13px",borderRadius:20,
          background:`linear-gradient(135deg,${t.pri},${t.sec})`,
          border:"none",color:"white",fontSize:14,fontWeight:600,cursor:"pointer",
          boxShadow:`0 2px 12px ${t.priGlow}`
        }}>Apply for Verification</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 🔔  NOTIFICATIONS PANEL
// ─────────────────────────────────────────
function NotifPanel({ t, onClose, items=[] }) {
  const unread=items.filter(n=>!n.readAt).length;
  const utils=trpc.useUtils();
  const markRead=trpc.notifications.markRead.useMutation({onSuccess:()=>void utils.notifications.mine.invalidate()});
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:500,
      background:"rgba(0,0,0,0.65)",
      display:"flex",justifyContent:"flex-end"
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:360,
        background:t.surf,borderLeft:`1px solid ${t.bdr}`,
        height:"100%",overflowY:"auto",display:"flex",flexDirection:"column"
      }}>
        <div style={{
          padding:"16px",borderBottom:`1px solid ${t.bdr}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",
          position:"sticky",top:0,background:t.surf
        }}>
          <div>
            <h3 style={{color:t.t1,margin:0,fontSize:17,fontWeight:700}}>Notifications</h3>
            {unread>0&&<span style={{color:t.t3,fontSize:12}}>{unread} new</span>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button type="button" disabled={!unread||markRead.isPending} onClick={()=>items.filter(n=>!n.readAt).forEach(n=>markRead.mutate({id:n.id}))} style={{background:"none",border:"none",color:unread?t.pri:t.t3,fontSize:12,fontWeight:600,cursor:unread?"pointer":"default"}}>Mark all read</button>
            <button onClick={onClose} style={{background:"none",border:"none",color:t.t3,cursor:"pointer",display:"flex"}}><X size={20}/></button>
          </div>
        </div>
        <div style={{flex:1}}>
          {items.length ? items.map(n=>(
            <div key={n.id} style={{
              display:"flex",gap:12,padding:"14px 16px",
              borderBottom:`1px solid ${t.bdr}`,
              background:!n.readAt?t.priDim:"none",cursor:"pointer",
              transition:"background 0.1s"
            }}
            onMouseEnter={e=>e.currentTarget.style.background=t.hover}
            onMouseLeave={e=>e.currentTarget.style.background=!n.read?t.priDim:"none"}
            >
              <span style={{fontSize:22,flexShrink:0}}>{n.type==="follow"?"👤":n.type==="like"?"❤️":n.type==="comment"?"💬":n.type==="security"?"🔐":"🔔"}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:t.t1,fontSize:13,margin:0,lineHeight:1.5,fontWeight:n.readAt?400:600}}>{n.title}</p>
                {n.body&&<p style={{color:t.t2,fontSize:12,margin:"3px 0 0",lineHeight:1.45}}>{n.body}</p>}
                <span style={{color:t.t3,fontSize:11}}>{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              {!n.readAt&&<div style={{width:8,height:8,borderRadius:"50%",background:t.pri,flexShrink:0,marginTop:5}}/>}
            </div>
          )) : <div style={{padding:24,textAlign:"center",color:t.t3,fontSize:13}}>No notifications yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 👤  MENU / PROFILE MODAL (full-screen YouTube-style panel)
// ─────────────────────────────────────────
function MenuModal({ t, curTheme, onTheme, onClose, setPage, user, navigate }) {
  const themes=[
    {id:"system",icon:"🌓",l:"System"},
    {id:"dark",icon:"🌙",l:"Dark"},
    {id:"amoled",icon:"⚡",l:"AMOLED"},
    {id:"light",icon:"☀️",l:"Light"},
  ];
  const items=[
    {icon:"👤",l:"Profile / My Channel",route:"/profile"},
    {icon:"📺",l:"Create Channel",route:"/channel/create"},
    {icon:"⬆️",l:"Upload Video",route:"/upload"},
    {icon:"🎬",l:"Creator Studio",p:"studio"},
    {icon:"📊",l:"Analytics",p:"analytics"},
    {icon:"📰",l:"Feeds",p:"feeds"},
    {icon:"🔥",l:"Trending",p:"trending"},
    {icon:"🔖",l:"Saved",p:"saved"},
    {icon:"🕐",l:"History",p:"history"},
    {icon:"✅",l:"Verification",p:"verification"},
    {icon:"💵",l:"Monetization",p:"monetization"},
    {icon:"⚙️",l:"Settings",p:"settings"},
    {icon:"❓",l:"Help & Feedback",p:"help"},
    {icon:"🚪",l:"Sign Out",danger:true},
  ];
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:500,
      background:t.bg,
      display:"flex",alignItems:"stretch",justifyContent:"stretch"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:"none",height:"100dvh",
        background:t.surf,borderRadius:0,
        border:0,overflow:"hidden auto"
      }}>
        <div style={{position:"sticky",top:0,zIndex:2,display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:t.surf,borderBottom:`1px solid ${t.bdr}`}}>
          <button type="button" onClick={onClose} aria-label="Close settings" style={{width:36,height:36,display:"grid",placeItems:"center",borderRadius:"50%",background:t.hover,border:"none",color:t.t1,cursor:"pointer"}}><X size={20}/></button>
          <div style={{color:t.t1,fontWeight:700,fontSize:16}}>Settings & more</div>
        </div>

        {/* Profile */}
        <div style={{
          padding:"12px 16px 16px",borderBottom:`1px solid ${t.bdr}`,
          display:"flex",gap:12,alignItems:"center"
        }}>
          <Av char={(user?.name||"U").slice(0,1).toUpperCase()} size={50} seed={88}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:t.t1,fontWeight:700,fontSize:15}}>{user?.name || "Guest viewer"}</div>
            <div style={{color:t.t2,fontSize:12,marginTop:2,overflowWrap:"anywhere"}}>{user?.email || "Sign in to manage your account"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,padding:"0 16px 14px",borderBottom:`1px solid ${t.bdr}`}}>
          {user ? <>
            <button onClick={()=>{navigate("/profile");onClose();}} style={{flex:1,padding:"9px 10px",borderRadius:10,border:`1px solid ${t.bdr}`,background:t.hover,color:t.t1,cursor:"pointer",fontSize:12}}>Profile / My Channel</button>
            <button onClick={()=>{navigate("/channel/create");onClose();}} style={{flex:1,padding:"9px 10px",borderRadius:10,border:`1px solid ${t.pri}`,background:t.priDim,color:t.pri,cursor:"pointer",fontSize:12}}>Create Channel</button>
          </> : <button onClick={startLogin} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${t.pri}`,background:t.priDim,color:t.pri,cursor:"pointer",fontSize:13,fontWeight:700}}>Sign in / Sign up</button>}
        </div>

        {/* Theme */}
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${t.bdr}`}}>
          <div style={{color:t.t3,fontSize:11,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Theme</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {themes.map(th=>{
              const active=curTheme===th.id;
              return (
                <button key={th.id} onClick={()=>onTheme(th.id)} style={{
                  padding:"12px 8px",borderRadius:10,cursor:"pointer",
                  border:`1.5px solid ${active?t.pri:t.bdr}`,
                  background:active?t.priDim:t.hover,
                  display:"flex",flexDirection:"column",alignItems:"center",gap:5,
                  transition:"all 0.15s"
                }}>
                  <span style={{fontSize:18}}>{th.icon}</span>
                  <span style={{fontSize:12,color:active?t.pri:t.t2,fontWeight:active?700:400}}>{th.l}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu items grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",padding:"8px 8px 28px"}}>
          {items.map((item,i)=>(
            <button key={i} onClick={()=>{if(item.route){navigate(item.route);onClose();} else if(item.p){setPage(item.p);onClose();} else if(item.l==="Sign Out"){onClose();}}} style={{
              display:"flex",alignItems:"center",gap:10,
              padding:"13px 12px",borderRadius:10,
              background:"none",border:"none",
              color:item.danger?t.live:t.t1,
              fontSize:13.5,cursor:"pointer",textAlign:"left",
              transition:"background 0.1s"
            }}
            onMouseEnter={e=>e.currentTarget.style.background=t.hover}
            onMouseLeave={e=>e.currentTarget.style.background="none"}
            >
              <span style={{fontSize:18}}>{item.icon}</span>
              {item.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ➕  CREATE MODAL
// ─────────────────────────────────────────
function CreateModal({ t, onClose, navigate }) {
  const opts=[
    {icon:"🎬",l:"Upload Video",d:"Long-form · tutorials · vlogs",col:t.pri,route:"/upload"},
    {icon:"▶️",l:"Create Short",d:"Vertical 9:16 video · up to 60s",col:t.sec,route:"/upload?category=shorts"},
    {icon:"📝",l:"Write Post",d:"Text · images · polls · links",col:"#00BBFF",route:"/posts?compose=1"},
    {icon:"📺",l:"Create Channel",d:"Set up your creator identity",col:"#00BBFF",route:"/channel/create"},
  ];
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:500,
      background:"rgba(0,0,0,0.65)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:480,
        background:t.surf,borderRadius:"16px 16px 0 0",
        border:`1px solid ${t.bdr}`,overflow:"hidden"
      }}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
          <div style={{width:36,height:4,borderRadius:2,background:t.bdr}}/>
        </div>
        <div style={{padding:"4px 16px 14px",borderBottom:`1px solid ${t.bdr}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h3 style={{color:t.t1,margin:0,fontSize:17,fontWeight:700}}>Create</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.t3,cursor:"pointer",display:"flex"}}><X size={20}/></button>
        </div>
        <div style={{padding:"8px 8px 28px"}}>
          {opts.map((o,i)=>(
            <button key={i} onClick={()=>{if(o.route){navigate(o.route);onClose();}else onClose();}} style={{
              display:"flex",alignItems:"center",gap:14,
              width:"100%",padding:"14px 12px",borderRadius:10,
              background:"none",border:"none",cursor:"pointer",textAlign:"left",
              transition:"background 0.1s"
            }}
            onMouseEnter={e=>e.currentTarget.style.background=t.hover}
            onMouseLeave={e=>e.currentTarget.style.background="none"}
            >
              <div style={{
                width:48,height:48,borderRadius:14,flexShrink:0,
                background:`${o.col}18`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:24
              }}>{o.icon}</div>
              <div style={{flex:1}}>
                <div style={{color:t.t1,fontWeight:600,fontSize:15}}>{o.l}</div>
                <div style={{color:t.t3,fontSize:12,marginTop:2}}>{o.d}</div>
              </div>
              <ChevronRight size={16} color={t.t3}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
function toDisplayVideo(video, index) {
  return {id:video.id,title:video.title,creator:"HkTube creator",av:"H",views:formatViews(video.viewCount),dur:formatDuration(video.durationSeconds),ago:formatDate(video.uploadedAt),vf:false,badge:null,g:"tech",thumbnailUrl:video.thumbnailUrl,videoUrl:video.videoUrl,category:video.category};
}
function toDisplayShort(video, index) {
  return {id:video.id,title:video.title,creator:"HkTube creator",av:"H",likes:formatViews(video.viewCount),g:"tech",thumbnailUrl:video.thumbnailUrl,videoUrl:video.videoUrl,category:video.category};
}

// 🚀  ROOT APP
// ─────────────────────────────────────────
export default function HkTube() {
  const [themeId,setThemeId]=useState(()=>{try{return localStorage.getItem("hktube-theme")||"light";}catch{return "light";}});
  const changeTheme=id=>{setThemeId(id);try{localStorage.setItem("hktube-theme",id);}catch{}};
  const [page,setPage]=useState("home");
  const [showMenu,setShowMenu]=useState(false);
  const [showCreate,setShowCreate]=useState(false);
  const [showNotif,setShowNotif]=useState(false);
  const [,navigate]=useLocation();
  const auth=trpc.auth.me.useQuery();
  const notificationsQuery=trpc.notifications.mine.useQuery(undefined,{enabled:Boolean(auth.data)});
  const videoQuery=trpc.videos.latest.useQuery({limit:20});
  const shortsQuery=trpc.videos.shorts.useQuery({limit:20});
  const videos=(videoQuery.data??[]).map(toDisplayVideo);
  const shorts=(shortsQuery.data??[]).map(toDisplayShort);
  const resolvedThemeId=themeId==="system" ? (typeof window!=="undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : themeId;
  const t=T[resolvedThemeId]||T.dark;
  const notifications=notificationsQuery.data??[];
  const unread=notifications.filter(n=>!n.readAt).length;

  const pages={
    home:<HomePage t={t} setPage={setPage} setShowMenu={setShowMenu} videos={videos} shorts={shorts} loading={videoQuery.isLoading||shortsQuery.isLoading} error={videoQuery.isError||shortsQuery.isError}/>,
    shorts:<ShortsPage t={t} shorts={shorts}/>,
    feeds:<FeedsPage t={t}/>,
    studio:<StudioPage t={t}/>,
    monetization:<StudioPage t={t}/>,
    settings:<SettingsPage t={t} themeId={themeId} onTheme={changeTheme} setPage={setPage}/>,
    verification:<VerificationPage t={t}/>,
  };

  return (
    <div className={`hk-app ${page==="shorts"?"hk-shorts-mode":""} ${page==="settings"?"hk-settings-mode":""}`} style={{
      fontFamily:"-apple-system,'Roboto',system-ui,sans-serif",
      background:t.bg,color:t.t1,minHeight:"100vh"
    }}>
      <style>{`
        :root{color-scheme:${resolvedThemeId==="light"?"light":"dark"};}
        html,body,#root{width:100%;min-width:0;max-width:100%;margin:0;padding:0;overflow-x:hidden;}
        *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        button,input,select,textarea{font:inherit;max-width:100%;}
        img,video,svg{max-width:100%;}
        input{color:${t.t1};}
        input::placeholder{color:${t.t3};}
        ::-webkit-scrollbar{display:none;}
        scrollbar-width:none;
        .hk-sidebar{display:none!important;}
        .hk-bottom-nav{display:flex!important;}
        .hk-shorts-mode .hk-header,.hk-shorts-mode .hk-bottom-nav,.hk-shorts-mode .hk-sidebar,.hk-settings-mode .hk-header,.hk-settings-mode .hk-bottom-nav,.hk-settings-mode .hk-sidebar{display:none!important;}
        .hk-shorts-mode main,.hk-settings-mode main{min-height:100dvh!important;padding-bottom:0!important;}
        .hk-txt{display:none;}
        /* Desktop layout */
        @media(min-width:1024px){
          .hk-sidebar{display:block!important;}
          .hk-bottom-nav{display:none!important;}
          .hk-txt{display:inline;}
          .hk-video-feed{
            display:grid!important;
            grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
            gap:16px;
            padding:16px;
          }
          .hk-video-item{margin-bottom:0!important;}
        }
        /* Mobile: full-width cards */
        @media(max-width:1023px){
          .hk-video-item{padding:0;}
          .hk-header{padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right));}
        }
      `}</style>

      <Header
        t={t} setPage={setPage}
        setShowCreate={setShowCreate}
        setShowNotif={setShowNotif}
        setShowMenu={setShowMenu}
        unread={unread}
      />

      <div style={{display:"flex"}}>
        <Sidebar t={t} page={page} setPage={setPage}/>
        <main style={{
          flex:1, minWidth:0, width:"100%",
          minHeight:"calc(100dvh - 56px)",
          height:"auto", overflow:"visible"
        }}>
          {pages[page] || (
            <div style={{
              display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",
              height:"60%",gap:10,textAlign:"center",padding:24
            }}>
              <div style={{fontSize:48}}>◌</div>
              <div style={{color:t.t1,fontWeight:600,fontSize:17}}>No records yet</div>
              <div style={{color:t.t3,fontSize:13,maxWidth:260,lineHeight:1.6}}>
                This HkTube section will show real records when activity is available.
              </div>
              <button onClick={()=>setPage("home")} style={{
                background:t.hover,border:`1px solid ${t.bdr}`,
                color:t.t1,padding:"8px 20px",borderRadius:20,
                fontSize:13,cursor:"pointer",marginTop:8
              }}>← Home</button>
            </div>
          )}
        </main>
      </div>

      <BottomNav
        t={t} page={page} setPage={setPage}
        setShowMenu={setShowMenu}
        setShowCreate={setShowCreate}
      />

      {showNotif && <NotifPanel t={t} items={notifications} onClose={()=>setShowNotif(false)}/>}
      {showMenu  && <MenuModal  t={t} user={auth.data} curTheme={themeId} onTheme={changeTheme} onClose={()=>setShowMenu(false)} setPage={p=>{setPage(p);setShowMenu(false);}} navigate={navigate}/>}
      {showCreate&& <CreateModal t={t} onClose={()=>setShowCreate(false)} navigate={navigate}/>}
    </div>
  );
}
