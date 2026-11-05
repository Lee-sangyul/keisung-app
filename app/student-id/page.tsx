"use client";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,ShieldCheck,RefreshCw,ScanLine,AlertTriangle} from "lucide-react";
import {supabase,type Profile} from "@/lib/supabase";
import {MobileNav} from "@/components/MobileNav";
type Issued={svg:string;expiresAt:string;ttlSeconds:number};
function safeSvg(svg:string){return /^<svg[\s>]/.test(svg)&&!/<script|onload=|foreignObject/i.test(svg)?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`:"";}
export default function StudentId(){
 const router=useRouter();const [profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[card,setCard]=useState<Issued|null>(null),[remaining,setRemaining]=useState(0),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 const issue=useCallback(async()=>{
  setBusy(true);setStatus("");setCard(null);
  try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("로그인이 필요합니다.");
   const r=await fetch("/api/student-id/issue",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
   const d=await r.json();if(!r.ok)throw Error(d.error||"QR 생성 실패");setCard(d);
  }catch(e){setStatus(e instanceof Error?e.message:"오류");}finally{setBusy(false);}
 },[]);
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/");return;}const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();if(!p||p.disabled||p.must_change_password){router.replace("/dashboard");return;}setProfile(p as Profile);setLoading(false);})();},[router]);
 useEffect(()=>{if(!card)return;const tick=()=>setRemaining(Math.max(0,Math.ceil((new Date(card.expiresAt).getTime()-Date.now())/1000)));tick();const interval=setInterval(tick,300);return()=>clearInterval(interval);},[card]);
 if(loading)return <main className="center">학생증 확인 중...</main>;
 if(!profile)return null;
 if(profile.role!=="student")return <main className="admin-page"><MobileNav role={profile.role}/><a className="back" href="/dashboard"><ArrowLeft size={17}/> 돌아가기</a><h1>학생증</h1><p>학생 계정에만 제공되는 기능이에요. 교사는 QR 검증 화면을 이용해 주세요.</p><a className="outline" href="/student-id/verify">교사용 검증 화면</a></main>;
 return <main className="id-page"><MobileNav role={profile.role}/><div className="id-wrap"><a className="back" href="/dashboard"><ArrowLeft size={17}/> 홈으로</a><div className="id-heading"><span className="eyebrow">KEISUNG SMART</span><h1>모바일 학생증</h1><p>학생 정보 확인 및 QR 검증 · 개발용</p></div>
 <article className="digital-id"><div className="id-top"><div className="id-logo">K</div><div><strong>계성 스마트</strong><small>DEVELOPMENT STUDENT ID</small></div><span className="id-dev">비공식</span></div><div className="id-info"><span>STUDENT</span><h2>{profile.display_name}</h2><p>{profile.grade??"-"}학년 {profile.class_number??"-"}반 {profile.student_number??"-"}번</p></div><div className="id-watermark">개발용 · 공식 학생증 아님</div></article>
 <section className="id-qr-panel"><div className="id-qr-title"><ShieldCheck size={21}/><h2>1회용 QR 검증</h2></div>{card&&remaining>0?<><img className="id-qr" src={safeSvg(card.svg)} alt="45초 유효한 일회용 검증 QR"/><p className="qr-timer">{remaining}초 후 만료</p></>:<div className="qr-placeholder"><ScanLine size={44}/><span>{card?"QR 유효시간이 만료됐어요.":"아래 버튼을 눌러 QR을 발급하세요."}</span></div>}
 <button className="primary" disabled={busy} onClick={issue}><RefreshCw size={18}/>{busy?"QR 생성 중...":card?"새 QR 발급":"QR 발급"}</button>{status&&<p role="alert" className="error">{status}</p>}</section>
 <p className="id-safety"><AlertTriangle size={18}/> 캡처한 화면이나 QR 이미지 자체는 신분 증명이 아니야. 교사의 서버 검증이 완료되어야 유효하며, 검증 시 QR은 즉시 소멸해.</p></div></main>;
}
