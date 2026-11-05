"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, KeyRound, QrCode, RefreshCw, ShieldAlert } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { supabase, type Profile } from "@/lib/supabase";

type IssuedQr = { svg: string; expiresAt: string; ttlSeconds: number };
const labelByRole: Record<string, string> = {
  teacher: "교사",
  admin: "관리자",
  superadmin: "시스템 관리자",
};

function qrImageUrl(svg: string): string {
  if (!/^<svg[\s>]/.test(svg) || /<script|onload\s*=|foreignObject/i.test(svg)) return "";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export default function StaffIdPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [issued, setIssued] = useState<IssuedQr | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (!active) return;
      if (!p || p.disabled || p.must_change_password) { router.replace("/dashboard"); return; }
      setProfile(p as Profile);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!issued) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, Math.ceil(
      (Date.parse(issued.expiresAt) - Date.now()) / 1000
    )));
    tick();
    const timer = setInterval(tick, 300);
    return () => clearInterval(timer);
  }, [issued]);

  const issueQr = useCallback(async () => {
    setMessage(""); setBusy(true); setIssued(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw Error("다시 로그인해 주세요.");
      const response = await fetch("/api/staff-id/issue", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error || "발급에 실패했습니다.");
      setIssued(payload as IssuedQr);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR 발급 중 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (loading) return <main className="center">교직원 계정 확인 중...</main>;
  if (!profile) return null;

  const allowed = ["teacher","admin","superadmin"].includes(profile.role);
  if (!allowed) return <main className="staff-id-page">
    <MobileNav role={profile.role} />
    <div className="staff-id-wrap">
      <a href={["admin","superadmin"].includes(profile.role)?"/admin":"/dashboard"} className="back"><ArrowLeft size={18}/> 홈으로</a>
      <h1>교직원증</h1>
      <p className="muted">교직원 계정 전용 기능입니다. 학생은 학생증 탭을 이용해 주세요.</p>
    </div>
  </main>;

  return <main className="staff-id-page">
    <MobileNav role={profile.role} />
    <div className="staff-id-wrap">
      <a href="/dashboard" className="back"><ArrowLeft size={18} /> 대시보드</a>
      <header className="staff-id-heading">
        <span className="eyebrow">KEISUNG SMART</span>
        <h1>모바일 교직원증</h1>
        <p>계성 스마트 계정 확인 · 개발용</p>
      </header>

      <article className="staff-id-card" aria-label="개발용 교직원증">
        <div className="staff-id-top">
          <div className="staff-id-logo">K</div>
          <div><strong>계성 스마트</strong><small>STAFF ID · DEVELOPMENT ONLY</small></div>
          <span className="staff-id-badge">비공식</span>
        </div>
        <div className="staff-id-person">
          <span>STAFF</span>
          <h2>{profile.display_name}</h2>
          <p>{labelByRole[profile.role]}</p>
        </div>
        <div className="staff-id-footer"><BadgeCheck size={18} /> 개발용 교직원 확인증 · 공식 신분증 아님</div>
      </article>

      <section className="staff-id-qr-panel">
        <h2><QrCode size={20}/> 일회용 QR 검증</h2>
        {issued && remaining > 0 ? <>
          <img className="staff-id-qr" src={qrImageUrl(issued.svg)} alt="서버에서 발급한 45초 유효 일회용 QR" />
          <p className="staff-id-countdown">남은 유효시간 <strong>{remaining}초</strong></p>
        </> : <div className="staff-id-qr-empty">
          <KeyRound size={42}/>
          <span>{issued ? "QR이 만료됐어요. 다시 발급해 주세요." : "발급 버튼을 눌러 일회용 QR을 표시하세요."}</span>
        </div>}
        <button className="primary" onClick={issueQr} disabled={busy}>
          <RefreshCw size={17}/>{busy ? "생성 중..." : issued ? "새 QR 발급" : "QR 발급"}
        </button>
        {message && <div className="error" role="alert">{message}</div>}
      </section>

      {["admin","superadmin"].includes(profile.role) &&
        <a href="/staff-id/verify" className="staff-id-verify-link"><BadgeCheck size={18}/> 관리자용 QR 검증 페이지로 이동</a>}
      <p className="staff-id-note"><ShieldAlert size={18}/> 이 QR은 45초 유효하며 1회 검증 후 사용할 수 없어요.
        화면 캡처만으로 진위를 보장할 수 없으므로 반드시 서버 검증 결과를 확인해야 합니다.</p>
    </div>
  </main>;
}
