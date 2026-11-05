"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, CloudSun, GraduationCap, LogOut, ShieldCheck, Umbrella, Users, UserRound, KeyRound, Loader2, Megaphone, IdCard } from "lucide-react";
import { supabase, type Profile } from "@/lib/supabase";
import { NoticePreview } from "@/components/NoticePreview";
import { MobileNav } from "@/components/MobileNav";
type Meal={date:string;items:string[]};
type Event={date:string;name:string};
const roleName: Record<string,string>={student:"학생",teacher:"교사",admin:"관리자",superadmin:"시스템 관리자"};
export default function Dashboard(){
 const router=useRouter();const [profile,setProfile]=useState<Profile|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const [meals,setMeals]=useState<Meal[]>([]); const [events,setEvents]=useState<Event[]>([]);const [dataStatus,setDataStatus]=useState("");
 const [newPw,setNewPw]=useState("");const [pwError,setPwError]=useState("");const [pwBusy,setPwBusy]=useState(false);
 useEffect(()=>{let active=true; (async()=>{
   const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/");return;}
   const {data,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
   if(!active)return;
   if(error||!data||data.disabled){await supabase.auth.signOut();router.replace("/");return;}
   setProfile(data as Profile);setLoading(false);
   fetch("/api/school").then(r=>r.json()).then(d=>{if(!active)return;setMeals(d.meals||[]);setEvents(d.events||[]);setDataStatus(d.message||"");}).catch(()=>{if(active)setDataStatus("학교 데이터를 불러오지 못했어요.");});
 })();return()=>{active=false;};},[router]);
 async function logout(){await supabase.auth.signOut();router.replace("/");}
 async function changePassword(e:React.FormEvent){e.preventDefault();setPwError("");setPwBusy(true);
  if(newPw.length<12){setPwError("비밀번호는 12자 이상으로 설정해 주세요.");setPwBusy(false);return;}
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch("/api/account/password-changed",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({password:newPw})});
  if(!response.ok){setPwError("비밀번호는 변경되었지만 확인 처리에 실패했어요. 관리자에게 문의해 주세요.");}else {setProfile(p=>p?{...p,must_change_password:false}:p);setNewPw("");}
  setPwBusy(false);
 }
 if(loading)return <main className="center"><Loader2 className="spin"/> 계정 확인 중...</main>;
 if(!profile)return null;
 if(profile.must_change_password)return <main className="center"><section className="change-card"><KeyRound size={30}/><h1>첫 로그인 비밀번호 변경</h1><p>임시 비밀번호를 새 비밀번호로 바꿔야 앱을 사용할 수 있어요.</p><form onSubmit={changePassword}><label>새 비밀번호 (12자 이상)</label><input type="password" autoComplete="new-password" value={newPw} onChange={e=>setNewPw(e.target.value)} required minLength={12}/>{pwError&&<div role="alert" className="error">{pwError}</div>}<button className="primary" disabled={pwBusy}>{pwBusy?"변경 중...":"비밀번호 변경"}</button></form><button className="text-btn" onClick={logout}>로그아웃</button></section></main>;
 const umbrella=process.env.NEXT_PUBLIC_UMBRELLA_URL;
 return <main className="dashboard"><aside className="sidebar"><div className="brand dark"><div className="brand-icon">K</div><span>계성 스마트<small>KEISUNG APP</small></span></div><nav><a className="active" href="/dashboard"><CloudSun size={19}/> 홈</a><a href="#meal"><BookOpen size={19}/> 급식</a><a href="#schedule"><CalendarDays size={19}/> 학사일정</a><a href="#umbrella"><Umbrella size={19}/> 우산 대여</a><a href="/announcements"><Megaphone size={19}/> 공지사항</a><a href="/student-id"><IdCard size={19}/> 학생증</a><a href="/profile"><UserRound size={19}/> 내 정보</a>{["admin","superadmin"].includes(profile.role)&&<a href="/admin"><Users size={19}/> 계정 관리</a>}</nav><div className="side-footer"><span>비공식 개발 버전</span><button onClick={logout}><LogOut size={17}/> 로그아웃</button></div></aside>
 <MobileNav role={profile.role}/><div className="main-content"><header className="topbar"><span>학교생활 대시보드</span><div className="user-chip"><UserRound size={18}/>{profile.display_name}<small>{roleName[profile.role]}</small></div></header>
 <div className="content"><div className="welcome"><span className="eyebrow">KEISUNG SMART</span><h1>안녕하세요, {profile.display_name}님! 👋</h1><p>오늘도 멋진 학교생활을 응원해요.</p></div>
 <div className="stat-grid"><div className="stat"><BookOpen/><strong>급식</strong><span>학교 식단 확인</span></div><div className="stat"><CalendarDays/><strong>학사 일정</strong><span>주요 일정 한눈에</span></div><div className="stat"><Umbrella/><strong>우산 대여</strong><span>외부 시스템 연결</span></div></div>
 {dataStatus&&<p className="notice">{dataStatus}</p>}
 <NoticePreview/><div className="widget-grid"><section className="widget" id="meal"><div className="widget-title"><BookOpen size={20}/><h2>이번 주 급식</h2></div>{meals.length?meals.map((m,i)=><div className="list-row" key={i}><b>{m.date}</b><span>{m.items.join(", ")}</span></div>):<div className="empty">표시할 급식 정보가 없어요.<small>NEIS API 설정 또는 제공 일정을 확인해 주세요.</small></div>}</section>
 <section className="widget" id="schedule"><div className="widget-title"><CalendarDays size={20}/><h2>다가오는 학사 일정</h2></div>{events.length?events.map((v,i)=><div className="list-row" key={i}><b>{v.date}</b><span>{v.name}</span></div>):<div className="empty">표시할 학사 일정이 없어요.<small>NEIS API 설정 또는 제공 일정을 확인해 주세요.</small></div>}</section></div>
 <section className="widget umbrella-widget" id="umbrella"><div><div className="widget-title"><Umbrella size={21}/><h2>우산 대여 시스템</h2></div><p>비가 오는 날에는 학교 우산 대여 시스템을 이용하세요.</p></div>{umbrella?<a className="outline" href={umbrella} target="_blank" rel="noopener noreferrer">우산 시스템 열기 ↗</a>:<span className="muted">관리자가 연동 URL을 설정하면 사용할 수 있어요.</span>}</section>
 <footer className="disclaimer"><ShieldCheck size={15}/> 이 앱은 비공식 개발 프로젝트이며 학교의 공식 학생증 또는 인증 수단이 아닙니다.</footer></div></div></main>;
}
