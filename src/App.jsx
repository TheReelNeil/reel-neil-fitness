import { useState, useEffect, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SB_URL = "https://nzhsffkflbknciojaexi.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aHNmZmtmbGJrbmNpb2phZXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTk1MjAsImV4cCI6MjA5NDY3NTUyMH0.augC9mFf--otWeSwX5IfjIUqx_FofITjJ_nkZMU5dC8";
const aHdr = {"Content-Type":"application/json",apikey:SB_KEY};
const dHdr = t => ({"Content-Type":"application/json",apikey:SB_KEY,Authorization:`Bearer ${t}`});
const sbSignUp  = (e,p) => fetch(`${SB_URL}/auth/v1/signup`,                        {method:"POST",headers:aHdr,body:JSON.stringify({email:e,password:p})}).then(r=>r.json());
const sbSignIn  = (e,p) => fetch(`${SB_URL}/auth/v1/token?grant_type=password`,      {method:"POST",headers:aHdr,body:JSON.stringify({email:e,password:p})}).then(r=>r.json());
const sbRefresh = rt    => fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {method:"POST",headers:aHdr,body:JSON.stringify({refresh_token:rt})}).then(r=>r.json());
const sbSignOut = t     => fetch(`${SB_URL}/auth/v1/logout`,{method:"POST",headers:dHdr(t)});
const dbLoad = async (t,k) => {
  try {
    const r=await fetch(`${SB_URL}/rest/v1/user_data?key=eq.${k}&select=value`,{headers:dHdr(t)});
    if(!r.ok){ console.error("dbLoad failed:",k,r.status); return null; }
    const d=await r.json();
    if(!Array.isArray(d)){ console.error("dbLoad unexpected response:",k,d); return null; }
    return d?.[0]?.value??null;
  } catch(e) { console.error("dbLoad error:",k,e); return null; }
};
const dbSave = async (t,uid,k,v) => {
  const doSave = async (token) => {
    // Use on_conflict to explicitly upsert on (user_id, key)
    const r = await fetch(
      `${SB_URL}/rest/v1/user_data?on_conflict=user_id,key`,
      {
        method:"POST",
        headers:{...dHdr(token),"Prefer":"resolution=merge-duplicates,return=minimal"},
        body:JSON.stringify({user_id:uid, key:k, value:v})
      }
    );
    return r;
  };
  try {
    let r = await doSave(t);
    if(r.status===401){
      const stored=await loadSession();
      if(stored?.refreshToken){
        const ref=await sbRefresh(stored.refreshToken);
        if(ref.access_token){
          await storeSession({token:ref.access_token,refreshToken:ref.refresh_token,userId:ref.user.id,email:ref.user.email});
          r = await doSave(ref.access_token);
        }
      }
    }
    if(!r.ok){
      const errText = await r.text();
      console.error("dbSave failed:",r.status,errText);
      return `Error ${r.status}: ${errText.slice(0,120)}`;
    }
    return true;
  } catch(e){ console.error("dbSave error:",e); return "Network error — check connection"; }
};
const storeSession = async s => { try { localStorage.setItem("gym:sess", JSON.stringify(s)); } catch {} };
const loadSession  = async () => { try { const r=localStorage.getItem("gym:sess"); return r?JSON.parse(r):null; } catch { return null; } };
const clearSession = async () => { try { localStorage.removeItem("gym:sess"); } catch {} };

