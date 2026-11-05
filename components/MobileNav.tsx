"use client";
import { usePathname } from "next/navigation";
import { House, Megaphone, UserRound, Shield, IdCard } from "lucide-react";
import type { Role } from "@/lib/supabase";
export function MobileNav({role}:{role?:Role}) {
 const path=usePathname();
 const items=[
  {href:"/dashboard",name:"홈",Icon:House},
  {href:"/announcements",name:"공지",Icon:Megaphone},
  {href:"/student-id",name:"학생증",Icon:IdCard},
  {href:"/profile",name:"내 정보",Icon:UserRound},
  ...(role==="admin"||role==="superadmin"?[{href:"/admin",name:"관리",Icon:Shield}]:[])
 ];
 return <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
  {items.map(({href,name,Icon})=><a key={href} href={href} className={path===href?"selected":""} aria-current={path===href?"page":undefined}><Icon size={21} strokeWidth={path===href?2.5:1.9}/><span>{name}</span></a>)}
 </nav>;
}
