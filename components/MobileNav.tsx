"use client";
import {usePathname} from "next/navigation";
import {House,UserRound,Shield,IdCard,BadgeCheck,ClipboardList,CalendarDays,PackageSearch} from "lucide-react";
import type {Role} from "@/lib/supabase";

export function MobileNav({role}:{role?:Role}){
 const path=usePathname();
 const admin=role==="admin"||role==="superadmin";
 const items=admin?[
   {href:"/admin",name:"관리 홈",Icon:House},
   {href:"/admin/accounts",name:"계정",Icon:Shield},
   {href:"/lost-found",name:"분실물",Icon:PackageSearch},
   {href:"/surveys",name:"설문",Icon:ClipboardList},
   {href:"/profile",name:"내 정보",Icon:UserRound},
 ]:role==="student"?[
   {href:"/dashboard",name:"홈",Icon:House},
   {href:"/timetable",name:"시간표",Icon:CalendarDays},
   {href:"/lost-found",name:"분실물",Icon:PackageSearch},
   {href:"/student-id",name:"학생증",Icon:IdCard},
   {href:"/profile",name:"내 정보",Icon:UserRound},
 ]:[
   {href:"/dashboard",name:"홈",Icon:House},
   {href:"/lost-found",name:"분실물",Icon:PackageSearch},
   {href:"/staff-id",name:"교직원증",Icon:BadgeCheck},
   {href:"/surveys",name:"설문",Icon:ClipboardList},
   {href:"/profile",name:"내 정보",Icon:UserRound},
 ];
 return <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
  {items.map(({href,name,Icon})=><a key={href} href={href}
   className={path===href?"selected":""} aria-current={path===href?"page":undefined}>
   <Icon size={21} strokeWidth={path===href?2.5:1.9}/><span>{name}</span>
  </a>)}
 </nav>;
}
