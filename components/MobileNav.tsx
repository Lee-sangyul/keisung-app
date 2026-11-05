"use client";
import { usePathname } from "next/navigation";
import { House, Megaphone, UserRound, Shield, IdCard, BadgeCheck, ClipboardList } from "lucide-react";
import type { Role } from "@/lib/supabase";
export function MobileNav({role}:{role?:Role}) {
 const path=usePathname();
 const isAdmin=role==="admin"||role==="superadmin";
 const items=isAdmin?[
  {href:"/admin",name:"관리 홈",Icon:House},
  {href:"/admin/accounts",name:"계정",Icon:Shield},
  {href:"/admin/verify",name:"QR 검증",Icon:BadgeCheck},
  {href:"/surveys",name:"설문",Icon:ClipboardList},
  {href:"/profile",name:"내 정보",Icon:UserRound}
 ]:[
  {href:"/dashboard",name:"홈",Icon:House},
  {href:"/announcements",name:"공지",Icon:Megaphone},
  ...(role==="teacher"?[{href:"/staff-id",name:"교직원증",Icon:BadgeCheck}]:[{href:"/student-id",name:"학생증",Icon:IdCard}]),
  {href:"/surveys",name:"설문",Icon:ClipboardList},
  {href:"/profile",name:"내 정보",Icon:UserRound}
 ];
 return <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
  {items.map(({href,name,Icon})=><a key={href} href={href} className={path===href?"selected":""} aria-current={path===href?"page":undefined}><Icon size={21} strokeWidth={path===href?2.5:1.9}/><span>{name}</span></a>)}
 </nav>;
}