// ─── Exercises ────────────────────────────────────────────────────────────────
const DEFAULT_EXERCISES = [
  {id:"e1",muscle:"Chest",name:"Flat Smith Press"},{id:"e2",muscle:"Chest",name:"Incline Smith Press"},{id:"e3",muscle:"Chest",name:"High Incline DB Press"},{id:"e4",muscle:"Chest",name:"Flat DB Press"},{id:"e5",muscle:"Chest",name:"Pec Fly"},{id:"e6",muscle:"Chest",name:"Cable Fly"},{id:"e7",muscle:"Chest",name:"Machine Fly"},{id:"e8",muscle:"Chest",name:"Press Ups"},{id:"e9a",muscle:"Chest",name:"Flat Barbell Bench Press"},{id:"e9b",muscle:"Chest",name:"Incline Barbell Press"},{id:"e9c",muscle:"Chest",name:"Decline DB Press"},{id:"e9d",muscle:"Chest",name:"Dips (Chest)"},{id:"e9e",muscle:"Chest",name:"Low Cable Fly"},{id:"e9f",muscle:"Chest",name:"DB Pullover"},{id:"e9g",muscle:"Chest",name:"Landmine Press"},{id:"e9h",muscle:"Chest",name:"Machine Chest Press"},
  {id:"e10",muscle:"Back",name:"Chest Supported Row"},{id:"e11",muscle:"Back",name:"SA Pulldown"},{id:"e12",muscle:"Back",name:"SA Row (Machine)"},{id:"e13",muscle:"Back",name:"Straight Arm Pull"},{id:"e14",muscle:"Back",name:"Rope High to Low Pull"},{id:"e15",muscle:"Back",name:"Lat Pulldown"},{id:"e16",muscle:"Back",name:"Pull Up"},{id:"e17",muscle:"Back",name:"Barbell Row"},{id:"e18",muscle:"Back",name:"Seated Cable Row"},{id:"e19",muscle:"Back",name:"T-Bar Row"},{id:"e19a",muscle:"Back",name:"Single Arm DB Row"},{id:"e19b",muscle:"Back",name:"Inverted Row"},{id:"e19c",muscle:"Back",name:"Deadlift"},{id:"e19d",muscle:"Back",name:"Rack Pull"},{id:"e19e",muscle:"Back",name:"Close Grip Lat Pulldown"},{id:"e19f",muscle:"Back",name:"Meadows Row"},{id:"e19g",muscle:"Back",name:"Hammer Strength Row"},{id:"e19h",muscle:"Back",name:"Cable Pullover"},
  {id:"e20",muscle:"Shoulders",name:"Cable Laterals"},{id:"e21",muscle:"Shoulders",name:"Rear Delt Fly"},{id:"e22",muscle:"Shoulders",name:"Machine Rear Fly"},{id:"e23",muscle:"Shoulders",name:"DB Shoulder Press"},{id:"e24",muscle:"Shoulders",name:"Lateral Raises"},{id:"e25",muscle:"Shoulders",name:"Rope Face Pull"},{id:"e26",muscle:"Shoulders",name:"Rope Upright Row"},{id:"e27",muscle:"Shoulders",name:"Arnold Press"},{id:"e28",muscle:"Shoulders",name:"Barbell Shrug"},{id:"e29",muscle:"Shoulders",name:"Machine OHP"},{id:"e29a",muscle:"Shoulders",name:"DB Front Raise"},{id:"e29b",muscle:"Shoulders",name:"Cable Front Raise"},{id:"e29c",muscle:"Shoulders",name:"Bent Over Lateral Raise"},{id:"e29d",muscle:"Shoulders",name:"Barbell OHP"},{id:"e29e",muscle:"Shoulders",name:"Smith OHP"},{id:"e29f",muscle:"Shoulders",name:"W Raise"},{id:"e29g",muscle:"Shoulders",name:"Band Pull Apart"},{id:"e29h",muscle:"Shoulders",name:"DB Upright Row"},
  {id:"e30",muscle:"Biceps",name:"Incline DB Curls"},{id:"e31",muscle:"Biceps",name:"SA Preacher"},{id:"e32",muscle:"Biceps",name:"Cable Curl"},{id:"e33",muscle:"Biceps",name:"DB Curl"},{id:"e34",muscle:"Biceps",name:"Rope Hammer Curls"},{id:"e35",muscle:"Biceps",name:"Standing EZ Curls"},{id:"e36",muscle:"Biceps",name:"Concentration Curl"},{id:"e37",muscle:"Biceps",name:"Spider Curls"},{id:"e38",muscle:"Biceps",name:"Reverse Curl"},{id:"e39",muscle:"Biceps",name:"Zottman Curl"},{id:"e39a",muscle:"Biceps",name:"Bayesian Curl"},{id:"e39b",muscle:"Biceps",name:"Machine Curl"},{id:"e39c",muscle:"Biceps",name:"High Cable Curl"},{id:"e39d",muscle:"Biceps",name:"Cross Body Hammer Curl"},{id:"e39e",muscle:"Biceps",name:"Barbell Curl"},{id:"e39f",muscle:"Biceps",name:"21s"},
  {id:"e40",muscle:"Triceps",name:"OH Tricep Cable (Seated)"},{id:"e41",muscle:"Triceps",name:"Smith JM Press"},{id:"e42",muscle:"Triceps",name:"Rope Tricep Ext"},{id:"e43",muscle:"Triceps",name:"Cross Body Tri Ext"},{id:"e44",muscle:"Triceps",name:"OH EZ Tricep"},{id:"e45",muscle:"Triceps",name:"Tricep Press Ups"},{id:"e46",muscle:"Triceps",name:"Rope Tri Ext"},{id:"e47",muscle:"Triceps",name:"Skullcrusher"},{id:"e48",muscle:"Triceps",name:"Cable Pushdown (Bar)"},{id:"e49",muscle:"Triceps",name:"Close Grip Bench Press"},{id:"e49a",muscle:"Triceps",name:"Dips (Tricep)"},{id:"e49b",muscle:"Triceps",name:"DB Tricep Kickback"},{id:"e49c",muscle:"Triceps",name:"Tate Press"},{id:"e49d",muscle:"Triceps",name:"DB OH Tricep Extension"},
  {id:"e50",muscle:"Quads",name:"Leg Extension"},{id:"e51",muscle:"Quads",name:"Leg Press"},{id:"e52",muscle:"Quads",name:"Squat"},{id:"e53",muscle:"Quads",name:"Hack Squat"},{id:"e54",muscle:"Quads",name:"Goblet Squat"},{id:"e55",muscle:"Quads",name:"Bulgarian Split Squat"},{id:"e56",muscle:"Quads",name:"Walking Lunges"},{id:"e57",muscle:"Quads",name:"Reverse Lunge"},{id:"e58",muscle:"Quads",name:"Step Ups"},{id:"e59",muscle:"Quads",name:"Front Squat"},{id:"e59a",muscle:"Quads",name:"Sissy Squat"},{id:"e59b",muscle:"Quads",name:"Smith Squat"},{id:"e59c",muscle:"Quads",name:"Single Leg Leg Extension"},{id:"e59d",muscle:"Quads",name:"Cyclist Squat"},
  {id:"e60",muscle:"Hamstrings",name:"RDL"},{id:"e61",muscle:"Hamstrings",name:"Seated Ham Curl"},{id:"e62",muscle:"Hamstrings",name:"Pendulum"},{id:"e63",muscle:"Hamstrings",name:"Leg Curl (Lying)"},{id:"e64",muscle:"Hamstrings",name:"Nordic Ham Curl"},{id:"e65",muscle:"Hamstrings",name:"Single Leg RDL"},{id:"e66",muscle:"Hamstrings",name:"Good Mornings"},{id:"e67",muscle:"Hamstrings",name:"Stiff Leg Deadlift"},{id:"e68",muscle:"Hamstrings",name:"Sumo Deadlift"},{id:"e69",muscle:"Hamstrings",name:"Single Leg Curl (Lying)"},
  {id:"e70",muscle:"Glutes",name:"Hip Thrust"},{id:"e71",muscle:"Glutes",name:"Single Leg Hip Thrust"},{id:"e72",muscle:"Glutes",name:"Glute Kickback"},{id:"e73",muscle:"Glutes",name:"Cable Pull Through"},{id:"e74",muscle:"Glutes",name:"Reverse Hyperextension"},{id:"e74a",muscle:"Glutes",name:"Machine Hip Abduction"},{id:"e74b",muscle:"Glutes",name:"Banded Hip Thrust"},{id:"e74c",muscle:"Glutes",name:"Sumo Squat"},{id:"e74d",muscle:"Glutes",name:"Donkey Kick"},
  {id:"e75",muscle:"Adductors",name:"Adductor Machine"},{id:"e76",muscle:"Adductors",name:"Cossack Squat"},{id:"e77",muscle:"Adductors",name:"Cable Hip Adduction"},{id:"e78",muscle:"Adductors",name:"Copenhagen Plank"},{id:"e79",muscle:"Adductors",name:"Side Lying Hip Adduction"},
  {id:"e80",muscle:"Calves",name:"Calf Raises"},{id:"e81",muscle:"Calves",name:"Seated Calf Raises"},{id:"e82",muscle:"Calves",name:"Single Leg Calf Raise"},{id:"e83",muscle:"Calves",name:"Leg Press Calf Raise"},{id:"e84",muscle:"Calves",name:"Donkey Calf Raise"},{id:"e85",muscle:"Calves",name:"Tibialis Raise"},{id:"e86",muscle:"Calves",name:"Smith Machine Calf Raise"},
  {id:"e90",muscle:"Core",name:"Roll Outs"},{id:"e91",muscle:"Core",name:"Swiss Ball Cable Crunch"},{id:"e92",muscle:"Core",name:"Leg Raises"},{id:"e93",muscle:"Core",name:"Plank"},{id:"e94",muscle:"Core",name:"Cable Crunch"},{id:"e95",muscle:"Core",name:"Hanging Leg Raise"},{id:"e96",muscle:"Core",name:"Dead Bug"},{id:"e97",muscle:"Core",name:"Pallof Press"},{id:"e98",muscle:"Core",name:"Russian Twist"},{id:"e99",muscle:"Core",name:"Side Plank"},{id:"e99a",muscle:"Core",name:"Decline Sit Up"},{id:"e99b",muscle:"Core",name:"Hollow Body Hold"},{id:"e99c",muscle:"Core",name:"Windshield Wipers"},{id:"e99d",muscle:"Core",name:"V-Up"},{id:"e99e",muscle:"Core",name:"Bicycle Crunch"},{id:"e99f",muscle:"Core",name:"Farmers Carry"},
  {id:"t1",muscle:"Traps",name:"DB Shrug"},{id:"t2",muscle:"Traps",name:"Barbell Shrug"},{id:"t3",muscle:"Traps",name:"Behind Back Shrug"},{id:"t4",muscle:"Traps",name:"Cable Shrug"},{id:"t5",muscle:"Traps",name:"Rack Pull"},{id:"t6",muscle:"Traps",name:"Face Pull"},{id:"t7",muscle:"Traps",name:"Power Clean"},
  {id:"f1",muscle:"Forearms",name:"Wrist Curls"},{id:"f2",muscle:"Forearms",name:"Reverse Wrist Curls"},{id:"f3",muscle:"Forearms",name:"Hammer Curls"},{id:"f4",muscle:"Forearms",name:"Reverse Barbell Curl"},{id:"f5",muscle:"Forearms",name:"Behind Back Wrist Curl"},{id:"f6",muscle:"Forearms",name:"Cable Reverse Curl"},{id:"f7",muscle:"Forearms",name:"Plate Pinch"},
];
const MUSCLES = [...new Set(DEFAULT_EXERCISES.map(e=>e.muscle))];
const MC = {Chest:"#ff6b35",Back:"#4ecdc4",Shoulders:"#f0a060",Biceps:"#f472b6",Triceps:"#fb923c",Quads:"#34d399",Hamstrings:"#60a5fa",Glutes:"#f59e0b",Adductors:"#e879f9",Calves:"#94a3b8",Core:"#fbbf24",Traps:"#38bdf8",Forearms:"#d97706"};
const est1RM = (w,r) => (!w||!r||r<=0)?0:r===1?w:Math.round(w*(1+r/30));
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const fmtDateShort = d => new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  dumbbell:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:18,height:18}}><path d="M6 5v14M18 5v14M9 8H6M18 8h-3M9 16H6M18 16h-3"/><rect x="3" y="7" width="3" height="10" rx="1"/><rect x="18" y="7" width="3" height="10" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
  plan:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:18,height:18}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
  today:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:18,height:18}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  trophy:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:18,height:18}}><polyline points="8 22 12 18 16 22"/><path d="M5 2h14l-2 9H7L5 2z"/><path d="M5 7H3a2 2 0 0 0 0 4h2"/><path d="M19 7h2a2 2 0 0 0 0 4h-2"/><line x1="12" y1="18" x2="12" y2="15"/></svg>,
  calories:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:18,height:18}}><path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 9H9c-1-3-4-5-4-9a7 7 0 0 1 7-7z"/><path d="M9 21h6"/><path d="M9.7 17h4.6"/></svg>,
  scale:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:18,height:18}}><path d="M12 3v1"/><path d="M3 9h18"/><path d="M5 9l2 9h10l2-9"/><circle cx="12" cy="6" r="3"/></svg>,
  plus:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:16,height:16}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  x:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:13,height:13}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><polyline points="20 6 9 17 4 12"/></svg>,
  back:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:20,height:20}}><polyline points="15 18 9 12 15 6"/></svg>,
  search:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:15,height:15}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  fire:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:13,height:13}}><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>,
  edit:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:13,height:13}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  logout:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:16,height:16}}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  home:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:18,height:18}}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  trash:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:13,height:13}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  target:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:14,height:14}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const css=`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body{background:#1a1a1e;color:#e8e4dc;font-family:'Barlow',sans-serif;font-size:15px;line-height:1.4;overscroll-behavior:none;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#2a2a30;border-radius:2px;}
input,select{font-family:'Barlow',sans-serif;font-size:15px;outline:none;color:#e8e4dc;}
input[type=number]::-webkit-inner-spin-button{opacity:1;}
@keyframes pop{0%{transform:scale(.8)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;

const base={display:"flex",flexDirection:"column",height:"100dvh",maxWidth:480,margin:"0 auto",background:"#1a1a1e",overflow:"hidden"};
const inp={background:"#323238",border:"1px solid #2a2a32",borderRadius:7,padding:"11px 14px",color:"#f0ece6",width:"100%",fontSize:15};
const setInp={background:"#323238",border:"1px solid #2a2a32",borderRadius:6,padding:"8px 6px",color:"#f0ece6",textAlign:"center",width:"100%",fontSize:16};
const card={background:"#28282e",border:"1px solid #1e1e24",borderRadius:10,marginBottom:10,overflow:"hidden"};
const btn=(v="primary")=>({display:"inline-flex",alignItems:"center",gap:6,padding:"10px 16px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:0.5,textTransform:"uppercase",
  ...(v==="primary"?{background:"#e8621a",color:"#1a1a1e"}:v==="ghost"?{background:"transparent",color:"#9a9aa2",border:"1px solid #2a2a32"}:v==="danger"?{background:"transparent",color:"#ff5555",border:"1px solid #3a2020"}:{background:"#3a3a42",color:"#f0ece6"})});
const lbl={fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#72727c",display:"block",marginBottom:5};
const statBox=(color="#e8621a")=>({background:"#26262c",border:`1px solid ${color}22`,borderRadius:8,padding:"12px 14px",flex:1});

function MuscleChip({muscle}){return <span style={{fontSize:10,background:(MC[muscle]||"#72727c")+"22",color:MC[muscle]||"#72727c",padding:"2px 6px",borderRadius:3,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase"}}>{muscle}</span>;}
function MuscleFilter({active,onChange}){return(<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:12}}>{["All",...MUSCLES].map(m=><button key={m} onClick={()=>onChange(m)} style={{flexShrink:0,padding:"5px 10px",borderRadius:5,border:"1px solid",fontSize:11,fontWeight:700,letterSpacing:0.5,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",background:active===m?(MC[m]||"#e8621a"):"transparent",color:active===m?"#1a1a1e":"#72727c",borderColor:active===m?(MC[m]||"#e8621a"):"#44444c"}}>{m}</button>)}</div>);}
function Divider(){return <div style={{height:1,background:"#323238",margin:"4px 0"}}/>;}
function SectionHead({label}){return <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:"#606068",textTransform:"uppercase",marginBottom:10,marginTop:4}}>{label}</div>;}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [session,setSession]=useState(null);
  const [booting,setBooting]=useState(true);
  useEffect(()=>{(async()=>{const s=await loadSession();if(s?.refreshToken){const r=await sbRefresh(s.refreshToken);if(r.access_token){const ns={token:r.access_token,refreshToken:r.refresh_token,userId:r.user.id,email:r.user.email};setSession(ns);await storeSession(ns);}}setBooting(false);})();},[]);
  const handleAuth=useCallback(async s=>{setSession(s);await storeSession(s);},[]);
  const handleLogout=useCallback(async()=>{if(session?.token)await sbSignOut(session.token);await clearSession();setSession(null);},[session]);
  if(booting)return(<><style>{css}</style><div style={{...base,alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,letterSpacing:3,color:"#e8621a"}}>LOADING…</div></div></>);
  if(!session)return <AuthScreen onAuth={handleAuth}/>;
  return <MainApp session={session} onLogout={handleLogout}/>;
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const submit=async()=>{
    setError("");
    if(!email||!password){setError("Please fill in all fields.");return;}
    if(mode==="register"&&password!==confirm){setError("Passwords don't match.");return;}
    if(password.length<6){setError("Password must be at least 6 characters.");return;}
    setLoading(true);
    try{
      let res;
      if(mode==="register"){res=await sbSignUp(email,password);if(res.error||res.msg){setError(res.error?.message||res.msg||"Registration failed.");setLoading(false);return;}res=await sbSignIn(email,password);}
      else{res=await sbSignIn(email,password);}
      if(!res.access_token){setError(res.error?.message||res.error_description||"Invalid email or password.");setLoading(false);return;}
      onAuth({token:res.access_token,refreshToken:res.refresh_token,userId:res.user.id,email:res.user.email});
    }catch{setError("Network error. Please try again.");}
    setLoading(false);
  };
  return(<><style>{css}</style>
    <div style={{...base,alignItems:"center",justifyContent:"center",padding:"0 24px"}}>
      <div style={{width:"100%",maxWidth:360,animation:"fadeIn .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:34,letterSpacing:2,color:"#e8621a",lineHeight:1}}>THE REEL NEIL</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:400,fontSize:16,letterSpacing:5,color:"#606068",textTransform:"uppercase",marginTop:4}}>Fitness</div>
          <a href="https://www.instagram.com/the_reel_neil" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:7,marginTop:14,padding:"7px 16px",borderRadius:20,background:"linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)",textDecoration:"none"}}>
            <span style={{fontSize:13}}>{"📸"}</span>
            <span style={{fontSize:12,fontWeight:700,color:"white",letterSpacing:0.5,fontFamily:"'Barlow',sans-serif"}}>{"@the_reel_neil"}</span>
          </a>
        </div>
        <div style={{display:"flex",background:"#28282e",border:"1px solid #1e1e24",borderRadius:8,marginBottom:22,padding:3}}>
          {["login","register"].map(m=><button key={m} onClick={()=>{setMode(m);setError("");}} style={{flex:1,padding:"9px",border:"none",borderRadius:6,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:0.5,textTransform:"uppercase",background:mode===m?"#e8621a":"transparent",color:mode===m?"#1a1a1e":"#72727c"}}>{m==="login"?"Sign In":"Register"}</button>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><label style={lbl}>Email</label><input style={inp} type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div><label style={lbl}>Password</label><input style={inp} type="password" placeholder="Min. 6 characters" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          {mode==="register"&&<div><label style={lbl}>Confirm Password</label><input style={inp} type="password" placeholder="Repeat password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>}
          {error&&<div style={{background:"#2a1010",border:"1px solid #4a2020",borderRadius:7,padding:"10px 14px",fontSize:13,color:"#ff8080"}}>{error}</div>}
          <button style={{...btn("primary"),justifyContent:"center",padding:"13px",marginTop:2}} onClick={submit} disabled={loading}>{loading?"Please wait…":mode==="login"?"Sign In":"Create Account"}</button>
        </div>
      </div>
    </div></>);
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function MainApp({session,onLogout}){
  const [tab,setTab]=useState("home");
  const [exercises,setExercises]=useState(null);
  const [plans,setPlans]=useState(null);
  const [activePlanId,setActivePlanId]=useState(null);
  const [currentWeek,setCurrentWeek]=useState(1);
  const [logs,setLogs]=useState({});
  const [pbs,setPbs]=useState({});
  const [calProfile,setCalProfile]=useState(null);
  const [customMacros,setCustomMacros]=useState(null);
  const [weightData,setWeightData]=useState(null);
  const [userName,setUserName]=useState("");
  const [ready,setReady]=useState(false);
  const [sessionDay,setSessionDay]=useState(null);
  const [syncing,setSyncing]=useState(false);
  const {token,userId}=session;

  // Auto-refresh token every 50 minutes to prevent expiry mid-session
  useEffect(()=>{
    const interval=setInterval(async()=>{
      const stored=await loadSession();
      if(stored?.refreshToken){
        const r=await sbRefresh(stored.refreshToken);
        if(r.access_token){
          const ns={token:r.access_token,refreshToken:r.refresh_token,userId:r.user.id,email:r.user.email};
          await storeSession(ns);
          // Force re-render with new token by reloading session data
          window.location.reload();
        }
      }
    }, 50*60*1000);
    return ()=>clearInterval(interval);
  },[]);

  useEffect(()=>{(async()=>{
    const [ex,pl,ap,cw,lg,pb,cp,wd,un,cm]=await Promise.all([dbLoad(token,"exercises"),dbLoad(token,"plans"),dbLoad(token,"active_plan"),dbLoad(token,"current_week"),dbLoad(token,"logs"),dbLoad(token,"pbs"),dbLoad(token,"cal_profile"),dbLoad(token,"weight_data"),dbLoad(token,"user_name"),dbLoad(token,"custom_macros")]);
    const loadedPlans=pl||[];
    const loadedLogs=lg||{};
    const loadedAp=ap||null;

    // Smart week: auto-detect based on logged sessions
    let smartWeek=1;
    if(loadedAp && loadedLogs[loadedAp]){
      const loggedWeeks=Object.keys(loadedLogs[loadedAp]).map(Number).filter(w=>{
        const dayLogs=loadedLogs[loadedAp][w]||{};
        return Object.values(dayLogs).some(sets=>Array.isArray(sets)&&sets.some(s=>s.weight||s.reps));
      });
      if(loggedWeeks.length>0){
        const lastLogged=Math.max(...loggedWeeks);
        const plan=loadedPlans.find(p=>p.id===loadedAp);
        smartWeek=Math.min(lastLogged+1,plan?.weeks||12);
      }
    }

    setExercises(ex||DEFAULT_EXERCISES);setPlans(loadedPlans);setActivePlanId(loadedAp);
    setCurrentWeek(smartWeek);setLogs(loadedLogs);setPbs(pb||{});
    setCalProfile(cp||null);setWeightData(wd||{entries:[],targetWeight:null});
    // Load name from Supabase, fall back to localStorage if not set
    const localName=localStorage.getItem("rnf:userName")||"";
    setUserName(un||localName||"");
    setCustomMacros(cm||null);
    setReady(true);
  })();},[token]);

  const [saveError,setSaveError]=useState("");
  const sf=useCallback(async(k,v)=>{
    setSyncing(true);setSaveError("");
    const result=await dbSave(token,userId,k,v);
    if(result!==true){
      const msg=typeof result==="string"?result:"Save failed — check connection";
      setSaveError("⚠️ "+msg);
      setTimeout(()=>setSaveError(""),6000);
    }
    setSyncing(false);
  },[token,userId]);
  const savePlans    =useCallback(async p=>{
    setPlans(prev=>{
      const next=typeof p==="function"?p(prev):p;
      // Schedule save outside state updater to avoid React StrictMode double-calls
      setTimeout(()=>sf("plans",next),0);
      return next;
    });
  },[sf]);
  const saveActive   =useCallback(async id=>{setActivePlanId(id);await sf("active_plan",id);},[sf]);
  const saveWeek     =useCallback(async w=>{setCurrentWeek(w);   await sf("current_week",w);},[sf]);
  const saveLogs     =useCallback(async l=>{setLogs(l);          await sf("logs",l);},[sf]);
  const savePbs      =useCallback(async p=>{setPbs(p);           await sf("pbs",p);},[sf]);
  const saveExercises=useCallback(async e=>{setExercises(e);     await sf("exercises",e);},[sf]);
  const saveCustomMacros=useCallback(async m=>{setCustomMacros(m); await sf("custom_macros",m);},[sf]);
  const saveUserName =useCallback(async n=>{
    setUserName(n);
    // Save to localStorage immediately as backup
    try{localStorage.setItem("rnf:userName",n);}catch{}
    await sf("user_name",n);
  },[sf]);
  const saveCalProfile=useCallback(async p=>{setCalProfile(p);   await sf("cal_profile",p);},[sf]);
  const saveWeightData=useCallback(async d=>{setWeightData(d);   await sf("weight_data",d);},[sf]);

  const activePlan=plans?.find(p=>p.id===activePlanId);
  const exMap=Object.fromEntries((exercises||[]).map(e=>[e.id,e]));

  if(!ready)return(<><style>{css}</style><div style={{...base,alignItems:"center",justifyContent:"center",gap:8}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,letterSpacing:2,color:"#e8621a"}}>SYNCING…</div><div style={{fontSize:12,color:"#505058"}}>Loading your data</div></div></>);
  if(sessionDay!==null)return(<><style>{css}</style><SessionLogger day={activePlan?.days[sessionDay]} dayIdx={sessionDay} plan={activePlan} week={currentWeek} logs={logs} pbs={pbs} exMap={exMap} onLog={async(nl,np)=>{await saveLogs(nl);await savePbs(np);}} onBack={()=>setSessionDay(null)}/></>);

  const TABS=[["home","HOME",Ic.home],["today","TRAIN",Ic.today],["plans","PLANS",Ic.plan],["exercises","GYM",Ic.dumbbell],["pbs","PBs",Ic.trophy],["calories","CALS",Ic.calories],["weight","WEIGHT",Ic.scale]];

  return(<><style>{css}</style>
    <div style={base}>
      <div style={{padding:"12px 16px 10px",borderBottom:"1px solid #1e1e24",background:"#212126",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icon-192.png" alt="RNF" style={{width:36,height:36,borderRadius:8,flexShrink:0}}/>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,letterSpacing:1,color:"#f0ece6",textTransform:"uppercase"}}>The Reel Neil Fitness</div>
              <div style={{fontSize:10,color:"#72727c",marginTop:1}}>{userName||session.email}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {syncing&&<div style={{fontSize:10,color:"#72727c",fontWeight:600,letterSpacing:0.5}}>SAVING…</div>}
            {saveError&&<div style={{fontSize:10,color:"#ff6060",fontWeight:600,maxWidth:120,textAlign:"right"}}>{saveError}</div>}
            {!syncing&&!saveError&&<div style={{fontSize:10,color:"#34d399",fontWeight:600,letterSpacing:0.5,opacity:0}}>✓</div>}
            {activePlan&&<div style={{background:"#e8621a",color:"#1a1a1e",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,padding:"3px 8px",borderRadius:3,letterSpacing:1}}>WK {currentWeek}</div>}
            <a href="https://www.instagram.com/the_reel_neil" target="_blank" rel="noopener noreferrer"
  style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:7,background:"linear-gradient(135deg,#405de6,#5851db,#833ab4,#c13584,#e1306c,#fd1d1d,#f56040,#f77737,#fcaf45,#ffdc80)",textDecoration:"none",flexShrink:0}}>
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:17,height:17}}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
  </svg>
</a>
<button style={{...btn("ghost"),padding:"6px 9px"}} onClick={onLogout}>{Ic.logout}</button>
          </div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden"}}>
        {tab==="home"     &&<HomeTab session={session} activePlan={activePlan} currentWeek={currentWeek} logs={logs} pbs={pbs} exMap={exMap} weightData={weightData} calProfile={calProfile} onGoToToday={()=>setTab("today")} onStartSession={setSessionDay} userName={userName} onSaveUserName={saveUserName}/>}
        {tab==="today"    &&<TodayTab activePlan={activePlan} currentWeek={currentWeek} logs={logs} exMap={exMap} onStartSession={setSessionDay} onWeekChange={saveWeek} onSelectPlan={()=>setTab("plans")}/>}
        {tab==="plans"    &&<PlansTab plans={plans} exercises={exercises} activePlanId={activePlanId} exMap={exMap} onActivate={saveActive} onSavePlans={savePlans}/>}
        {tab==="exercises"&&<ExercisesTab exercises={exercises} onSave={saveExercises}/>}
        {tab==="pbs"      &&<PBsTab pbs={pbs} exMap={exMap}/>}
        {tab==="calories" &&<CaloriesTab profile={calProfile} onSave={saveCalProfile} customMacros={customMacros} onSaveMacros={saveCustomMacros}/>}
        {tab==="weight"   &&<WeightTab data={weightData} onSave={saveWeightData}/>}
      </div>
      <nav style={{borderTop:"1px solid #1e1e24",background:"#212126",flexShrink:0}}>
        <div style={{display:"flex",borderBottom:"1px solid #2a2a30"}}>
          {TABS.slice(0,4).map(([id,label,icon])=>(
            <button key={id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"7px 2px 7px",border:"none",background:"none",color:tab===id?"#e8621a":"#72727c",cursor:"pointer",fontSize:9,fontFamily:"'Barlow',sans-serif",fontWeight:600,letterSpacing:0.3,textTransform:"uppercase"}} onClick={()=>setTab(id)}>
              {icon}{label}
            </button>
          ))}
        </div>
        <div style={{display:"flex"}}>
          {TABS.slice(4).map(([id,label,icon])=>(
            <button key={id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"7px 2px 10px",border:"none",background:"none",color:tab===id?"#e8621a":"#72727c",cursor:"pointer",fontSize:9,fontFamily:"'Barlow',sans-serif",fontWeight:600,letterSpacing:0.3,textTransform:"uppercase"}} onClick={()=>setTab(id)}>
              {icon}{label}
            </button>
          ))}
        </div>
      </nav>
    </div></>);
}

// ─── Calorie Calculator Tab ───────────────────────────────────────────────────
const ACTIVITY_LEVELS=[
  {key:"sedentary",  label:"Sedentary",      desc:"Desk job, no exercise",       mult:1.2},
  {key:"light",      label:"Lightly Active", desc:"Exercise 1–3 days/week",      mult:1.375},
  {key:"moderate",   label:"Moderately Active",desc:"Exercise 3–5 days/week",   mult:1.55},
  {key:"very",       label:"Very Active",    desc:"Exercise 6–7 days/week",      mult:1.725},
  {key:"extreme",    label:"Extremely Active",desc:"Twice daily / physical job", mult:1.9},
];
const GOALS=[
  {key:"cut_fast",   label:"Cut — Fast",     desc:"~1kg/week loss",   adj:-1100,icon:"🔥"},
  {key:"cut_mod",    label:"Cut — Moderate", desc:"~0.5kg/week loss", adj:-550, icon:"🔻"},
  {key:"cut_slow",   label:"Cut — Slow",     desc:"~0.25kg/week loss",adj:-275, icon:"📉"},
  {key:"maintain",   label:"Maintain",       desc:"Stay the same",    adj:0,    icon:"⚖️"},
  {key:"bulk_slow",  label:"Bulk — Slow",    desc:"~0.25kg/week gain",adj:275,  icon:"📈"},
  {key:"bulk_mod",   label:"Bulk — Moderate",desc:"~0.5kg/week gain", adj:550,  icon:"💪"},
  {key:"bulk_fast",  label:"Bulk — Fast",    desc:"~1kg/week gain",   adj:1100, icon:"🚀"},
];
function calcNutrition(p){
  if(!p?.age||!p?.height||!p?.weight) return null;
  const bmr=p.gender==="female"?(10*p.weight)+(6.25*p.height)-(5*p.age)-161:(10*p.weight)+(6.25*p.height)-(5*p.age)+5;
  const act=ACTIVITY_LEVELS.find(a=>a.key===p.activityLevel)||ACTIVITY_LEVELS[2];
  const goal=GOALS.find(g=>g.key===p.goal)||GOALS[3];
  const tdee=Math.round(bmr*act.mult);
  const target=tdee+goal.adj;
  const protein=Math.round((target*0.3)/4);
  const fat=Math.round((target*0.28)/9);
  const carbs=Math.round((target-(protein*4)-(fat*9))/4);
  return{bmr:Math.round(bmr),tdee,target,protein,fat,carbs,goalAdj:goal.adj};
}

function CaloriesTab({profile,onSave,customMacros,onSaveMacros}){
  const [editing,setEditing]=useState(!profile);
  const [form,setForm]=useState(profile||{age:"",gender:"male",height:"",weight:"",activityLevel:"moderate",goal:"maintain"});
  const results=useMemo(()=>calcNutrition(profile),[profile]);

  // Adjustable macros — always sum to calorie target
  const base=useMemo(()=>results?{protein:results.protein,fat:results.fat,carbs:results.carbs}:null,[results]);
  const [macros,setMacros]=useState(customMacros||null);
  // Load custom macros from Supabase on first render, fall back to calculated base
  useEffect(()=>{
    if(customMacros){setMacros(customMacros);}
    else if(base&&!macros){setMacros({...base});}
  },[customMacros,base?.protein]);
  const m=macros||base||{protein:0,fat:0,carbs:0};
  const totalCals=results?.target||0;

  const slideMacro=(macro,newVal)=>{
    setMacros(prev=>{
      const p={...prev};
      const target=totalCals;
      if(macro==="protein"){
        p.protein=newVal;
        const remaining=Math.max(0,target-newVal*4);
        p.carbs=Math.max(0,Math.round((remaining/2)/4));
        p.fat=Math.max(0,Math.round((remaining/2)/9));
      } else if(macro==="fat"){
        p.fat=newVal;
        const remaining=Math.max(0,target-p.protein*4-newVal*9);
        p.carbs=Math.max(0,Math.round(remaining/4));
      } else if(macro==="carbs"){
        p.carbs=newVal;
        const remaining=Math.max(0,target-p.protein*4-newVal*4);
        p.fat=Math.max(0,Math.round(remaining/9));
      }
      // Save after a short delay to avoid saving on every pixel of drag
      clearTimeout(window._macroSaveTimer);
      window._macroSaveTimer=setTimeout(()=>onSaveMacros&&onSaveMacros(p),800);
      return p;
    });
  };

  const resetMacros=()=>{const b={...base};setMacros(b);onSaveMacros&&onSaveMacros(null);};
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const save=()=>{const p={...form,age:parseInt(form.age),height:parseInt(form.height),weight:parseFloat(form.weight)};if(!p.age||!p.height||!p.weight)return;onSave(p);setEditing(false);};

  if(editing||!profile)return(
    <div style={{padding:"14px 14px 32px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#f0ece6",letterSpacing:0.5}}>CALORIE CALCULATOR</div>
        {profile&&<button style={{...btn("ghost"),padding:"6px 10px"}} onClick={()=>setEditing(false)}>Cancel</button>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}><label style={lbl}>Age</label><input style={inp} type="number" placeholder="e.g. 30" value={form.age} onChange={e=>f("age",e.target.value)}/></div>
          <div style={{flex:1}}><label style={lbl}>Gender</label>
            <div style={{display:"flex",gap:6}}>
              {["male","female"].map(g=><button key={g} onClick={()=>f("gender",g)} style={{flex:1,padding:"10px",border:"1px solid",borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,textTransform:"uppercase",background:form.gender===g?"#e8621a":"#323238",color:form.gender===g?"#1a1a1e":"#72727c",borderColor:form.gender===g?"#e8621a":"#44444c"}}>{g}</button>)}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}><label style={lbl}>Height (cm)</label><input style={inp} type="number" placeholder="e.g. 178" value={form.height} onChange={e=>f("height",e.target.value)}/></div>
          <div style={{flex:1}}><label style={lbl}>Weight (kg)</label><input style={inp} type="number" step="0.1" placeholder="e.g. 85" value={form.weight} onChange={e=>f("weight",e.target.value)}/></div>
        </div>
        <div>
          <label style={lbl}>Activity Level</label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {ACTIVITY_LEVELS.map(a=>(
              <button key={a.key} onClick={()=>f("activityLevel",a.key)} style={{padding:"10px 14px",border:"1px solid",borderRadius:8,cursor:"pointer",textAlign:"left",background:form.activityLevel===a.key?"#2e1808":"#323238",borderColor:form.activityLevel===a.key?"#8a3c00":"#44444c"}}>
                <div style={{fontWeight:600,fontSize:14,color:form.activityLevel===a.key?"#e8621a":"#f0ece6"}}>{a.label}</div>
                <div style={{fontSize:11,color:"#606068",marginTop:2}}>{a.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>Goal</label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {GOALS.map(g=>(
              <button key={g.key} onClick={()=>f("goal",g.key)} style={{padding:"10px 14px",border:"1px solid",borderRadius:8,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,background:form.goal===g.key?"#2e1808":"#323238",borderColor:form.goal===g.key?"#8a3c00":"#44444c"}}>
                <span style={{fontSize:20}}>{g.icon}</span>
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:form.goal===g.key?"#e8621a":"#f0ece6"}}>{g.label}</div>
                  <div style={{fontSize:11,color:"#606068",marginTop:1}}>{g.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <button style={{...btn("primary"),justifyContent:"center",padding:"13px",marginTop:4}} onClick={save}>{Ic.check} Calculate</button>
      </div>
    </div>
  );

  const goal=GOALS.find(g=>g.key===profile.goal)||GOALS[3];
  const act=ACTIVITY_LEVELS.find(a=>a.key===profile.activityLevel)||ACTIVITY_LEVELS[2];
  const adjColor=results.goalAdj>0?"#34d399":results.goalAdj<0?"#f87171":"#e8621a";

  return(
    <div style={{padding:"14px 14px 32px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#f0ece6",letterSpacing:0.5}}>CALORIE CALCULATOR</div>
        <button style={{...btn("ghost"),padding:"6px 10px",fontSize:12}} onClick={()=>setEditing(true)}>{Ic.edit} Edit</button>
      </div>
      <div style={{fontSize:11,color:"#606068",marginBottom:20}}>{profile.age}yr · {profile.gender} · {profile.height}cm · {profile.weight}kg · {act.label}</div>

      {/* Main target */}
      <div style={{background:"linear-gradient(135deg,#1a2800,#0f1a00)",border:"1px solid #3a5a00",borderRadius:12,padding:"20px",marginBottom:14,textAlign:"center"}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"#c07040",textTransform:"uppercase",marginBottom:6}}>Daily Calorie Target</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:56,color:"#e8621a",lineHeight:1}}>{results.target.toLocaleString()}</div>
        <div style={{fontSize:12,color:"#c07040",marginTop:4}}>kcal / day</div>
        <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <span style={{fontSize:18}}>{goal.icon}</span>
          <span style={{fontSize:13,color:"#f0ece6",fontWeight:500}}>{goal.label}</span>
          {results.goalAdj!==0&&<span style={{fontSize:12,color:adjColor,fontWeight:600}}>({results.goalAdj>0?"+":""}{results.goalAdj} kcal)</span>}
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <div style={statBox("#f0a060")}><div style={{fontSize:10,color:"#88668e",fontWeight:700,letterSpacing:1,marginBottom:4}}>BMR</div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:22,color:"#f0a060"}}>{results.bmr.toLocaleString()}</div><div style={{fontSize:10,color:"#606068"}}>kcal at rest</div></div>
        <div style={statBox("#60a5fa")}><div style={{fontSize:10,color:"#446688",fontWeight:700,letterSpacing:1,marginBottom:4}}>TDEE</div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:22,color:"#60a5fa"}}>{results.tdee.toLocaleString()}</div><div style={{fontSize:10,color:"#606068"}}>maintenance</div></div>
      </div>

      {/* Macros */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <SectionHead label="Daily Macros"/>
        {macros&&JSON.stringify(macros)!==JSON.stringify(base)&&(
          <button onClick={resetMacros} style={{fontSize:11,color:"#e8621a",fontWeight:700,background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:0.5,textTransform:"uppercase",paddingBottom:10}}>↺ Reset</button>
        )}
      </div>
      <div style={{fontSize:11,color:"#606068",marginBottom:12}}>Slide protein to adjust all macros equally. Slide carbs or fat to swap between them.</div>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
        {[
          ["PROTEIN", m.protein, 4, "#f472b6", "protein", Math.floor(totalCals/4)],
          ["CARBS",   m.carbs,   4, "#34d399", "carbs",   Math.floor((totalCals-m.protein*4)/4)],
          ["FAT",     m.fat,     9, "#fb923c", "fat",     Math.floor((totalCals-m.protein*4)/9)]
        ].map(([n,v,kcalPg,c,key,maxG])=>(
          <div key={n} style={{background:"#26262c",border:`1px solid ${c}33`,borderRadius:10,padding:"12px 14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:c,textTransform:"uppercase"}}>{n}</div>
              <div style={{textAlign:"right"}}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:c}}>{v}</span>
                <span style={{fontSize:11,color:"#606068"}}> g</span>
                <span style={{fontSize:11,color:"#505058",marginLeft:6}}>{v*kcalPg} kcal</span>
              </div>
            </div>
            <input type="range" min={0} max={Math.max(v,maxG)} step={1} value={v}
              onChange={e=>slideMacro(key,parseInt(e.target.value))}
              style={{width:"100%",accentColor:c,cursor:"pointer",height:22}}
            />
          </div>
        ))}
      </div>
      <div style={{...card,padding:"10px 14px",marginBottom:14,background:"#26262c"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:"#606068"}}>Total from macros</span>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,
            color:Math.abs((m.protein*4+m.fat*9+m.carbs*4)-totalCals)<=5?"#34d399":"#f87171"}}>
            {(m.protein*4+m.fat*9+m.carbs*4).toLocaleString()} / {totalCals.toLocaleString()} kcal
          </span>
        </div>
      </div>
      <div style={{...card,padding:"8px 12px",marginBottom:14,background:"#26262c"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:"#606068"}}>Total calories from macros</span>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:Math.abs((m.protein*4+m.fat*9+m.carbs*4)-totalCals)<20?"#34d399":"#f87171"}}>
            {(m.protein*4+m.fat*9+m.carbs*4).toLocaleString()} kcal
          </span>
        </div>
      </div>

      <div style={{...card,padding:14,background:"#26262c"}}>
        <div style={{fontSize:12,color:"#606068",lineHeight:1.7}}>
          These figures are calculated using the <span style={{color:"#9a9aa2"}}>Mifflin-St Jeor</span> equation and are a starting point — adjust based on how your body responds over 2–3 weeks. Weigh yourself daily and track averages in the Weight tab.
        </div>
      </div>
    </div>
  );
}

// ─── Weight Log Tab ───────────────────────────────────────────────────────────
function WeightTab({data,onSave}){
  const [weightInput,setWeightInput]=useState("");
  const [waistInput,setWaistInput]=useState("");
  const [dateInput,setDateInput]=useState(today());
  const [targetWeightInput,setTargetWeightInput]=useState(data?.targetWeight?.toString()||"");
  const [showAll,setShowAll]=useState(false);
  const [activeChart,setActiveChart]=useState("weight"); // "weight" | "waist"

  const entries=useMemo(()=>[...(data?.entries||[])].sort((a,b)=>b.date.localeCompare(a.date)),[data]);
  const sortedAsc=useMemo(()=>[...(data?.entries||[])].sort((a,b)=>a.date.localeCompare(b.date)),[data]);

  // weekly averages for weight and waist
  const weeklyAvgs=useMemo(()=>{
    const weeks={};
    sortedAsc.forEach(e=>{
      const d=new Date(e.date+"T12:00:00");
      const day=d.getDay();
      const monday=new Date(d);monday.setDate(d.getDate()-(day===0?6:day-1));
      const wk=monday.toISOString().slice(0,10);
      if(!weeks[wk])weeks[wk]={weights:[],waists:[]};
      weeks[wk].weights.push(e.weight);
      if(e.waist)weeks[wk].waists.push(e.waist);
    });
    return Object.entries(weeks).sort(([a],[b])=>a.localeCompare(b)).map(([wk,{weights,waists}])=>({
      week:wk,
      avg:Math.round((weights.reduce((s,w)=>s+w,0)/weights.length)*100)/100,
      waistAvg:waists.length?Math.round((waists.reduce((s,w)=>s+w,0)/waists.length)*10)/10:null,
      entries:weights.length
    }));
  },[sortedAsc]);

  const chartData=weeklyAvgs.map((w,i)=>({name:`Wk ${i+1}`,avg:w.avg,waist:w.waistAvg,week:fmtDateShort(w.week)}));

  const addEntry=()=>{
    const w=parseFloat(weightInput);
    if(!w||!dateInput)return;
    const waist=parseFloat(waistInput)||null;
    const existing=(data?.entries||[]).filter(e=>e.date!==dateInput);
    onSave({...data,entries:[...existing,{date:dateInput,weight:w,...(waist?{waist}:{})}]});
    setWeightInput("");setWaistInput("");setDateInput(today());
  };

  const removeEntry=(date)=>onSave({...data,entries:(data?.entries||[]).filter(e=>e.date!==date)});

  const saveTargets=()=>{
    const tw=parseFloat(targetWeightInput)||null;
    onSave({...data,targetWeight:tw});
  };

  const latest=entries[0];
  const startWeight=sortedAsc[0]?.weight;
  const currentWeight=latest?.weight;
  const totalChange=startWeight&&currentWeight?Math.round((currentWeight-startWeight)*10)/10:null;
  const toTarget=data?.targetWeight&&currentWeight?Math.round((currentWeight-data.targetWeight)*10)/10:null;

  const latestWaist=entries.find(e=>e.waist)?.waist;
  const startWaist=sortedAsc.find(e=>e.waist)?.waist;
  const waistChange=startWaist&&latestWaist?Math.round((latestWaist-startWaist)*10)/10:null;

  const hasWaist=entries.some(e=>e.waist);

  const displayed=showAll?entries:entries.slice(0,14);

  return(
    <div style={{padding:"14px 14px 32px"}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#f0ece6",letterSpacing:0.5,marginBottom:16}}>WEIGHT & MEASUREMENTS</div>

      {/* Log entry */}
      <div style={{...card,padding:14,marginBottom:14}}>
        <SectionHead label="Log Today"/>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1}}>
            <label style={lbl}>Weight (kg)</label>
            <input style={inp} type="number" step="0.1" placeholder="e.g. 85.4" value={weightInput} onChange={e=>setWeightInput(e.target.value)}/>
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Waist (cm)</label>
            <input style={inp} type="number" step="0.1" placeholder="Optional" value={waistInput} onChange={e=>setWaistInput(e.target.value)}/>
          </div>
        </div>
        <div style={{marginBottom:8}}>
          <label style={lbl}>Date</label>
          <input style={{...inp,boxSizing:"border-box"}} type="date" value={dateInput} onChange={e=>setDateInput(e.target.value)}/>
        </div>
        <button style={{...btn("primary"),width:"100%",justifyContent:"center",padding:"11px"}} onClick={addEntry}>{Ic.plus} Log Entry</button>
      </div>

      {entries.length>0&&(
        <>
          {/* Stats */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <div style={statBox("#e8621a")}>
              <div style={{fontSize:10,color:"#c07040",fontWeight:700,letterSpacing:1,marginBottom:4}}>WEIGHT</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:"#e8621a",lineHeight:1}}>{currentWeight}<span style={{fontSize:12,fontWeight:500}}>kg</span></div>
              {totalChange!==null&&<div style={{fontSize:10,color:totalChange<0?"#34d399":totalChange>0?"#f87171":"#606068",marginTop:3}}>{totalChange>0?"+":""}{totalChange}kg total</div>}
            </div>
            {hasWaist&&latestWaist&&(
              <div style={statBox("#a78bfa")}>
                <div style={{fontSize:10,color:"#7c6aaa",fontWeight:700,letterSpacing:1,marginBottom:4}}>WAIST</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:"#a78bfa",lineHeight:1}}>{latestWaist}<span style={{fontSize:12,fontWeight:500}}>cm</span></div>
                {waistChange!==null&&<div style={{fontSize:10,color:waistChange<0?"#34d399":waistChange>0?"#f87171":"#606068",marginTop:3}}>{waistChange>0?"+":""}{waistChange}cm total</div>}
              </div>
            )}
            {totalChange!==null&&!hasWaist&&(
              <div style={statBox(totalChange<0?"#34d399":totalChange>0?"#f87171":"#60a5fa")}>
                <div style={{fontSize:10,color:"#446688",fontWeight:700,letterSpacing:1,marginBottom:4}}>CHANGE</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:totalChange<0?"#34d399":totalChange>0?"#f87171":"#60a5fa",lineHeight:1}}>{totalChange>0?"+":""}{totalChange}<span style={{fontSize:12,fontWeight:500}}>kg</span></div>
                <div style={{fontSize:10,color:"#606068",marginTop:2}}>from {startWeight}kg</div>
              </div>
            )}
          </div>

          {/* Targets */}
          <div style={{...card,padding:14,marginBottom:14}}>
            <SectionHead label="Targets"/>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{flex:1}}>
                <label style={lbl}>Target Weight (kg)</label>
                <input style={inp} type="number" step="0.1" placeholder="e.g. 80.0" value={targetWeightInput} onChange={e=>setTargetWeightInput(e.target.value)}/>
              </div>
            </div>
            <button style={{...btn("primary"),width:"100%",justifyContent:"center",padding:"10px"}} onClick={saveTargets}>{Ic.check} Save Target</button>
            {data?.targetWeight&&toTarget!==null&&(
              <div style={{marginTop:10,padding:"9px 12px",background:"#2e1808",borderRadius:7,border:"1px solid #5a2c0a",display:"flex",alignItems:"center",gap:8}}>
                {Ic.target}<span style={{fontSize:13,color:toTarget<=0?"#34d399":"#f0ece6"}}>{toTarget<=0?"Weight goal reached! 🎉":`${Math.abs(toTarget)}kg to ${data.targetWeight}kg`}</span>
              </div>
            )}

          </div>

          {/* Chart toggle + chart */}
          {weeklyAvgs.length>1&&(
            <div style={{...card,padding:"14px 8px 14px 4px",marginBottom:14}}>
              <div style={{padding:"0 10px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#72727c",letterSpacing:1}}>WEEKLY TREND</div>
                {hasWaist&&(
                  <div style={{display:"flex",gap:4}}>
                    {[["weight","Weight"],["waist","Waist"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setActiveChart(k)} style={{padding:"4px 10px",borderRadius:5,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:activeChart===k?"#e8621a":"#323238",color:activeChart===k?"white":"#72727c"}}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{top:4,right:16,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a42" vertical={false}/>
                  <XAxis dataKey="week" tick={{fill:"#606068",fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#606068",fontSize:10}} axisLine={false} tickLine={false} domain={["auto","auto"]} width={36}/>
                  {activeChart==="weight"&&data?.targetWeight&&<ReferenceLine y={data.targetWeight} stroke="#34d399" strokeDasharray="4 4" strokeWidth={1.5}/>}

                  <Tooltip contentStyle={{background:"#323238",border:"1px solid #44444c",borderRadius:8,color:"#f0ece6",fontSize:12}} formatter={(v)=>[v?`${v}${activeChart==="weight"?"kg":"cm"}`:"No data","Avg"]} labelFormatter={l=>`Week: ${l}`}/>
                  {activeChart==="weight"&&<Line type="monotone" dataKey="avg" stroke="#e8621a" strokeWidth={2.5} dot={{fill:"#e8621a",strokeWidth:0,r:3}} activeDot={{r:5}} connectNulls/>}
                  {activeChart==="waist"&&<Line type="monotone" dataKey="waist" stroke="#a78bfa" strokeWidth={2.5} dot={{fill:"#a78bfa",strokeWidth:0,r:3}} activeDot={{r:5}} connectNulls/>}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly averages table */}
          {weeklyAvgs.length>0&&(
            <div style={{marginBottom:14}}>
              <SectionHead label={`Weekly Averages (${weeklyAvgs.length} weeks)`}/>
              <div style={card}>
                {[...weeklyAvgs].reverse().map((w,i)=>{
                  const prev=weeklyAvgs[weeklyAvgs.length-2-i];
                  const diff=prev?Math.round((w.avg-prev.avg)*100)/100:null;
                  const waistDiff=prev&&w.waistAvg&&prev.waistAvg?Math.round((w.waistAvg-prev.waistAvg)*10)/10:null;
                  return(
                    <div key={w.week} style={{padding:"10px 14px",borderTop:i===0?"none":"1px solid #141418"}}>
                      <div style={{display:"flex",alignItems:"center"}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13,color:"#f0ece6"}}>Wk of {fmtDate(w.week)}</div>
                          <div style={{fontSize:11,color:"#606068",marginTop:1}}>{w.entries} {w.entries===1?"entry":"entries"}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#e8621a"}}>{w.avg}<span style={{fontSize:10,fontWeight:400}}>kg</span></div>
                          {diff!==null&&<div style={{fontSize:10,color:diff<0?"#34d399":diff>0?"#f87171":"#606068"}}>{diff>0?"+":""}{diff}kg</div>}
                        </div>
                        {w.waistAvg&&<div style={{textAlign:"right",marginLeft:16}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#a78bfa"}}>{w.waistAvg}<span style={{fontSize:10,fontWeight:400}}>cm</span></div>
                          {waistDiff!==null&&<div style={{fontSize:10,color:waistDiff<0?"#34d399":waistDiff>0?"#f87171":"#606068"}}>{waistDiff>0?"+":""}{waistDiff}cm</div>}
                        </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily log */}
          <SectionHead label={`Daily Log (${entries.length} entries)`}/>
          <div style={card}>
            {displayed.map((e,i)=>{
              const next=entries[i+1];
              const diff=next?Math.round((e.weight-next.weight)*10)/10:null;
              return(
                <div key={e.date} style={{display:"flex",alignItems:"center",padding:"9px 14px",borderTop:i===0?"none":"1px solid #141418"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:14,color:"#f0ece6"}}>{fmtDate(e.date)}</div>
                    {diff!==null&&<div style={{fontSize:11,marginTop:1,color:diff<0?"#34d399":diff>0?"#f87171":"#606068"}}>{diff>0?"+":""}{diff}kg vs prev</div>}
                  </div>
                  <div style={{textAlign:"right",marginRight:8}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#f0ece6"}}>{e.weight}<span style={{fontSize:10,fontWeight:400}}>kg</span></div>
                    {e.waist&&<div style={{fontSize:11,color:"#a78bfa"}}>{e.waist}cm waist</div>}
                  </div>
                  <button style={{...btn("danger"),padding:"5px 7px"}} onClick={()=>removeEntry(e.date)}>{Ic.trash}</button>
                </div>
              );
            })}
            {entries.length>14&&(
              <div style={{padding:"10px 14px",borderTop:"1px solid #141418",textAlign:"center"}}>
                <button style={{...btn("ghost"),padding:"6px 16px",fontSize:12}} onClick={()=>setShowAll(!showAll)}>{showAll?"Show Less":`Show All ${entries.length} Entries`}</button>
              </div>
            )}
          </div>
        </>
      )}

      {entries.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#505058"}}>
          <div style={{fontSize:40,marginBottom:10}}>⚖️</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,color:"#44444c",marginBottom:6}}>No entries yet</div>
          <div style={{fontSize:13}}>Log your first weight and waist above to start tracking.</div>
        </div>
      )}
    </div>
  );
}

// ─── Today Tab ────────────────────────────────────────────────────────────────
function TodayTab({activePlan,currentWeek,logs,exMap,onStartSession,onWeekChange,onSelectPlan}){
  if(!activePlan)return(<div style={{padding:32,textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:800,color:"#3a3a42",marginBottom:12}}>NO ACTIVE PLAN</div><div style={{color:"#606068",marginBottom:24,fontSize:14}}>Create or activate a training plan to get started.</div><button style={{...btn("primary"),width:"100%",justifyContent:"center"}} onClick={onSelectPlan}>{Ic.plus} Create a Plan</button></div>);
  const focus=["Set Load","Beat Load","Increase Volume","Increase Volume","Increase Volume","DELOAD","Beat Week 1","Beat Week 2","Beat Week 3","Beat Week 4","Beat Week 5","DELOAD"][currentWeek-1]||"";
  return(<div style={{padding:"14px 14px 24px"}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button style={{...btn("ghost"),padding:"8px 12px"}} disabled={currentWeek<=1} onClick={()=>onWeekChange(currentWeek-1)}>‹</button>
      <div style={{flex:1,textAlign:"center"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:"#f0ece6"}}>WEEK {currentWeek}</div>
        {focus&&<div style={{fontSize:11,color:"#e8621a",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{focus}</div>}
      </div>
      <button style={{...btn("ghost"),padding:"8px 12px"}} disabled={currentWeek>=activePlan.weeks} onClick={()=>onWeekChange(currentWeek+1)}>›</button>
    </div>
    {activePlan.days.map((day,i)=>{
      const dayLog=logs?.[activePlan.id]?.[currentWeek]?.[i];
      const vol=dayLog?Object.values(dayLog).reduce((s,sets)=>s+sets.reduce((a,st)=>a+(st.weight*st.reps||0),0),0):0;
      return(<div key={i} style={{...card,border:dayLog?"1px solid #2a3a10":"1px solid #1e1e24"}}>
        <div style={{padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontSize:10,color:"#72727c",fontWeight:700,letterSpacing:1,textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif"}}>Day {i+1}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:20,color:"#f0ece6",marginTop:2}}>{day.name}</div>
            <div style={{fontSize:12,color:"#606068",marginTop:2}}>{day.exercises.length} exercises{dayLog&&<span style={{color:"#c04e10",marginLeft:8}}>· {Math.round(vol).toLocaleString()} kg vol</span>}</div>
                {dayLog?._notes&&<div style={{fontSize:11,color:"#72727c",marginTop:3,fontStyle:"italic"}}>"{dayLog._notes.slice(0,60)}{dayLog._notes.length>60?"…":""}"</div>}
          </div>
          <button style={{...btn(dayLog?"ghost":"primary"),padding:"10px 16px"}} onClick={()=>onStartSession(i)}>{dayLog?"View":"Start"}</button>
        </div>
        <div style={{padding:"0 14px 12px",display:"flex",flexWrap:"wrap",gap:5}}>
          {day.exercises.slice(0,6).map(ex=>{const e=exMap[ex.exerciseId];return e?<span key={ex.exerciseId} style={{fontSize:11,background:"#323238",border:"1px solid #2a2a30",borderRadius:4,padding:"3px 7px",color:"#9a9aa2"}}>{e.name}</span>:null;})}
          {day.exercises.length>6&&<span style={{fontSize:11,color:"#606068",padding:"3px 4px"}}>+{day.exercises.length-6} more</span>}
        </div>
      </div>);
    })}
  </div>);
}

// ─── Rest Timer (floating) ────────────────────────────────────────────────────
function RestTimer(){
  const PRESETS=[60,90,120,180];
  const [duration,setDuration]=useState(90);
  const [timeLeft,setTimeLeft]=useState(null);
  const [running,setRunning]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const intervalRef=useState(null);

  const start=(d)=>{
    if(intervalRef[0])clearInterval(intervalRef[0]);
    setTimeLeft(d);setRunning(true);
    const id=setInterval(()=>{
      setTimeLeft(t=>{
        if(t<=1){clearInterval(id);setRunning(false);return 0;}
        return t-1;
      });
    },1000);
    intervalRef[0]=id;
  };

  const stop=()=>{
    if(intervalRef[0])clearInterval(intervalRef[0]);
    setRunning(false);setTimeLeft(null);
  };

  const fmt=s=>`${Math.floor((s||0)/60)}:${String((s||0)%60).padStart(2,"0")}`;
  const pct=timeLeft!=null?timeLeft/duration:1;
  const r=22;const circ=2*Math.PI*r;
  const done=timeLeft===0;

  return(
    <div style={{position:"absolute",bottom:80,right:14,zIndex:100}}>
      {expanded&&(
        <div style={{background:"#212126",border:"1px solid #2a2a32",borderRadius:14,padding:14,marginBottom:8,minWidth:180,boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
          {/* Presets */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {PRESETS.map(p=>(
              <button key={p} onClick={()=>{setDuration(p);stop();}} style={{flex:1,padding:"5px 2px",background:duration===p?"#e8621a":"#323238",border:"1px solid",borderColor:duration===p?"#e8621a":"#44444c",borderRadius:6,color:duration===p?"#1a1a1e":"#9a9aa2",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif"}}>
                {p<60?`${p}s`:p===60?"1m":p===90?"1:30":p===120?"2m":"3m"}
              </button>
            ))}
          </div>
          {/* Timer display */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
            <svg width={60} height={60} style={{transform:"rotate(-90deg)"}}>
              <circle cx={30} cy={30} r={r} fill="none" stroke="#323238" strokeWidth={4}/>
              <circle cx={30} cy={30} r={r} fill="none" stroke={done?"#ff5555":running?"#e8621a":"#72727c"} strokeWidth={4}
                strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"
                style={{transition:"stroke-dashoffset 0.9s linear"}}/>
            </svg>
            <div style={{position:"absolute",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:done?"#ff5555":running?"#e8621a":"#f0ece6"}}>
              {done?"GO!":timeLeft!=null?fmt(timeLeft):fmt(duration)}
            </div>
          </div>
          {/* Controls */}
          {!running&&timeLeft===null&&<button style={{...btn("primary"),width:"100%",justifyContent:"center",padding:"9px"}} onClick={()=>start(duration)}>Start</button>}
          {running&&<button style={{...btn("ghost"),width:"100%",justifyContent:"center",padding:"9px"}} onClick={stop}>Stop</button>}
          {!running&&timeLeft!==null&&(
            <div style={{display:"flex",gap:6}}>
              <button style={{...btn("primary"),flex:1,justifyContent:"center",padding:"9px"}} onClick={()=>start(duration)}>Restart</button>
              <button style={{...btn("ghost"),flex:1,justifyContent:"center",padding:"9px"}} onClick={stop}>Clear</button>
            </div>
          )}
        </div>
      )}
      {/* Floating button */}
      <button onClick={()=>setExpanded(e=>!e)} style={{width:52,height:52,borderRadius:"50%",background:running?"#e8621a":done?"#ff5555":"#323238",border:`2px solid ${running?"#e8621a":done?"#ff5555":"#44444c"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(0,0,0,0.5)",flexDirection:"column",gap:1}}>
        <svg viewBox="0 0 24 24" fill="none" stroke={running?"#1a1a1e":done?"white":"#9a9aa2"} strokeWidth="2" strokeLinecap="round" style={{width:20,height:20}}>
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        {running&&<span style={{fontSize:9,fontWeight:800,color:"#1a1a1e",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1}}>{fmt(timeLeft)}</span>}
        {done&&<span style={{fontSize:9,fontWeight:800,color:"white",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1}}>GO!</span>}
      </button>
    </div>
  );
}

