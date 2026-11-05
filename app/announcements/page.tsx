"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,Plus,Pin,Trash2,Pencil} from "lucide-react";
import {supabase,type Profile} from "@/lib/supabase";
import {MobileNav} from "@/components/MobileNav";
type Notice={id:string;title:string;body:string;audience:"all"|"student"|"teacher";published:boolean;pinned:boolean;author_id:string;created_at:string};
const labels={all:"전체",student:"학생",teacher:"교사"};
export default function Announcements(){
 const router=useRouter();const [me,setMe]=useState<Profile|null>(null),[items,setItems]=useState<Notice[]>([]),[status,setStatus]=useState(""),[loading,setLoading]=useState(true);
 const [form,setForm]=useState(false),[editId,setEditId]=useState<string|null>(null),[title,setTitle]=useState(""),[body,setBody]=useState(""),[audience,setAudience]=useState<"all"|"student"|"teacher">("all"),[pinned,setPinned]=useState(false),[published,setPublished]=useState(true);
 const canWrite=me&&["teacher","admin","superadmin"].includes(me.role);
 async function auth(){return (await supabase.auth.getSession()).data.session?.access_token;}
 async function load(manage:boolean){
  const t=await auth();if(!t)return;
  const res=await fetch("/api/announcements"+(manage?"?manage=1":""),{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});
  const d=await res.json();if(res.ok)setItems(d.announcements||[]);else setStatus(d.error||"불러오기 실패");
 }
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/");return;}
 const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();
 if(!p||p.disabled||p.must_change_password){router.replace("/dashboard");return;}
 setMe(p as Profile);await load(["teacher","admin","superadmin"].includes(p.role));setLoading(false);
 })();},[router]);
 function reset(){setTitle("");setBody("");setAudience("all");setPinned(false);setPublished(true);setEditId(null);setForm(false);}
 function edit(n:Notice){setTitle(n.title);setBody(n.body);setAudience(n.audience);setPinned(n.pinned);setPublished(n.published);setEditId(n.id);setForm(true);window.scrollTo({top:0,behavior:"smooth"});}
 async function save(e:React.FormEvent){e.preventDefault();setStatus("");const t=await auth();const res=await fetch(editId?`/api/announcements/${editId}`:"/api/announcements",{method:editId?"PATCH":"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({title,body,audience,pinned,published})});const d=await res.json();if(!res.ok){setStatus(d.error||"저장 실패");return;}reset();await load(true);setStatus("공지사항을 저장했어요.");}
 async function remove(n:Notice){if(!window.confirm(`'${n.title}' 공지를 삭제할까요?`))return;const t=await auth();const res=await fetch(`/api/announcements/${n.id}`,{method:"DELETE",headers:{Authorization:`Bearer ${t}`}});if(res.ok){await load(true);setStatus("삭제 완료");}else setStatus("삭제 실패");}
 if(loading)return <main className="center">공지사항 불러오는 중...</main>;
 return <main className="admin-page"><MobileNav role={me?.role}/><a href="/dashboard" className="back"><ArrowLeft size={17}/> 대시보드</a>
 <div className="section-heading"><div><p className="eyebrow">SCHOOL BOARD</p><h1>학교 공지사항</h1><p className="muted">학교생활의 중요한 소식을 확인하세요.</p></div>{canWrite&&<button className="outline" onClick={()=>{reset();setForm(true);}}><Plus size={16}/> 공지 작성</button>}</div>
 {status&&<p role="status" className="status-box">{status}</p>}
 {form&&canWrite&&<section className="widget notice-compose"><h2>{editId?"공지 수정":"새 공지 작성"}</h2><form onSubmit={save} className="admin-form"><label>제목</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={150} required/><label>내용</label><textarea rows={7} value={body} onChange={e=>setBody(e.target.value)} maxLength={10000} required/><label>대상</label><select value={audience} onChange={e=>setAudience(e.target.value as typeof audience)}><option value="all">전체</option><option value="student">학생</option><option value="teacher">교사</option></select>{me?.role!=="teacher"&&<label className="check-line"><input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)}/> 상단 고정</label>}{editId&&<label className="check-line"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> 공개</label>}<div className="action-row"><button className="primary" type="submit">저장하기</button><button type="button" className="outline" onClick={reset}>취소</button></div></form></section>}
 <section className="notice-list">{items.length===0?<div className="widget empty">등록된 공지사항이 없어요.</div>:items.map(n=><article key={n.id} className="widget notice-item"><div className="notice-meta">{n.pinned&&<span className="pill"><Pin size={13}/> 고정</span>}<span className="pill">{labels[n.audience]}</span>{!n.published&&<span className="pill">비공개</span>}<time>{new Date(n.created_at).toLocaleDateString("ko-KR")}</time></div><h2>{n.title}</h2><p className="notice-body">{n.body}</p>{canWrite&&(me?.role!=="teacher"||n.author_id===me.id)&&<div className="action-row"><button className="outline" onClick={()=>edit(n)}><Pencil size={15}/> 수정</button><button className="outline" onClick={()=>remove(n)}><Trash2 size={15}/> 삭제</button></div>}</article>)}</section>
 </main>;
}
