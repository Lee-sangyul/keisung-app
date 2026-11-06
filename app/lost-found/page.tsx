"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,Camera,CheckCircle2,ImageIcon,MapPin,PackageSearch,Plus,RotateCcw,Search,ShieldCheck} from "lucide-react";
import {supabase,type Profile} from "@/lib/supabase";
import {AdminShell} from "@/components/AdminShell";
import {MobileNav} from "@/components/MobileNav";

type LostItem={
 id:string; title:string; description:string; foundLocation:string; foundDate:string;
 status:"available"|"returned"; createdAt:string; returnedAt:string|null; imageUrl:string|null;
};
function localDate(){
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}

export default function LostFoundPage(){
 const router=useRouter();
 const [profile,setProfile]=useState<Profile|null>(null);
 const [items,setItems]=useState<LostItem[]>([]);
 const [loading,setLoading]=useState(true);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 const [showForm,setShowForm]=useState(false);
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState<"all"|"available"|"returned">("all");
 const [title,setTitle]=useState("");
 const [location,setLocation]=useState("");
 const [description,setDescription]=useState("");
 const [foundDate,setFoundDate]=useState(localDate());
 const [photo,setPhoto]=useState<File|null>(null);
 const admin=!!profile&&["admin","superadmin"].includes(profile.role);

 const load=useCallback(async()=>{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw Error("로그인 상태를 확인해 주세요.");
  const response=await fetch("/api/lost-found",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
  const body=await response.json();
  if(!response.ok)throw Error(body.error||"분실물 조회 실패");
  setItems(body.items||[]);
 },[]);

 useEffect(()=>{
  let active=true;
  (async()=>{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){router.replace("/");return;}
   const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();
   if(!active)return;
   if(!p||p.disabled||p.must_change_password){router.replace("/dashboard");return;}
   setProfile(p as Profile);
   try{await load();}catch(e){if(active)setStatus(e instanceof Error?e.message:"조회 실패");}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[router,load]);

 const filtered=useMemo(()=>items.filter(i=>{
  if(filter!=="all"&&i.status!==filter)return false;
  const q=search.trim().toLowerCase();
  return !q||[i.title,i.description,i.foundLocation].some(s=>s.toLowerCase().includes(q));
 }),[items,filter,search]);

 async function create(e:React.FormEvent){
  e.preventDefault();if(!admin||busy)return;
  setBusy(true);setStatus("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error("로그인이 필요합니다.");
   if(photo&&photo.size>3*1024*1024)throw Error("사진은 3MB 이하여야 합니다.");
   const form=new FormData();
   form.append("title",title.trim());
   form.append("description",description.trim());
   form.append("location",location.trim());
   form.append("foundDate",foundDate);
   if(photo)form.append("photo",photo);
   const response=await fetch("/api/lost-found",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`},body:form});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||"등록 실패");
   setTitle("");setLocation("");setDescription("");setPhoto(null);setFoundDate(localDate());setShowForm(false);
   await load();setStatus("분실물을 등록했어요.");
  }catch(e){setStatus(e instanceof Error?e.message:"등록 오류");}
  finally{setBusy(false);}
 }

 async function setItemStatus(item:LostItem){
  if(!admin||busy)return;
  const next=item.status==="available"?"returned":"available";
  if(!window.confirm(next==="returned"?"수령 완료로 표시할까요? 학생 목록에서 사라집니다.":"이 분실물을 다시 공개할까요?"))return;
  setBusy(true);setStatus("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error("로그인이 필요합니다.");
   const res=await fetch(`/api/lost-found/${item.id}`,{
    method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
    body:JSON.stringify({status:next}),
   });
   const data=await res.json();if(!res.ok)throw Error(data.error||"상태 변경 실패");
   await load();setStatus(next==="returned"?"수령 완료로 처리했어요.":"다시 공개했어요.");
  }catch(e){setStatus(e instanceof Error?e.message:"변경 실패");}
  finally{setBusy(false);}
 }

 if(loading||!profile)return <main className="center">분실물 센터 불러오는 중...</main>;

 const content=<div className="lf-page">
  <a className="back" href={admin?"/admin":"/dashboard"}><ArrowLeft size={17}/>{admin?"관리자 홈":"대시보드"}</a>
  <div className="section-heading lf-heading">
   <div><span className="eyebrow" style={{color:"#3166ae"}}>LOST & FOUND</span><h1>분실물 센터</h1>
    <p className="muted">{admin?"분실물을 등록하고 수령 여부를 관리하세요.":"학교에서 발견한 분실물을 사진과 장소로 찾아보세요."}</p>
   </div>
   {admin&&<button className="outline lf-add-button" onClick={()=>setShowForm(!showForm)}><Plus size={18}/>{showForm?"등록 닫기":"분실물 등록"}</button>}
  </div>
  {status&&<p className="status-box" role="status">{status}</p>}
  {admin&&showForm&&<section className="widget lf-form-widget">
   <div className="widget-title"><Camera size={21}/><h2>새 분실물 등록</h2></div>
   <form className="admin-form" onSubmit={create}>
    <label htmlFor="lf-title">분실물 이름</label><input id="lf-title" required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 검정색 텀블러"/>
    <label htmlFor="lf-location">발견 장소</label><input id="lf-location" required maxLength={120} value={location} onChange={e=>setLocation(e.target.value)} placeholder="예: 3층 복도"/>
    <label htmlFor="lf-date">습득 날짜</label><input id="lf-date" type="date" required value={foundDate} onChange={e=>setFoundDate(e.target.value)}/>
    <label htmlFor="lf-description">특징 (선택)</label><textarea id="lf-description" rows={3} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="색상, 특징 등을 적어 주세요. 이름·연락처 등 개인정보는 올리지 마세요."/>
    <label htmlFor="lf-photo">분실물 사진 (선택 · 최대 3MB)</label>
    <input id="lf-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]||null)}/>
    <button className="primary" disabled={busy}>{busy?"등록 중...":"분실물 등록"}</button>
   </form>
  </section>}

  <section className="lf-tools" aria-label="분실물 필터">
   <label className="lf-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="분실물 이름·습득 장소 검색" aria-label="분실물 검색"/></label>
   {admin&&<select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} aria-label="분실물 상태 필터">
    <option value="all">전체</option><option value="available">보관 중</option><option value="returned">수령 완료</option>
   </select>}
   <span className="lf-count">{filtered.length}건</span>
  </section>

  <div className="lf-grid">
   {filtered.map(item=><article className="lf-card" key={item.id}>
    <div className="lf-photo">{item.imageUrl?<img src={item.imageUrl} alt={item.title+" 분실물 사진"} loading="lazy"/>:<div className="lf-photo-empty"><ImageIcon size={38}/><span>사진 없음</span></div>}</div>
    <div className="lf-card-body">
     <span className={item.status==="available"?"lf-status":"lf-status lf-status-done"}>{item.status==="available"?"보관 중":"수령 완료"}</span>
     <h2>{item.title}</h2>
     <p className="lf-place"><MapPin size={16}/>{item.foundLocation}</p>
     <p className="lf-found-date">습득일 {item.foundDate}</p>
     {item.description&&<p className="lf-description">{item.description}</p>}
     {admin&&<button className="lf-status-button" disabled={busy} onClick={()=>setItemStatus(item)}>
      {item.status==="available"?<><CheckCircle2 size={17}/> 수령 완료 처리</>:<><RotateCcw size={17}/> 다시 공개하기</>}
     </button>}
    </div>
   </article>)}
  </div>
  {!filtered.length&&<div className="widget lf-empty"><PackageSearch size={38}/><h2>표시할 분실물이 없어요.</h2><p>검색어를 변경하거나 나중에 다시 확인해 주세요.</p></div>}
  <p className="disclaimer"><ShieldCheck size={16}/> 학생은 분실물 목록 조회만 가능해요. 수령 확인은 관리자를 통해 진행해 주세요.</p>
 </div>;

 return admin?<AdminShell profile={profile}>{content}</AdminShell>:
  <main className="admin-page lf-layout"><MobileNav role={profile.role}/>{content}</main>;
}