// ─── Session Logger ───────────────────────────────────────────────────────────
function SessionLogger({day,dayIdx,plan,week,logs,pbs,exMap,onLog,onBack}){
  const existing=logs?.[plan.id]?.[week]?.[dayIdx]||{};
  const prev=logs?.[plan.id]?.[week-1]?.[dayIdx]||{};
  const initSets={};
  day.exercises.forEach(ex=>{const total=ex.setConfigs.reduce((m,c)=>m+c.sets,0);initSets[ex.exerciseId]=existing[ex.exerciseId]||Array(total).fill(null).map(()=>({weight:"",reps:""}));});
  const [sets,setSets]=useState(initSets);
  const [newPbIds,setNewPbIds]=useState(new Set());
  const [saved,setSaved]=useState(false);
  const [exerciseInfo,setExerciseInfo]=useState(null);
  const [sessionNotes,setSessionNotes]=useState(existing._notes||"");
  const updateSet=(exId,si,field,val)=>{setSets(p=>({...p,[exId]:p[exId].map((s,i)=>i===si?{...s,[field]:val}:s)}));setNewPbIds(n=>{n.delete(exId);return new Set(n);});};
  const handleSave=async()=>{
    const np={...pbs};const tr=new Set();
    Object.entries(sets).forEach(([exId,exSets])=>exSets.forEach(s=>{const w=parseFloat(s.weight),r=parseInt(s.reps);if(!w||!r)return;const cur=np[exId];if(!cur||est1RM(w,r)>est1RM(cur.weight,cur.reps)){np[exId]={weight:w,reps:r,date:new Date().toISOString()};tr.add(exId);}}));
    setNewPbIds(tr);
    const sessionData={...sets,_notes:sessionNotes};
    await onLog({...logs,[plan.id]:{...(logs[plan.id]||{}),[week]:{...(logs[plan.id]?.[week]||{}),[dayIdx]:sessionData}}},np);
    setSaved(true);
  };
  return(<div style={{...base,position:"relative"}}>
    <div style={{padding:"12px 14px",borderBottom:"1px solid #1e1e24",background:"#212126",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button style={{...btn("ghost"),padding:"8px 10px"}} onClick={onBack}>{Ic.back}</button>
        <div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:"#f0ece6"}}>{day.name}</div>
          <div style={{fontSize:11,color:"#72727c",fontFamily:"'Barlow Condensed',sans-serif"}}>{plan.name} · WEEK {week}</div></div>
      </div>
    </div>
    <RestTimer/>
    <div style={{flex:1,overflowY:"auto",overflowX:"hidden"}}>
      {day.exercises.map(ex=>{
        const e=exMap[ex.exerciseId];if(!e)return null;
        const pb=pbs[ex.exerciseId],prevSets=prev[ex.exerciseId]||[],isNewPb=newPbIds.has(ex.exerciseId),exSets=sets[ex.exerciseId]||[];
        let labels=[];ex.setConfigs.forEach(cfg=>{for(let i=0;i<cfg.sets;i++)labels.push({reps:cfg.repsRange,note:cfg.note});});
        return(<div key={ex.exerciseId} style={{...card,margin:"10px 12px"}}>
          <div style={{padding:"12px 14px 8px"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#f0ece6",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}} onClick={()=>setExerciseInfo({name:e.name,muscle:e.muscle})}>
                  {e.name}
                  <span style={{fontSize:10,background:"#2e1808",border:"1px solid #7a2e00",borderRadius:4,padding:"2px 6px",color:"#f0a060",fontFamily:"'Barlow',sans-serif",fontWeight:600,letterSpacing:0.3}}>HOW TO</span>
                </div>
                <MuscleChip muscle={e.muscle}/>
              </div>
              <div style={{flexShrink:0}}>
                {isNewPb?<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#e8621a",borderRadius:4,padding:"3px 8px",fontSize:11,color:"#1a1a1e",fontWeight:700,animation:"pop .3s ease"}}>{Ic.fire} NEW PB!</span>
                :pb?<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#2e1808",border:"1px solid #3a5000",borderRadius:4,padding:"3px 8px",fontSize:11,color:"#e8621a",fontWeight:600}}>{Ic.trophy} {pb.weight}kg × {pb.reps}</span>
                :<span style={{fontSize:11,color:"#505058"}}>No PB yet</span>}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 56px",gap:6,padding:"4px 12px",background:"#26262c"}}>
            {["SET","KG","REPS","PREV"].map(h=><div key={h} style={{fontSize:10,color:"#505058",fontWeight:700,textAlign:"center"}}>{h}</div>)}
          </div>
          {exSets.map((s,si)=>{const lbl=labels[si],p=prevSets[si];return(
            <div key={si} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 56px",gap:6,alignItems:"center",padding:"7px 12px",borderTop:"1px solid #141418",background:s.weight&&s.reps?"#2a1a0a":"transparent"}}>
              <div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:"#72727c"}}>{si+1}</div>{lbl?.reps&&<div style={{fontSize:9,color:"#505058",fontWeight:600}}>{lbl.reps}</div>}</div>
              <input type="number" min="0" step="0.5" placeholder="kg" value={s.weight} onChange={e=>updateSet(ex.exerciseId,si,"weight",e.target.value)} style={{...setInp,borderColor:s.weight?"#4a2808":"#44444c"}}/>
              <input type="number" min="0" placeholder="reps" value={s.reps} onChange={e=>updateSet(ex.exerciseId,si,"reps",e.target.value)} style={{...setInp,borderColor:s.reps?"#4a2808":"#44444c"}}/>
              <div style={{textAlign:"center",fontSize:12,color:"#606068"}}>{p?.weight?<><span style={{color:"#f0ece6",fontWeight:600}}>{p.weight}</span><br/><span style={{fontSize:11}}>{p.reps}r</span></>:"—"}</div>
            </div>);})}
        </div>);
      })}
      <div style={{padding:"8px 12px 8px"}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:"#72727c",textTransform:"uppercase",marginBottom:6}}>Session Notes</div>
        <textarea
          value={sessionNotes}
          onChange={e=>setSessionNotes(e.target.value)}
          placeholder="How did the session feel? Any niggles, PRs, notes for next time..."
          style={{background:"#323238",border:"1px solid #44444c",borderRadius:8,padding:"10px 12px",color:"#f0ece6",width:"100%",fontSize:13,minHeight:80,resize:"none",fontFamily:"'Barlow',sans-serif",lineHeight:1.5,boxSizing:"border-box"}}
        />
      </div>
      <div style={{padding:"8px 12px 32px"}}><button style={{...btn(saved?"ghost":"primary"),width:"100%",justifyContent:"center",padding:"14px"}} onClick={handleSave}>{saved?<>{Ic.check} Saved!</>:"Save Session"}</button></div>
    </div>
    {exerciseInfo&&<ExerciseInfoPanel name={exerciseInfo.name} muscle={exerciseInfo.muscle} onClose={()=>setExerciseInfo(null)}/>}
  </div>);
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────
function PlansTab({plans,exercises,activePlanId,exMap,onActivate,onSavePlans}){
  const [editing,setEditing]=useState(null);
  const [aiBuilding,setAiBuilding]=useState(false);
  if(editing!==null){const p=editing==="new"?{id:`p${Date.now()}`,name:"",weeks:12,days:[]}:plans.find(p=>p.id===editing);return (<PlanBuilder plan={p} exercises={exercises} exMap={exMap} onSave={p=>{onSavePlans(prev=>{const exists=prev.find(x=>x.id===p.id);return exists?prev.map(x=>x.id===p.id?p:x):[...prev,p];});setEditing(null);}} onCancel={()=>setEditing(null)}/>);}
  if(aiBuilding){return (<AIPlanBuilder exercises={exercises} exMap={exMap} onSave={p=>{onSavePlans(prev=>[...prev,{...p,id:`p${Date.now()}`}]);setAiBuilding(false);}} onCancel={()=>setAiBuilding(false)}/>);}
  return(<div style={{padding:"14px 14px 24px"}}>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <button style={{...btn("primary"),flex:1,justifyContent:"center"}} onClick={()=>setEditing("new")}>{Ic.plus} New Plan</button>
      <button style={{flex:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 16px",borderRadius:7,border:"1px solid #7c3aed",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:0.5,textTransform:"uppercase",background:"#1a1030",color:"#f0a060"}} onClick={()=>setAiBuilding(true)}>{"✨"} AI Builder</button>
    </div>
    {plans.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:"#505058",fontSize:14}}>No plans yet.</div>}
    {plans.map(p=>(<div key={p.id} style={{...card,border:p.id===activePlanId?"1px solid #5a8a00":"1px solid #1e1e24"}}>
      <div style={{padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>{p.id===activePlanId&&<div style={{fontSize:10,color:"#e8621a",fontWeight:700,letterSpacing:1,marginBottom:3}}>✓ ACTIVE</div>}
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:20,color:"#f0ece6"}}>{p.name||"Unnamed Plan"}</div>
          <div style={{fontSize:12,color:"#606068",marginTop:2}}>{p.days.length} days · {p.weeks} weeks</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button style={{...btn("ghost"),padding:"7px 10px"}} onClick={()=>setEditing(p.id)}>{Ic.edit}</button>
          {p.id!==activePlanId&&<button style={{...btn("primary"),padding:"7px 12px",fontSize:12}} onClick={()=>onActivate(p.id)}>Activate</button>}
          <button style={{...btn("danger"),padding:"7px 10px"}} onClick={()=>{if(window.confirm(`Delete "${p.name||"this plan"}"? This cannot be undone.`))onSavePlans(prev=>prev.filter(x=>x.id!==p.id));}}>{Ic.trash}</button>
        </div>
      </div>
      <div style={{padding:"0 14px 12px",display:"flex",flexWrap:"wrap",gap:5}}>
        {p.days.map((d,i)=><span key={i} style={{fontSize:11,background:"#323238",border:"1px solid #2a2a30",borderRadius:4,padding:"3px 7px",color:"#9a9aa2"}}>{d.name}</span>)}
      </div>
      <div style={{padding:"0 14px 14px"}}>
        <VolumeAnalysis plan={p} exMap={exMap}/>
      </div>
    </div>))}
  </div>);
}

