import React, { useEffect, useRef, useState } from "react";
export default function RoundTimer({ rounds=10, boxRounds=5, work=180, rest=60 }:{
  rounds?:number; boxRounds?:number; work?:number; rest?:number;
}) {
  const [r,setR]=useState(1), [t,setT]=useState(work), [mode,setMode]=useState<"work"|"rest">("work"), [on,setOn]=useState(false);
  const ref = useRef<any>(null); const bell = useRef<HTMLAudioElement|null>(null);
  useEffect(()=>{ if(typeof Audio!=="undefined") bell.current=new Audio("/beep.ogg"); },[]);
  useEffect(()=>{ if(!on) return; ref.current=setInterval(()=>{ setT(prev=>{
    if(prev>1) return prev-1;
    bell.current?.play();
    if(mode==="work"){ setMode("rest"); return rest; }
    const nr = r+1; if(nr>rounds){ setOn(false); return 0; }
    setR(nr); setMode("work"); if(nr===boxRounds+1 && "speechSynthesis" in window){ speechSynthesis.speak(new SpeechSynthesisUtterance("Switch to kettlebell")); }
    return work;
  }); },1000); return ()=>clearInterval(ref.current);},[on,mode,r,rest,work,rounds,boxRounds]);
  const side = r<=boxRounds?"BOX":"BELL";
  return (<div style={{background:"#101522",border:"1px solid #243049",borderRadius:12,padding:12}}>
    <div style={{color:"#9fb3c8",textTransform:"uppercase",letterSpacing:".1em"}}>Round {r}/{rounds} • {side} • {mode.toUpperCase()}</div>
    <div style={{fontSize:56,fontWeight:800,margin:"8px 0"}}>{String(Math.floor(t/60)).padStart(2,"0")}:{String(t%60).padStart(2,"0")}</div>
    <div>
      <button onClick={()=>setOn(true)}>Start</button>
      <button onClick={()=>setOn(false)}>Pause</button>
      <button onClick={()=>{ setOn(false); setR(1); setMode("work"); setT(work); }}>Reset</button>
    </div>
  </div>);
}
