"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, BadgeCheck, ArrowUpRight, ShieldCheck } from "lucide-react";
import { supabase, type Profile } from "@/lib/supabase";
import { AdminShell } from "@/components/AdminShell";

export default function AdminQrVerification() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (!active) return;
      if (!profile || profile.disabled || profile.must_change_password ||
        (profile.role !== "admin" && profile.role !== "superadmin")) {
        router.replace("/dashboard"); return;
      }
      setMe(profile as Profile);
    })();
    return () => { active = false; };
  }, [router]);

  if (!me) return <main className="center">관리자 권한 확인 중...</main>;
  return <AdminShell profile={me}>
    <div className="admin-portal-heading">
      <div><p className="admin-portal-eyebrow">CREDENTIAL VERIFICATION</p><h1>QR 검증 센터</h1>
        <p>교직원증과 학생증 QR을 서버에서 검증합니다.</p>
      </div>
    </div>
    <div className="admin-quick-grid admin-verify-grid">
      <a href="/student-id/verify" className="admin-quick-card">
        <GraduationCap size={30}/>
        <strong>학생증 검증</strong>
        <span>학생이 발급한 1회용 QR 검증 · 45초 유효</span>
        <ArrowUpRight className="admin-quick-arrow" size={20}/>
      </a>
      <a href="/staff-id/verify" className="admin-quick-card">
        <BadgeCheck size={30}/>
        <strong>교직원증 검증</strong>
        <span>교직원 계정 확인 및 검증 기록 저장</span>
        <ArrowUpRight className="admin-quick-arrow" size={20}/>
      </a>
    </div>
    <div className="admin-verify-info"><ShieldCheck size={22}/>
      <p><strong>운영 안내</strong> QR을 화면에 표시하는 것만으로 신원을 보장하지 않아요.
      서버 검증 성공 화면을 확인해야 하며, 학교 승인 전에는 공식 증명이나 출입 통제에 사용할 수 없습니다.</p>
    </div>
  </AdminShell>;
}
