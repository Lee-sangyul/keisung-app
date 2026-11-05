"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserCheck, UserX, ScanLine, Megaphone, UserRound, BadgeCheck, ArrowUpRight, Activity } from "lucide-react";
import { supabase, type Profile } from "@/lib/supabase";
import { AdminShell } from "@/components/AdminShell";

type AccountSummary = { role: string; disabled: boolean };
type AdminAudit = { id: number; action: string; created_at: string; target_id: string };
const actionLabel: Record<string, string> = {
  create_account: "계정 발급",
  disable_account: "계정 비활성화",
  enable_account: "계정 재활성화",
  reset_password: "비밀번호 초기화",
};

export default function AdminHome() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [logs, setLogs] = useState<AdminAudit[]>([]);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (!active) return;
      if (!profile || profile.disabled) { router.replace("/dashboard"); return; }
      if (profile.must_change_password) { router.replace("/dashboard"); return; }
      if (profile.role !== "admin" && profile.role !== "superadmin") { router.replace("/dashboard"); return; }
      setMe(profile as Profile);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw Error("로그인이 만료됐어요.");
        const headers = { Authorization: "Bearer " + session.access_token };
        const [accountsResponse, auditResponse] = await Promise.all([
          fetch("/api/admin/accounts", { headers, cache: "no-store" }),
          fetch("/api/admin/audit", { headers, cache: "no-store" })
        ]);
        if (!accountsResponse.ok) throw Error("계정 현황을 불러오지 못했어요.");
        const accountsData = await accountsResponse.json();
        const auditData = auditResponse.ok ? await auditResponse.json() : { logs: [] };
        if (!active) return;
        setAccounts(accountsData.accounts || []);
        setLogs(auditData.logs || []);
        if (!auditResponse.ok) setError("작업 기록을 불러오지 못했습니다.");
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "관리 현황 조회 실패");
      } finally {
        if (active) setFetching(false);
      }
    })();
    return () => { active = false; };
  }, [router]);

  if (!me) return <main className="center">관리자 접근 권한 확인 중...</main>;
  const activeAccounts = accounts.filter(account => !account.disabled).length;
  const disabledAccounts = accounts.filter(account => account.disabled).length;
  const students = accounts.filter(account => account.role === "student").length;
  const teachers = accounts.filter(account => account.role === "teacher").length;

  return <AdminShell profile={me}>
    <div className="admin-portal-heading">
      <div><p className="admin-portal-eyebrow">KEISUNG SMART · ADMINISTRATION</p>
        <h1>관리자 대시보드</h1>
        <p>{me.display_name}님, 계정과 운영 상태를 이곳에서 관리하세요.</p>
      </div>
      <span className="admin-portal-label">비공식 개발 환경</span>
    </div>
    {error && <p role="alert" className="notice">{error}</p>}
    <div className="admin-metric-grid">
      <div className="admin-metric"><span><Users size={19}/> 조회된 계정</span><strong>{fetching ? "…" : accounts.length}</strong><small>최근 최대 200개 기준</small></div>
      <div className="admin-metric"><span><UserCheck size={19}/> 활성 계정</span><strong>{fetching ? "…" : activeAccounts}</strong><small>비활성 상태 제외</small></div>
      <div className="admin-metric"><span><UserRound size={19}/> 학생 / 교사</span><strong>{fetching ? "…" : students + " / " + teachers}</strong><small>조회된 계정의 역할 구분</small></div>
      <div className="admin-metric"><span><UserX size={19}/> 비활성 계정</span><strong>{fetching ? "…" : disabledAccounts}</strong><small>로그인 사용 제한</small></div>
    </div>

    <section className="admin-portal-section">
      <h2>운영 바로가기</h2>
      <div className="admin-quick-grid">
        <a href="/admin/accounts" className="admin-quick-card"><Users size={25}/><strong>계정 관리</strong><span>학생·교사 계정 발급, 비활성화, 비밀번호 초기화</span><ArrowUpRight className="admin-quick-arrow" size={20}/></a>
        <a href="/admin/verify" className="admin-quick-card"><ScanLine size={25}/><strong>QR 신분 확인</strong><span>학생증 및 교직원증 일회용 QR 검증</span><ArrowUpRight className="admin-quick-arrow" size={20}/></a>
        <a href="/announcements" className="admin-quick-card"><Megaphone size={25}/><strong>공지 관리</strong><span>학교 공지사항 작성·수정·게시</span><ArrowUpRight className="admin-quick-arrow" size={20}/></a>
        <a href="/staff-id" className="admin-quick-card"><BadgeCheck size={25}/><strong>내 교직원증</strong><span>내 개발용 교직원증 확인 및 QR 발급</span><ArrowUpRight className="admin-quick-arrow" size={20}/></a>
      </div>
    </section>

    <section className="admin-portal-section admin-activity-section">
      <div className="admin-portal-section-head"><h2><Activity size={21}/> 최근 관리자 작업</h2><a href="/admin/accounts">계정 관리로 이동 <ArrowUpRight size={15}/></a></div>
      <div className="admin-activity-list">
        {logs.length ? logs.slice(0, 5).map(log => <div className="admin-activity-row" key={log.id}>
          <span>{actionLabel[log.action] || log.action}</span>
          <time>{new Date(log.created_at).toLocaleString("ko-KR")}</time>
        </div>) : <div className="admin-activity-empty">{fetching ? "작업 기록을 불러오는 중..." : "표시할 관리자 작업 기록이 없어요."}</div>}
      </div>
    </section>
    <p className="disclaimer">개발용 관리자 포털입니다. 실제 학교 운영과 학생 개인정보 처리에는 별도 승인이 필요합니다.</p>
  </AdminShell>;
}