// ─── Plan Builder ─────────────────────────────────────────────────────────────
function PlanBuilder({plan:initial,exercises,exMap,onSave,onCancel}){
  const [plan,setPlan]=useState(initial);
  const [addingTo,setAddingTo]=useState(null);
  const addDay=()=>{const names=["Upper A","Lower A","Upper B","Full Body","Lower B","Upper C"];setPlan(p=>({...p,days:[...p.days,{name:names[p.days.length]||`Day ${p.days.length+1}`,exercises:[]}]}));};
  const removeDay=i=>setPlan(p=>({...p,days:p.days.filter((_,j)=>j!==i)}));
  const updateDayName=(i,n)=>setPlan(p=>({...p,days:p.days.map((d,j)=>j===i?{...d,name:n}:d)}));
  const addEx=(di,exId)=>{setPlan(p=>({...p,days:p.days.map((d,i)=>i===di?{...d,exercises:[...d.exercises,{exerciseId:exId,setConfigs:[{sets:3,repsRange:"8-12",note:""}]}]}:d)}));setAddingTo(null);};
  const removeEx=(di,ei)=>setPlan(p=>({...p,days:p.days.map((d,i)=>i===di?{...d,exercises:d.exercises.filter((_,j)=>j!==ei)}:d)}));
  const updCfg=(di,ei,ci,f,v)=>setPlan(p=>({...p,days:p.days.map((d,i)=>i===di?{...d,exercises:d.exercises.map((ex,j)=>j===ei?{...ex,setConfigs:ex.setConfigs.map((c,k)=>k===ci?{...c,[f]:v}:c)}:ex)}:d)}));
  if(addingTo!==null)return (<ExercisePicker exercises={exercises} existing={plan.days[addingTo]?.exercises.map(e=>e.exerciseId)||[]} onPick={exId=>addEx(addingTo,exId)} onCancel={()=>setAddingTo(null)}/>);
  return(<div style={{padding:"14px 14px 32px"}}>
    <div style={{marginBottom:12}}><label style={lbl}>Plan Name</label><input style={inp} value={plan.name} onChange={e=>setPlan(p=>({...p,name:e.target.value}))} placeholder="e.g. Hypertrophy Block 2"/></div>
    <div style={{marginBottom:20}}><label style={lbl}>Total Weeks</label><input style={{...inp,width:120}} type="number" min="4" max="24" value={plan.weeks} onChange={e=>setPlan(p=>({...p,weeks:parseInt(e.target.value)||12}))}/></div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:"#f0ece6",letterSpacing:0.5}}>TRAINING DAYS</div>
      <button style={{...btn("ghost"),padding:"7px 12px",fontSize:12}} onClick={addDay}>{Ic.plus} Add Day</button>
    </div>
    {plan.days.map((day,di)=>(<div key={di} style={{...card,marginBottom:12}}>
      <div style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid #1e1e24"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#72727c",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,minWidth:40}}>DAY {di+1}</div>
        <input style={{...inp,padding:"6px 10px",fontSize:14,flex:1}} value={day.name} onChange={e=>updateDayName(di,e.target.value)}/>
        <button style={{...btn("danger"),padding:"6px 8px"}} onClick={()=>removeDay(di)}>{Ic.x}</button>
      </div>
      {day.exercises.map((ex,ei)=>{const e=exMap[ex.exerciseId];return(<div key={ei} style={{borderBottom:"1px solid #141418"}}>
        <div style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:"#f0ece6"}}>{e?.name}</div><MuscleChip muscle={e?.muscle||""}/></div>
          <button style={{...btn("danger"),padding:"5px 7px"}} onClick={()=>removeEx(di,ei)}>{Ic.x}</button>
        </div>
        {ex.setConfigs.map((cfg,ci)=>(<div key={ci} style={{padding:"4px 12px 8px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          <div>
              <div style={{fontSize:9,color:"#606068",fontWeight:700,letterSpacing:0.5,marginBottom:3}}>SETS</div>
              <select value={cfg.sets} onChange={e=>updCfg(di,ei,ci,"sets",parseInt(e.target.value))}
                style={{...setInp,width:"100%",fontSize:13}}>
                {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:9,color:"#606068",fontWeight:700,letterSpacing:0.5,marginBottom:3}}>REPS</div>
              <input type="text" style={{...setInp,width:"100%",fontSize:12}} value={cfg.repsRange}
                onFocus={e=>e.target.select()}
                onChange={e=>updCfg(di,ei,ci,"repsRange",e.target.value)} placeholder="8-12"/>
            </div>
            <div>
              <div style={{fontSize:9,color:"#606068",fontWeight:700,letterSpacing:0.5,marginBottom:3}}>NOTE</div>
              <input type="text" style={{...setInp,width:"100%",fontSize:12}} value={cfg.note}
                onFocus={e=>e.target.select()}
                onChange={e=>updCfg(di,ei,ci,"note",e.target.value)} placeholder="e.g. Drop"/>
            </div>
        </div>))}
      </div>);})}
      <button style={{...btn("ghost"),margin:10,fontSize:12,padding:"7px 12px"}} onClick={()=>setAddingTo(di)}>{Ic.plus} Add Exercise</button>
    </div>))}
    <div style={{display:"flex",gap:10,marginTop:8}}>
      <button style={{...btn("ghost"),flex:1,justifyContent:"center"}} onClick={onCancel}>Cancel</button>
      <button style={{...btn("primary"),flex:2,justifyContent:"center"}} onClick={()=>onSave(plan)}>{Ic.check} Save Plan</button>
    </div>
  </div>);
}

