"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, ChevronRight, CloudSun, LockKeyhole, ShieldCheck, Umbrella } from "lucide-react";
import { supabase, accountEmail } from "@/lib/supabase";
export default function Home() {
  const router = useRouter();
  const [id, setId] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({data}) => { if(data.session) router.replace("/dashboard"); }); }, [router]);
  async function login(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      if (!/^[a-z0-9._-]{3,32}$/.test(id.trim().toLowerCase())) throw new Error("ID는 영문 소문자·숫자·._-로 3~32자여야 해요.");
      const { error } = await supabase.auth.signInWithPassword({email: accountEmail(id), password});
      if (error) throw new Error("아이디 또는 비밀번호를 확인해 주세요.");
      router.replace("/dashboard");
    } catch (err) { setError(err instanceof Error ? err.message : "로그인에 실패했어요."); }
    finally { setLoading(false); }
  }
  return <main className="landing">
    <section className="hero"><div className="brand"><div className="brand-icon">K</div><span>KEISUNG SMART <small>개발 버전 · 학교 공식 서비스 아님</small></span></div>
      <div className="hero-main"><span className="eyebrow">우리 학교의 하루, 더 스마트하게</span><h1>학교생활의 모든 순간을<br/><em>한곳에서.</em></h1><p>급식부터 학사 일정, 우산 대여까지. 학교생활을 더 쉽고 편리하게 연결합니다.</p>
      <div className="features"><span><BookOpen size={18}/> 급식</span><span><CalendarDays size={18}/> 학사일정</span><span><Umbrella size={18}/> 우산 대여</span></div></div><div className="hero-foot">Keisung App · PWA <ChevronRight size={16}/></div></section>
    <section className="login-area"><div className="login-card"><div className="login-mark"><LockKeyhole size={26}/></div><h2>계정 로그인</h2><p>관리자가 발급한 계성 스마트 계정으로 로그인하세요.</p>
      <form onSubmit={login}><label htmlFor="account">아이디</label><input id="account" autoComplete="username" value={id} onChange={e=>setId(e.target.value)} placeholder="발급받은 아이디" required/>
      <label htmlFor="password">비밀번호</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호 입력" required/>
      {error && <div role="alert" className="error">{error}</div>}<button className="primary" disabled={loading}>{loading?"로그인 중...":"로그인"} <ChevronRight size={18}/></button></form>
      <div className="login-help"><ShieldCheck size={16}/> 회원가입은 제공하지 않으며 계정은 관리자만 발급합니다.</div></div><p className="legal">이 앱은 개발 중인 비공식 프로젝트입니다. 학교 승인 전 실제 학생 개인정보를 입력하지 마세요.</p></section>
  </main>;
}
