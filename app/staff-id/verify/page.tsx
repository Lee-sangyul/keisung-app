"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, ScanLine, ShieldCheck } from "lucide-react";
import { supabase, type Profile } from "@/lib/supabase";
import { MobileNav } from "@/components/MobileNav";

type StaffResult = {
  valid: boolean;
  staff: { name: string; role: string; roleLabel: string };
  verifiedAt: string;
  notice: string;
};
type BarcodeValue = { rawValue: string };
type Scanner = { detect(source: HTMLVideoElement): Promise<BarcodeValue[]> };
type ScannerCtor = new (options: { formats: string[] }) => Scanner;

export default function StaffVerifyPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile|null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<StaffResult|null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const scanningRef = useRef(false);

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCamera(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id",user.id).single();
      if (!active) return;
      if (!p || p.disabled || p.must_change_password || !["admin","superadmin"].includes(p.role)) {
        router.replace("/dashboard"); return;
      }
      setProfile(p as Profile);
    })();
    return () => {
      active = false;
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  },[router]);

  async function verify(value: string) {
    if (busy) return;
    setBusy(true); setResult(null); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw Error("로그인이 필요합니다.");
      const response = await fetch("/api/staff-id/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token: value.trim() }),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error || "검증에 실패했어요.");
      setResult(payload as StaffResult); setText("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR 검증 오류");
    } finally { setBusy(false); }
  }

  async function startCamera() {
    setMessage("");
    try {
      const detectorConstructor = (window as Window & { BarcodeDetector?: ScannerCtor }).BarcodeDetector;
      if (!detectorConstructor) throw Error("이 브라우저는 카메라 QR 인식을 지원하지 않아요. QR 데이터를 직접 입력해 주세요.");
      if (!navigator.mediaDevices?.getUserMedia) throw Error("카메라 사용이 불가능한 환경이에요. HTTPS로 접속해 주세요.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, audio: false
      });
      streamRef.current = stream;
      setCamera(true);
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      const scanner = new detectorConstructor({ formats: ["qr_code"] });
      scanningRef.current = true;
      while (scanningRef.current) {
        const codes = await scanner.detect(video);
        if (codes.length) {
          stopCamera();
          await verify(codes[0].rawValue);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 280));
      }
    } catch (error) {
      stopCamera();
      setMessage(error instanceof Error ? error.message : "카메라 오류");
    }
  }

  if (!profile) return <main className="center">관리자 권한 확인 중...</main>;
  return <main className="admin-page staff-verify-page">
    <MobileNav role={profile.role}/>
    <a className="back" href="/staff-id"><ArrowLeft size={17}/> 교직원증</a>
    <header className="staff-id-heading">
      <span className="eyebrow">STAFF VALIDATION</span>
      <h1>교직원증 검증</h1>
      <p>관리자 전용 · QR은 검증 시 즉시 소멸합니다.</p>
    </header>
    <section className="widget staff-verify-widget">
      <div className="widget-title"><ScanLine size={22}/><h2>QR 코드 검사</h2></div>
      <p className="muted">QR 스캔을 이용하거나 데이터를 직접 입력하세요.</p>
      <video className={camera ? "staff-verify-video" : "staff-verify-video-hidden"} ref={videoRef} muted playsInline />
      <button className="outline staff-camera-btn" type="button" onClick={camera ? stopCamera : startCamera}>
        <Camera size={17}/>{camera ? "카메라 중지" : "카메라로 스캔"}
      </button>
      <form className="admin-form" onSubmit={e => { e.preventDefault(); void verify(text); }}>
        <label htmlFor="staff-qr-token">QR 데이터</label>
        <input id="staff-qr-token" value={text} onChange={e=>setText(e.target.value)}
          placeholder="KSSTAFF1:..." autoComplete="off" required />
        <button className="primary" disabled={busy}>{busy ? "확인 중..." : "서버 검증"}</button>
      </form>
      {message && <div className="error" role="alert">{message}</div>}
      {result && <section className="staff-verify-result" role="status">
        <ShieldCheck size={30}/>
        <h2>검증 성공</h2>
        <strong>{result.staff.name}</strong>
        <p>{result.staff.roleLabel}</p>
        <small>{new Date(result.verifiedAt).toLocaleString("ko-KR")} · QR 사용 완료</small>
        <small>{result.notice}</small>
      </section>}
    </section>
  </main>;
}