// ─── Exercise Picker ──────────────────────────────────────────────────────────
function ExercisePicker({exercises,existing,onPick,onCancel}){
  const [search,setSearch]=useState("");
  const [muscle,setMuscle]=useState("All");
  const filtered=exercises.filter(e=>(muscle==="All"||e.muscle===muscle)&&e.name.toLowerCase().includes(search.toLowerCase()));
  return(<div style={{padding:"14px 14px 24px"}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
      <button style={{...btn("ghost"),padding:"8px 10px"}} onClick={onCancel}>{Ic.back}</button>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#f0ece6"}}>ADD EXERCISE</div>
    </div>
    <div style={{position:"relative",marginBottom:10}}><div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#606068"}}>{Ic.search}</div><input style={{...inp,paddingLeft:34}} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <MuscleFilter active={muscle} onChange={setMuscle}/>
    <div style={card}>
      {filtered.map((e,i)=>{const already=existing.includes(e.id);return(<div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderTop:i===0?"none":"1px solid #141418",opacity:already?0.4:1,cursor:already?"default":"pointer"}} onClick={()=>!already&&onPick(e.id)}>
        <div style={{width:8,height:8,borderRadius:"50%",background:MC[e.muscle]||"#72727c",flexShrink:0}}/><div style={{flex:1,fontWeight:500,fontSize:15,color:"#f0ece6"}}>{e.name}</div><MuscleChip muscle={e.muscle}/>{already?<span style={{fontSize:11,color:"#505058"}}>Added</span>:<span style={{color:"#e8621a"}}>{Ic.plus}</span>}
      </div>);})}
      {filtered.length===0&&<div style={{padding:20,textAlign:"center",color:"#505058",fontSize:13}}>No exercises found</div>}
    </div>
  </div>);
}

