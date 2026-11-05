"use client";
import {useEffect,useState} from "react";import {Megaphone,ArrowRight} from "lucide-react";import {supabase} from "@/lib/supabase";
type Notice={id:string;title:string;body:string;pinned:boolean;created_at:string};
export function NoticePreview(){const [list,setList]=useState<Notice[]>([]),[message,setMessage]=useState("");
 useEffect(()=>{let active=true;(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session)return;const r=await fetch("/api/announcements",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});if(!active)return;if(!r.ok){setMessage("공지사항을 불러오지 못했어요.");return;}const d=await r.json();setList((d.announcements||[]).slice(0,4));})();return()=>{active=false;};},[]);
 return <section className="widget"><div className="widget-title"><Megaphone size={20}/><h2>최근 공지</h2><a className="mini-link" href="/announcements">전체 보기 <ArrowRight size={15}/></a></div>{list.length?list.map(n=><a className="list-row" key={n.id} href="/announcements"><b style={{width:"auto"}}>{n.pinned?"📌":""}</b><span><strong>{n.title}</strong><small style={{display:"block",marginTop:5,color:"#8a95a8"}}>{new Date(n.created_at).toLocaleDateString("ko-KR")}</small></span></a>):<div className="empty">{message||"아직 등록된 공지사항이 없어요."}</div>}</section>;
}
