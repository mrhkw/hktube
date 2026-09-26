import { useEffect, useState } from "react";
import { Ban, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function BlockUserButton({ userId, className="" }: { userId: string; className?: string }) {
  const [blocked,setBlocked]=useState(false);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{ void (async()=>{ const {data:{user}}=await supabase.auth.getUser(); if(!user || user.id===userId) return; const {data}=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",user.id).eq("blocked_id",userId).maybeSingle(); setBlocked(Boolean(data)); })(); },[userId]);

  async function toggle(){
    setBusy(true);
    try {
      const {data:{user}}=await supabase.auth.getUser();
      if(!user) throw new Error("Sign in to block users.");
      if(user.id===userId) throw new Error("You cannot block yourself.");
      if(blocked){
        const {error}=await supabase.from("user_blocks").delete().eq("blocker_id",user.id).eq("blocked_id",userId);
        if(error) throw error;
        setBlocked(false); toast.success("User unblocked.");
      } else {
        const {error}=await supabase.from("user_blocks").insert({blocker_id:user.id,blocked_id:userId});
        if(error) throw error;
        setBlocked(true); toast.success("User blocked.");
      }
    } catch(e) { toast.error(e instanceof Error ? e.message : "Block action failed."); }
    finally { setBusy(false); }
  }

  return <button type="button" onClick={()=>void toggle()} disabled={busy} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${blocked?"border-emerald-300/20 text-emerald-200":"border-red-300/20 text-red-200"} ${className}`}>
    {busy?<Loader2 className="size-4 animate-spin"/>:blocked?<Check className="size-4"/>:<Ban className="size-4"/>}
    {blocked?"Blocked":"Block user"}
  </button>;
}