// ─── Exercises Tab ────────────────────────────────────────────────────────────
function ExercisesTab({exercises,onSave}){
  const [search,setSearch]=useState("");
  const [muscle,setMuscle]=useState("All");
  const [adding,setAdding]=useState(false);
  const [newEx,setNewEx]=useState({name:"",muscle:"Chest"});
  const filtered=exercises.filter(e=>(muscle==="All"||e.muscle===muscle)&&e.name.toLowerCase().includes(search.toLowerCase()));
  return(<div style={{padding:"14px 14px 24px"}}>
    <div style={{position:"relative",marginBottom:10}}><div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#606068"}}>{Ic.search}</div><input style={{...inp,paddingLeft:34}} placeholder="Search exercises…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <MuscleFilter active={muscle} onChange={setMuscle}/>
    {adding&&(<div style={{...card,padding:14,marginBottom:12}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,marginBottom:10,color:"#f0ece6"}}>NEW EXERCISE</div>
      <input style={{...inp,marginBottom:8}} placeholder="Exercise name" value={newEx.name} onChange={e=>setNewEx(p=>({...p,name:e.target.value}))}/>
      <select style={{...inp,marginBottom:10}} value={newEx.muscle} onChange={e=>setNewEx(p=>({...p,muscle:e.target.value}))}>{MUSCLES.map(m=><option key={m} value={m}>{m}</option>)}</select>
      <div style={{display:"flex",gap:8}}>
        <button style={{...btn("ghost"),flex:1,justifyContent:"center"}} onClick={()=>setAdding(false)}>Cancel</button>
        <button style={{...btn("primary"),flex:1,justifyContent:"center"}} onClick={()=>{if(!newEx.name.trim())return;onSave([...exercises,{id:`custom_${Date.now()}`,...newEx}]);setNewEx({name:"",muscle:"Chest"});setAdding(false);}}>{Ic.check} Add</button>
      </div>
    </div>)}
    {!adding&&<button style={{...btn("ghost"),width:"100%",justifyContent:"center",marginBottom:12}} onClick={()=>setAdding(true)}>{Ic.plus} Add Custom Exercise</button>}
    <div style={card}>
      {filtered.map((e,i)=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderTop:i===0?"none":"1px solid #141418"}}><div style={{width:8,height:8,borderRadius:"50%",background:MC[e.muscle]||"#72727c",flexShrink:0}}/><div style={{flex:1,fontWeight:500,fontSize:15,color:"#f0ece6"}}>{e.name}</div><MuscleChip muscle={e.muscle}/></div>))}
      {filtered.length===0&&<div style={{padding:20,textAlign:"center",color:"#505058",fontSize:13}}>No exercises found</div>}
    </div>
    <div style={{fontSize:11,color:"#505058",textAlign:"center",marginTop:10}}>{exercises.length} exercises in library</div>
  </div>);
}

// ─── PBs Tab ──────────────────────────────────────────────────────────────────
function PBsTab({pbs,exMap}){
  const entries=Object.entries(pbs).map(([id,pb])=>({id,...pb,ex:exMap[id]})).filter(e=>e.ex).sort((a,b)=>est1RM(b.weight,b.reps)-est1RM(a.weight,a.reps));
  if(entries.length===0)return(<div style={{padding:32,textAlign:"center",color:"#505058"}}><div style={{fontSize:48,marginBottom:8}}>🏆</div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:700,color:"#44444c",marginBottom:6}}>NO PBs YET</div><div style={{fontSize:13}}>Start logging sessions and your personal bests will appear here automatically.</div></div>);
  const byMuscle={};entries.forEach(e=>{const m=e.ex?.muscle||"Other";if(!byMuscle[m])byMuscle[m]=[];byMuscle[m].push(e);});
  return(<div style={{padding:"14px 14px 32px"}}>
    <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:"#72727c",marginBottom:16,fontFamily:"'Barlow Condensed',sans-serif"}}>PERSONAL BESTS · {entries.length} EXERCISES</div>
    {Object.entries(byMuscle).map(([muscle,list])=>(<div key={muscle} style={{marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div style={{width:6,height:6,borderRadius:"50%",background:MC[muscle]||"#72727c"}}/><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:MC[muscle]||"#72727c",letterSpacing:1,textTransform:"uppercase"}}>{muscle}</div></div>
      <div style={card}>{list.map((e,i)=>{const orm=est1RM(e.weight,e.reps),date=e.date?new Date(e.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"}):"";return(<div key={e.id} style={{padding:"10px 14px",borderTop:i===0?"none":"1px solid #141418",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:"#f0ece6"}}>{e.ex.name}</div><div style={{fontSize:11,color:"#606068",marginTop:2}}>{date}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#e8621a"}}>{e.weight}<span style={{fontSize:12,fontWeight:500}}>kg</span></div><div style={{fontSize:11,color:"#72727c"}}>{e.reps} reps · est {orm}kg 1RM</div></div>
      </div>);})}
      </div>
    </div>))}
  </div>);
}

