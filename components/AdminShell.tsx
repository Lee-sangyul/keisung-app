"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, ScanLine, Megaphone, UserRound, LogOut, Shield } from "lucide-react";
import { supabase, type Profile } from "@/lib/supabase";
import { MobileNav } from "@/components/MobileNav";

const pages = [
  { href: "/admin", label: "관리자 홈", Icon: LayoutDashboard },
  { href: "/admin/accounts", label: "계정 관리", Icon: Users },
  { href: "/admin/verify", label: "QR 검증", Icon: ScanLine },
  { href: "/announcements", label: "공지사항", Icon: Megaphone },
  { href: "/profile", label: "내 정보", Icon: UserRound },
];

export function AdminShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError("로그아웃에 실패했어요. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }
  return <main className="admin-layout">
    <aside className="admin-rail">
      <a href="/admin" className="admin-rail-brand">
        <span className="admin-rail-logo"><Shield size={24}/></span>
        <span>계성 스마트<small>ADMIN CONSOLE · 개발용</small></span>
      </a>
      <div className="admin-rail-label">관리 메뉴</div>
      <nav aria-label="관리자 메뉴">
        {pages.map(({ href, label, Icon }) => {
          const active = path === href;
          return <a key={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={href}>
            <Icon size={19}/><span>{label}</span>
          </a>;
        })}
      </nav>
      <div className="admin-rail-footer">
        <div className="admin-rail-user"><UserRound size={18}/><span>{profile.display_name}<small>{profile.role === "superadmin" ? "시스템 관리자" : "관리자"}</small></span></div>
        {error && <p className="admin-rail-error" role="alert">{error}</p>}
        <button onClick={logout} disabled={busy}><LogOut size={18}/>{busy ? "로그아웃 중..." : "로그아웃"}</button>
      </div>
    </aside>
    <MobileNav role={profile.role}/>
    <section className="admin-workspace">
      <header className="admin-workspace-header">
        <span><Shield size={18}/> 관리자 포털</span>
        <span className="admin-workspace-account">{profile.display_name} · {profile.role === "superadmin" ? "시스템 관리자" : "관리자"}</span>
      </header>
      <div className="admin-workspace-body">{children}</div>
    </section>
  </main>;
}