// ─── AI Plan Builder ──────────────────────────────────────────────────────────
function AIPlanBuilder({exercises,exMap,onSave,onCancel}){
  const [description,setDescription]=useState("");
  const [loading,setLoading]=useState(false);
  const [generatedPlan,setGeneratedPlan]=useState(null);
  const [error,setError]=useState("");

  const generate=async()=>{
    if(!description.trim())return;
    setLoading(true);setError("");setGeneratedPlan(null);
    try{
      const res=await fetch("/api/generate-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description,exercises})});
      const data=await res.json();
      if(data.plan){setGeneratedPlan(data.plan);}
      else{setError(data.error||"Couldn't generate plan. Try a different description.");}
    }catch{setError("Network error. Please try again.");}
    setLoading(false);
  };

  if(generatedPlan){
    return (<GeneratedPlanView plan={generatedPlan} exMap={exMap} exercises={exercises}
      onSave={()=>onSave(generatedPlan)}
      onRegenerate={()=>setGeneratedPlan(null)}
      onPlanChange={setGeneratedPlan}
    />);
  }

  return(
    <div style={{padding:"14px 14px 32px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button style={{...btn("ghost"),padding:"8px 10px"}} onClick={onCancel}>{Ic.back}</button>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:"#f0a060"}}>{"✨"} AI PLAN BUILDER</div>
          <div style={{fontSize:12,color:"#72727c",marginTop:1}}>Describe what you want and Claude builds it</div>
        </div>
      </div>

      <div style={{...card,padding:14,marginBottom:14,background:"#2a1c10",border:"1px solid #4c1d95"}}>
        <div style={{fontSize:12,color:"#c07040",lineHeight:1.6}}>
          Describe your training goal, how many days per week, experience level, and any preferences. Claude will build a full plan using your exercise library.
        </div>
        <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:6}}>
          {["4 day upper/lower split, 12 weeks, intermediate","3 day full body, beginner, focus on compounds","5 day PPL split, advanced, high volume"].map(eg=>(
            <button key={eg} onClick={()=>setDescription(eg)} style={{fontSize:11,background:"#2e1808",border:"1px solid #4c1d95",borderRadius:5,padding:"4px 8px",color:"#f0a060",cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>
              {eg}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <label style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#72727c",display:"block",marginBottom:6}}>Describe Your Plan</label>
        <textarea
          value={description}
          onChange={e=>setDescription(e.target.value)}
          placeholder="e.g. 4 day upper/lower hypertrophy split, 12 weeks with a deload on week 6, intermediate level, I want to focus on chest and back growth..."
          style={{background:"#323238",border:"1px solid #2a2a32",borderRadius:7,padding:"12px 14px",color:"#f0ece6",width:"100%",fontSize:14,minHeight:120,resize:"vertical",fontFamily:"'Barlow',sans-serif",lineHeight:1.5}}
        />
      </div>

      {error&&<div style={{background:"#2a1010",border:"1px solid #4a2020",borderRadius:7,padding:"10px 14px",fontSize:13,color:"#ff8080",marginBottom:12}}>{error}</div>}

      <button
        style={{...btn("primary"),width:"100%",justifyContent:"center",padding:"14px",background:loading?"#1a1030":"#c04a00",color:"white",opacity:loading||!description.trim()?0.6:1}}
        onClick={generate}
        disabled={loading||!description.trim()}
      >
        {loading?(
          <span style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{display:"inline-block",width:14,height:14,border:"2px solid #ffffff44",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
            Building your plan…
          </span>
        ):"✨ Generate Plan"}
      </button>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Generated Plan View (with AI swap) ──────────────────────────────────────
function GeneratedPlanView({plan, exMap, exercises, onSave, onRegenerate, onPlanChange}){
  const [swapping, setSwapping] = useState(null); // {dayIdx, exIdx, exerciseId, muscle, name}
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [browsingSwap, setBrowsingSwap] = useState(false);

  const openSwap = async (dayIdx, exIdx, ex) => {
    const e = exMap[ex.exerciseId];
    if (!e) return;
    setSwapping({dayIdx, exIdx, exerciseId: ex.exerciseId, muscle: e.muscle, name: e.name});
    setSuggestions([]);
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/suggest-swap", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({exerciseName: e.name, muscle: e.muscle, exercises})
      });
      const data = await res.json();
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch {}
    setSuggestLoading(false);
  };

  const doSwap = (newExId) => {
    if (!swapping) return;
    const updated = {
      ...plan,
      days: plan.days.map((day, di) =>
        di !== swapping.dayIdx ? day : {
          ...day,
          exercises: day.exercises.map((ex, ei) =>
            ei !== swapping.exIdx ? ex : {...ex, exerciseId: newExId}
          )
        }
      )
    };
    onPlanChange(updated);
    setSwapping(null);
    setSuggestions([]);
    setBrowsingSwap(false);
  };

  // Swap picker screen
  if (swapping) {
    const muscleExercises = exercises.filter(e => e.muscle === swapping.muscle && e.id !== swapping.exerciseId);
    return (
      <div style={{padding:"14px 14px 32px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={{...btn("ghost"),padding:"8px 10px"}} onClick={()=>{setSwapping(null);setBrowsingSwap(false);}}>{Ic.back}</button>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:"#f0ece6"}}>SWAP EXERCISE</div>
            <div style={{fontSize:11,color:"#72727c",marginTop:1}}>Replacing: {swapping.name}</div>
          </div>
        </div>

        {/* AI Suggestions */}
        {!browsingSwap && (
          <>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:"#f0a060",marginBottom:10,textTransform:"uppercase"}}>{"✨"} AI Recommendations</div>
            {suggestLoading ? (
              <div style={{...card,padding:20,textAlign:"center"}}>
                <div style={{fontSize:13,color:"#72727c"}}>Getting recommendations…</div>
              </div>
            ) : suggestions.length > 0 ? (
              <div style={{...card,marginBottom:14}}>
                {suggestions.map((s,i) => {
                  const e = exMap[s.id];
                  return e ? (
                    <div key={s.id} style={{padding:"12px 14px",borderTop:i===0?"none":"1px solid #141418",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>doSwap(s.id)}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:14,color:"#f0ece6"}}>{e.name}</div>
                        <div style={{fontSize:11,color:"#c07040",marginTop:2}}>{s.reason}</div>
                      </div>
                      <MuscleChip muscle={e.muscle}/>
                      <span style={{color:"#e8621a",fontSize:18}}>›</span>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <div style={{...card,padding:14,marginBottom:14,textAlign:"center",color:"#606068",fontSize:13}}>No suggestions available</div>
            )}
            <button style={{...btn("ghost"),width:"100%",justifyContent:"center",marginBottom:12}} onClick={()=>setBrowsingSwap(true)}>
              Browse All {swapping.muscle} Exercises
            </button>
          </>
        )}

        {/* Browse all */}
        {browsingSwap && (
          <>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:"#72727c",marginBottom:10,textTransform:"uppercase"}}>All {swapping.muscle} Exercises</div>
            <div style={card}>
              {muscleExercises.map((e,i) => (
                <div key={e.id} style={{padding:"11px 14px",borderTop:i===0?"none":"1px solid #141418",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>doSwap(e.id)}>
                  <div style={{flex:1,fontWeight:500,fontSize:14,color:"#f0ece6"}}>{e.name}</div>
                  <span style={{color:"#e8621a",fontSize:18}}>›</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Main plan view
  return (
    <div style={{padding:"14px 14px 32px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button style={{...btn("ghost"),padding:"8px 10px"}} onClick={onRegenerate}>{Ic.back}</button>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:"#f0a060"}}>{"✨"} AI GENERATED</div>
          <div style={{fontSize:12,color:"#72727c",marginTop:1}}>Tap the swap icon to replace any exercise</div>
        </div>
      </div>

      <div style={{...card,padding:14,marginBottom:14,background:"#2a1c10",border:"1px solid #4c1d95"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#f0ece6"}}>{plan.name}</div>
        <div style={{fontSize:12,color:"#c04a00",marginTop:2}}>{plan.days?.length} days · {plan.weeks} weeks</div>
      </div>

      {plan.days?.map((day,di)=>(
        <div key={di} style={{...card,marginBottom:10}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid #1e1e24"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:"#f0ece6"}}>{day.name}</div>
            <div style={{fontSize:11,color:"#72727c",marginTop:2}}>{day.exercises?.length} exercises</div>
          </div>
          {day.exercises?.map((ex,ei)=>{
            const e=exMap[ex.exerciseId];
            const cfg=ex.setConfigs?.[0];
            const updateSetsReps=(field,val)=>{
              onPlanChange({...plan,days:plan.days.map((d,ddi)=>ddi!==di?d:{...d,exercises:d.exercises.map((exr,eei)=>eei!==ei?exr:{...exr,setConfigs:[{...exr.setConfigs[0],[field]:val}]})})});
            };
            return(
              <div key={ei} style={{borderTop:ei===0?"none":"1px solid #141418"}}>
                <div style={{padding:"9px 14px",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:14,color:e?"#f0ece6":"#ff8080"}}>{e?e.name:`Unknown (${ex.exerciseId})`}</div>
                    {e&&<MuscleChip muscle={e.muscle}/>}
                  </div>
                  <div style={{display:"flex",gap:5,flexShrink:0}}>
                    {e&&<button style={{background:"#2e1808",border:"1px solid #7a2e00",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#f0a060",fontSize:12,fontWeight:700}} onClick={()=>openSwap(di,ei,ex)}>{"⇄"}</button>}
                    <button style={{background:"#2a1010",border:"1px solid #4a2020",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#ff6060",display:"inline-flex",alignItems:"center",justifyContent:"center"}} onClick={()=>{onPlanChange({...plan,days:plan.days.map((d,ddi)=>ddi!==di?d:{...d,exercises:d.exercises.filter((_,eei)=>eei!==ei)})});}}>
                      {Ic.trash}
                    </button>
                  </div>
                </div>
                {cfg&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 14px 10px"}}>
                    <div>
                      <div style={{fontSize:9,color:"#606068",fontWeight:700,letterSpacing:0.5,marginBottom:3}}>SETS</div>
                      <select value={cfg.sets} onChange={e=>updateSetsReps("sets",parseInt(e.target.value))}
                        style={{...setInp,width:"100%",fontSize:13}}>
                        {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:"#606068",fontWeight:700,letterSpacing:0.5,marginBottom:3}}>REPS</div>
                      <input type="text" value={cfg.repsRange}
                        onFocus={e=>e.target.select()}
                        onChange={e=>updateSetsReps("repsRange",e.target.value)}
                        style={{...setInp,width:"100%",fontSize:14}}/>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button style={{...btn("ghost"),flex:1,justifyContent:"center"}} onClick={onRegenerate}>Regenerate</button>
        <button style={{...btn("primary"),flex:2,justifyContent:"center"}} onClick={onSave}>{Ic.check} Save Plan</button>
      </div>
    </div>
  );
}

// ─── Exercise Info Panel ──────────────────────────────────────────────────────
function ExerciseInfoPanel({name, muscle, onClose}){
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(()=>{
    (async()=>{
      setLoading(true); setError(""); setInfo(null);
      try {
        const res = await fetch("/api/exercise-info", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({exerciseName:name, muscle})
        });
        const data = await res.json();
        if(data.info) setInfo(data.info);
        else setError("Couldn't load exercise info.");
      } catch { setError("Network error. Please try again."); }
      setLoading(false);
    })();
  },[name]);

  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      {/* Backdrop */}
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)"}} onClick={onClose}/>

      {/* Panel */}
      <div style={{position:"relative",background:"#28282e",borderRadius:"18px 18px 0 0",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,0.6)"}}>

        {/* Handle + header */}
        <div style={{padding:"12px 18px 10px",borderBottom:"1px solid #3a3a42",flexShrink:0}}>
          <div style={{width:36,height:4,background:"#44444c",borderRadius:2,margin:"0 auto 12px"}}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:"#f0ece6"}}>{name}</div>
              <MuscleChip muscle={muscle}/>
            </div>
            <button onClick={onClose} style={{background:"#323238",border:"none",borderRadius:8,padding:"8px 10px",cursor:"pointer",color:"#9a9aa2"}}>{Ic.x}</button>
          </div>
        </div>

        {/* Content */}
        <div style={{overflowY:"auto",padding:"16px 18px 32px"}}>
          {loading&&(
            <div style={{textAlign:"center",padding:"40px 0",color:"#72727c",fontSize:14}}>
              <div style={{fontSize:24,marginBottom:8}}>{"⏳"}</div>
              Loading exercise guide…
            </div>
          )}
          {error&&<div style={{color:"#ff8080",fontSize:13,padding:"20px 0",textAlign:"center"}}>{error}</div>}
          {info&&(
            <>
              {/* Setup */}
              <div style={{marginBottom:18}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,color:"#e8621a",textTransform:"uppercase",marginBottom:6}}>Setup</div>
                <div style={{fontSize:14,color:"#c8c4bc",lineHeight:1.6}}>{info.setup}</div>
              </div>

              {/* Execution */}
              <div style={{marginBottom:18}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,color:"#e8621a",textTransform:"uppercase",marginBottom:8}}>How To Perform</div>
                {info.execution?.map((step,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:"#e8621a",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0,fontFamily:"'Barlow Condensed',sans-serif"}}>{i+1}</div>
                    <div style={{fontSize:14,color:"#c8c4bc",lineHeight:1.5,paddingTop:2}}>{step}</div>
                  </div>
                ))}
              </div>

              {/* Muscles */}
              <div style={{marginBottom:18}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,color:"#e8621a",textTransform:"uppercase",marginBottom:8}}>Muscles Worked</div>
                <div style={{marginBottom:6}}>
                  <span style={{fontSize:11,color:"#72727c",fontWeight:600}}>PRIMARY: </span>
                  {info.primaryMuscles?.map((m,i)=>(
                    <span key={i} style={{fontSize:12,background:"#3a1808",border:"1px solid #7a2e00",borderRadius:4,padding:"2px 7px",color:"#f0a060",marginRight:4,display:"inline-block",marginBottom:4}}>{m}</span>
                  ))}
                </div>
                {info.secondaryMuscles?.length>0&&(
                  <div>
                    <span style={{fontSize:11,color:"#72727c",fontWeight:600}}>SECONDARY: </span>
                    {info.secondaryMuscles.map((m,i)=>(
                      <span key={i} style={{fontSize:12,background:"#323238",border:"1px solid #44444c",borderRadius:4,padding:"2px 7px",color:"#9a9aa2",marginRight:4,display:"inline-block",marginBottom:4}}>{m}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Form cues */}
              <div style={{marginBottom:18}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,color:"#e8621a",textTransform:"uppercase",marginBottom:8}}>Key Form Cues</div>
                {info.formCues?.map((cue,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"flex-start"}}>
                    <span style={{color:"#e8621a",fontSize:14,flexShrink:0}}>✓</span>
                    <div style={{fontSize:14,color:"#c8c4bc",lineHeight:1.5}}>{cue}</div>
                  </div>
                ))}
              </div>

              {/* Common mistakes */}
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,color:"#e8621a",textTransform:"uppercase",marginBottom:8}}>Common Mistakes</div>
                {info.commonMistakes?.map((m,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"flex-start"}}>
                    <span style={{color:"#ff6060",fontSize:14,flexShrink:0}}>✗</span>
                    <div style={{fontSize:14,color:"#c8c4bc",lineHeight:1.5}}>{m}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────
function HomeTab({session,activePlan,currentWeek,logs,pbs,exMap,weightData,calProfile,onGoToToday,onStartSession,userName,onSaveUserName}){
  const [editingName,setEditingName]=useState(false);
  const [nameInput,setNameInput]=useState(userName||"");
  const [tip,setTip]=useState("");
  const [tipLoading,setTipLoading]=useState(false);
  const today=new Date().toDateString();

  // Daily tip — fetch once per day, cache in sessionStorage
  useEffect(()=>{
    const cached=sessionStorage.getItem("rnf:tip");
    const cachedDate=sessionStorage.getItem("rnf:tipDate");
    if(cached&&cachedDate===today){setTip(cached);return;}
    if(!activePlan)return;
    setTipLoading(true);
    const recentPbEntry=Object.entries(pbs||{}).sort((a,b)=>new Date(b[1].date||0)-new Date(a[1].date||0))[0];
    const recentPb=recentPbEntry?`${exMap[recentPbEntry[0]]?.name||""} ${recentPbEntry[1].weight}kg × ${recentPbEntry[1].reps} reps`:"";
    const latestW=weightData?.entries?.sort((a,b)=>b.date.localeCompare(a.date))[0]?.weight;
    fetch("/api/daily-tip",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      goal:activePlan.name,currentWeek,planName:activePlan.name,recentPb,
      currentWeight:latestW||null,
      targetWeight:weightData?.targetWeight||null,
      totalWeeks:activePlan.weeks||null
    })}).then(r=>r.json()).then(d=>{
      if(d.tip){setTip(d.tip);sessionStorage.setItem("rnf:tip",d.tip);sessionStorage.setItem("rnf:tipDate",today);}
    }).catch(()=>{}).finally(()=>setTipLoading(false));
  },[activePlan?.id,currentWeek]);

  // Stats
  const results=useMemo(()=>calcNutrition(calProfile),[calProfile]);
  const planLogs=activePlan?logs[activePlan.id]||{}:{};
  const thisWeekVol=Object.values(planLogs[currentWeek]||{}).reduce((t,day)=>t+Object.values(day).reduce((s,sets)=>s+sets.reduce((a,st)=>a+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0);
  const lastWeekVol=Object.values(planLogs[currentWeek-1]||{}).reduce((t,day)=>t+Object.values(day).reduce((s,sets)=>s+sets.reduce((a,st)=>a+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0);
  const volDiff=thisWeekVol-lastWeekVol;

  // Last session date
  const allDates=Object.entries(planLogs).flatMap(([wk,days])=>Object.values(days).flatMap(()=>[wk]));
  const lastWeekLogged=allDates.length?Math.max(...allDates.map(Number)):null;
  const weeksLeft=activePlan?(activePlan.weeks-currentWeek):null;

  // Top PB
  const topPb=Object.entries(pbs||{}).sort((a,b)=>est1RM(b[1].weight,b[1].reps)-est1RM(a[1].weight,a[1].reps))[0];
  const recentPb=Object.entries(pbs||{}).sort((a,b)=>new Date(b[1].date||0)-new Date(a[1].date||0))[0];

  // Weight stats
  const entries=[...(weightData?.entries||[])].sort((a,b)=>b.date.localeCompare(a.date));
  const latestWeight=entries[0];
  const target=weightData?.targetWeight;
  const toTarget=latestWeight&&target?Math.round((latestWeight.weight-target)*10)/10:null;

  // Next unlogged day
  const nextDayIdx=activePlan?activePlan.days.findIndex((_,i)=>!planLogs[currentWeek]?.[i]):-1;

  return(
    <div style={{padding:"14px 14px 32px"}}>

      {/* Logo + branding */}
      <div style={{textAlign:"center",padding:"10px 0 20px"}}>
        <img src="/icon-192.png" alt="RNF" style={{width:72,height:72,borderRadius:16,marginBottom:10}}/>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,letterSpacing:2,color:"#f0ece6"}}>THE REEL NEIL</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:400,fontSize:14,letterSpacing:4,color:"#72727c",textTransform:"uppercase",marginBottom:10}}>Fitness</div>
        <a href="https://www.instagram.com/the_reel_neil" target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:"linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)",textDecoration:"none"}}>
          <span style={{fontSize:13}}>{"📸"}</span>
          <span style={{fontSize:12,fontWeight:700,color:"white",letterSpacing:0.5,fontFamily:"'Barlow',sans-serif"}}>{"@the_reel_neil"}</span>
        </a>
      </div>

      {/* Welcome */}
      <div style={{...card,padding:"12px 14px",marginBottom:12,background:"#2e1808",border:"1px solid #7a2e00"}}>
        <div style={{fontSize:11,color:"#c06030",fontWeight:600,letterSpacing:0.5,marginBottom:4}}>WELCOME BACK</div>
        {editingName?(
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input style={{...inp,flex:1,padding:"8px 12px",fontSize:15}} placeholder="Enter your name" value={nameInput}
              onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){onSaveUserName(nameInput);setEditingName(false);}}} autoFocus/>
            <button style={{...btn("primary"),padding:"8px 12px"}} onClick={()=>{onSaveUserName(nameInput);setEditingName(false);}}>{Ic.check} Save</button>
            <button style={{...btn("ghost"),padding:"8px 10px"}} onClick={()=>setEditingName(false)}>{Ic.x}</button>
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:22,color:"#f0ece6"}}>{userName||session.email}</div>
            <button style={{background:"none",border:"none",cursor:"pointer",color:"#c06030",padding:4}} onClick={()=>{setNameInput(userName||"");setEditingName(true);}}>{Ic.edit}</button>
          </div>
        )}
      </div>

      {/* Active plan summary */}
      {activePlan?(
        <div style={{...card,padding:"14px",marginBottom:12,background:"#26262c"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div>
              <div style={{fontSize:10,color:"#72727c",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>Active Plan</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:"#f0ece6"}}>{activePlan.name}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:32,color:"#e8621a",lineHeight:1}}>WK {currentWeek}</div>
              <div style={{fontSize:11,color:"#72727c"}}>{weeksLeft!=null?`${weeksLeft} wks left`:""}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <div style={{flex:1,background:"#323238",borderRadius:8,padding:"10px",textAlign:"center"}}>
              <div style={{fontSize:10,color:"#72727c",fontWeight:700,letterSpacing:0.5,marginBottom:4}}>THIS WEEK VOL</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#f0ece6"}}>{Math.round(thisWeekVol).toLocaleString()}<span style={{fontSize:11,fontWeight:400}}>kg</span></div>
              {lastWeekVol>0&&<div style={{fontSize:10,color:volDiff>=0?"#34d399":"#f87171",marginTop:2}}>{volDiff>=0?"+":""}{Math.round(volDiff).toLocaleString()}kg vs last wk</div>}
            </div>
            <div style={{flex:1,background:"#323238",borderRadius:8,padding:"10px",textAlign:"center"}}>
              <div style={{fontSize:10,color:"#72727c",fontWeight:700,letterSpacing:0.5,marginBottom:4}}>DAYS LOGGED</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#f0ece6"}}>{Object.keys(planLogs[currentWeek]||{}).length}<span style={{fontSize:11,fontWeight:400}}>/{activePlan.days.length}</span></div>
              <div style={{fontSize:10,color:"#72727c",marginTop:2}}>this week</div>
            </div>
          </div>
          {nextDayIdx>=0?(
            <button style={{...btn("primary"),width:"100%",justifyContent:"center",padding:"12px"}} onClick={()=>{onStartSession(nextDayIdx);onGoToToday();}}>
              Start {activePlan.days[nextDayIdx]?.name}
            </button>
          ):(
            <div style={{textAlign:"center",padding:"8px",fontSize:13,color:"#34d399",fontWeight:600}}>✓ All sessions logged this week</div>
          )}
        </div>
      ):(
        <div style={{...card,padding:14,marginBottom:12,textAlign:"center",color:"#72727c",fontSize:13}}>
          No active plan — go to Plans to set one up
        </div>
      )}

      {/* Weight + calories row */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {latestWeight&&(
          <div style={{flex:1,...card,padding:"12px",margin:0}}>
            <div style={{fontSize:10,color:"#72727c",fontWeight:700,letterSpacing:0.5,marginBottom:4}}>CURRENT WEIGHT</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:"#e8621a",lineHeight:1}}>{latestWeight.weight}<span style={{fontSize:12,fontWeight:400}}>kg</span></div>
            {toTarget!==null&&<div style={{fontSize:11,color:toTarget<=0?"#34d399":"#72727c",marginTop:3}}>{toTarget<=0?"Goal reached! 🎉":`${Math.abs(toTarget)}kg to ${target}kg target`}</div>}
          </div>
        )}
        {results&&(
          <div style={{flex:1,...card,padding:"12px",margin:0}}>
            <div style={{fontSize:10,color:"#72727c",fontWeight:700,letterSpacing:0.5,marginBottom:4}}>DAILY CALS</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:"#e8621a",lineHeight:1}}>{results.target.toLocaleString()}</div>
            <div style={{fontSize:10,color:"#72727c",marginTop:3}}>P{results.protein}g · C{results.carbs}g · F{results.fat}g</div>
          </div>
        )}
      </div>

      {/* Most recent PB */}
      {recentPb&&(
        <div style={{...card,padding:"12px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:24,flexShrink:0}}>🏆</div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"#72727c",fontWeight:700,letterSpacing:0.5,marginBottom:2}}>MOST RECENT PB</div>
            <div style={{fontWeight:600,fontSize:14,color:"#f0ece6"}}>{exMap[recentPb[0]]?.name||recentPb[0]}</div>
            <div style={{fontSize:11,color:"#72727c",marginTop:1}}>{new Date(recentPb[1].date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#e8621a"}}>{recentPb[1].weight}<span style={{fontSize:12,fontWeight:400}}>kg</span></div>
            <div style={{fontSize:11,color:"#72727c"}}>{recentPb[1].reps} reps</div>
          </div>
        </div>
      )}

      {/* Daily tip */}
      <div style={{...card,padding:"14px",marginBottom:4,background:"#1e1810",border:"1px solid #4a3010"}}>
        <div style={{fontSize:10,color:"#c07030",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          {"✨"} Coach's Tip of the Day
        </div>
        {tipLoading&&<div style={{fontSize:13,color:"#72727c"}}>Loading today's tip…</div>}
        {tip&&!tipLoading&&<div style={{fontSize:14,color:"#d0c8bc",lineHeight:1.6}}>{tip}</div>}
        {!tip&&!tipLoading&&<div style={{fontSize:13,color:"#505058"}}>Set up an active plan to get personalised daily tips.</div>}
      </div>

    </div>
  );
}

// ─── Volume Analysis ──────────────────────────────────────────────────────────
const VOL_RECOMMENDED = {
  Chest:10, Back:14, Shoulders:12, Biceps:8, Triceps:8,
  Quads:12, Hamstrings:10, Glutes:10, Adductors:6,
  Calves:8, Core:8, Traps:6, Forearms:4
};
const VOL_MAX = {
  Chest:20, Back:22, Shoulders:20, Biceps:14, Triceps:14,
  Quads:20, Hamstrings:18, Glutes:16, Adductors:10,
  Calves:16, Core:16, Traps:12, Forearms:10
};

function VolumeAnalysis({plan, exMap}){
  const [open,setOpen]=useState(false);

  const volumeByMuscle=useMemo(()=>{
    const v={};
    plan.days.forEach(day=>{
      day.exercises.forEach(ex=>{
        const muscle=exMap[ex.exerciseId]?.muscle;
        if(!muscle)return;
        const sets=ex.setConfigs.reduce((t,c)=>t+(parseInt(c.sets)||0),0);
        v[muscle]=(v[muscle]||0)+sets;
      });
    });
    return v;
  },[plan,exMap]);

  const muscles=Object.entries(volumeByMuscle).sort((a,b)=>b[1]-a[1]);
  if(muscles.length===0)return null;

  return(
    <div>
      <button onClick={()=>setOpen(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:0,color:"#e8621a",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:0.5,textTransform:"uppercase"}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:13,height:13}}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
        Volume Analysis {open?"▲":"▼"}
      </button>
      {open&&(
        <div style={{marginTop:10}}>
          <div style={{fontSize:10,color:"#72727c",marginBottom:8}}>Weekly sets per muscle group vs recommended hypertrophy range</div>
          {muscles.map(([muscle,sets])=>{
            const rec=VOL_RECOMMENDED[muscle]||8;
            const max=VOL_MAX[muscle]||16;
            const pct=Math.min(sets/max,1);
            const color=sets<rec?"#f87171":sets<=max?"#34d399":"#fbbf24";
            const status=sets<rec?"Under":sets<=max?"✓ Good":"High";
            return(
              <div key={muscle} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:MC[muscle]||"#72727c",flexShrink:0}}/>
                    <span style={{fontSize:12,fontWeight:600,color:"#f0ece6"}}>{muscle}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:"#72727c"}}>{sets} sets · rec {rec}–{max}</span>
                    <span style={{fontSize:10,fontWeight:700,color,minWidth:40,textAlign:"right"}}>{status}</span>
                  </div>
                </div>
                <div style={{height:6,background:"#323238",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct*100}%`,background:color,borderRadius:3,transition:"width .3s"}}/>
                </div>
              </div>
            );
          })}
          <div style={{marginTop:10,display:"flex",gap:12,fontSize:10,color:"#505058"}}>
            <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:"#f87171"}}/> Under target</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:"#34d399"}}/> Good range</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:"#fbbf24"}}/> High volume</span>
          </div>
        </div>
      )}
    </div>
  );
}
