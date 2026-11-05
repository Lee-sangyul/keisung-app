"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ClipboardList,Plus,ArrowLeft,BarChart3,LockKeyhole} from "lucide-react";
import {supabase,type Profile} from "@/lib/supabase";
import {AdminShell} from "@/components/AdminShell";
import {MobileNav} from "@/components/MobileNav";
type Survey={id:string;title:string;question:string;options:string[];audience:string;closes_at:string;closed:boolean;participated:boolean;results:number[]|null};
const audienceName:Record<string,string>={all:"전체",student:"학생",teacher:"교직원"};
export default function SurveyCenter(){
 const router=useRouter();const [me,setMe]=useState<Profile|null>(null),[items,setItems]=useState<Survey[]>([]);
 const [loading,setLoading]=useState(true),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 const [form,setForm]=useState(false),[title,setTitle]=useState(""),[question,setQuestion]=useState(""),[options,setOptions]=useState(["","",""]),[audience,setAudience]=useState("student"),[ends,setEnds]=useState("");
 const [answers,setAnswers]=useState<Record<string,number>>({});
 const manager=!!me&&["admin","superadmin"].includes(me.role);
 async function access(){return (await supabase.auth.getSession()).data.session?.access_token||"";}
 async function load(){const t=await access();if(!t)return;const r=await fetch("/api/surveys",{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});const d=await r.json();if(r.ok)setItems(d.surveys||[]);else setStatus(d.error||"설문 불러오기 실패");}
 useEffect(()=>{let active=true;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/");return;}const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();if(!active)return;if(!p||p.disabled||p.must_change_password){router.replace("/dashboard");return;}setMe(p as Profile);await load();if(active)setLoading(false);})();return()=>{active=false;};},[router]);
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setStatus("");try{
 const t=await access();const r=await fetch("/api/surveys",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({title,question,options:options.filter(x=>x.trim()),audience,closesAt:new Date(ends).toISOString()})});const d=await r.json();if(!r.ok)throw Error(d.error||"저장 실패");setForm(false);setTitle("");setQuestion("");setOptions(["","",""]);await load();setStatus("설문을 등록했어요.");
 }catch(e){setStatus(e instanceof Error?e.message:"오류");}finally{setBusy(false);}}
 async function vote(id:string){const selected=answers[id];if(selected===undefined)return;setBusy(true);setStatus("");try{const t=await access();const r=await fetch(`/api/surveys/${id}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({optionIndex:selected})});const d=await r.json();if(!r.ok)throw Error(d.error||"응답 실패");setStatus("익명 응답이 저장됐어요.");await load();}catch(e){setStatus(e instanceof Error?e.message:"오류");}finally{setBusy(false);}}
 async function close(id:string){if(!confirm("이 설문을 마감할까요? 다시 열 수 없습니다."))return;setBusy(true);setStatus("");try{const t=await access();const r=await fetch(`/api/surveys/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action:"close"})});if(!r.ok){const d=await r.json();throw Error(d.error||"마감 오류");}await load();}catch(e){setStatus(e instanceof Error?e.message:"오류");}finally{setBusy(false);}}
 if(loading||!me)return <main className="center">설문 센터 불러오는 중...</main>;
 const body=<div className="survey-page">
  <a href={manager?"/admin":"/dashboard"} className="back"><ArrowLeft size={17}/>{manager?"관리자 홈":"대시보드"}</a>
  <div className="section-heading"><div><p className="eyebrow" style={{color:"#2861b7"}}>SCHOOL VOICE</p><h1>설문 센터</h1><p className="muted">한 계정당 한 번 참여할 수 있어요. 응답 선택값과 계정 ID는 별도로 저장됩니다.</p></div>{manager&&<button className="outline" onClick={()=>setForm(!form)}><Plus size={17}/> 설문 만들기</button>}</div>
  {status&&<p className="status-box" role="status">{status}</p>}
  {manager&&form&&<section className="widget survey-create"><h2>새 설문 만들기</h2><form className="admin-form" onSubmit={create}>
   <label>설문 제목<input value={title} maxLength={120} required onChange={e=>setTitle(e.target.value)}/></label>
   <label>질문<textarea value={question} maxLength={500} required rows={3} onChange={e=>setQuestion(e.target.value)}/></label>
   <label>응답 대상<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="student">학생</option><option value="teacher">교직원</option><option value="all">전체</option></select></label>
   <label>마감 일시<input type="datetime-local" required value={ends} onChange={e=>setEnds(e.target.value)}/></label>
   <h3>선택지 (2~6개)</h3>{options.map((value,i)=><label key={i}>선택지 {i+1}<input value={value} maxLength={120} onChange={e=>setOptions(o=>o.map((v,j)=>j===i?e.target.value:v))}/></label>)}
   <div className="action-row"><button className="outline" type="button" disabled={options.length===6} onClick={()=>setOptions(o=>[...o,""])}>선택지 추가</button>{options.length>2&&<button className="outline" type="button" onClick={()=>setOptions(o=>o.slice(0,-1))}>마지막 삭제</button>}</div>
   <button className="primary" disabled={busy}>설문 등록</button>
  </form></section>}
  <div className="survey-list">{items.map(s=>{const finished=s.closed||new Date(s.closes_at).getTime()<=Date.now();const total=s.results?.reduce((a,b)=>a+b,0)||0;return <article className="widget survey-card" key={s.id}>
   <div className="notice-meta"><span className="pill">{audienceName[s.audience]}</span><span className="pill">{finished?"마감":"진행 중"}</span><span>마감 {new Date(s.closes_at).toLocaleString("ko-KR")}</span></div>
   <h2>{s.title}</h2><p className="survey-question">{s.question}</p>
   {s.results?<><p className="muted"><BarChart3 size={16}/> 총 {total}명 응답 · 익명 결과</p>{s.options.map((o,i)=><div className="survey-result-row" key={i}><div><span>{o}</span><strong>{s.results?.[i]||0}표 ({total?Math.round((s.results?.[i]||0)/total*100):0}%)</strong></div><div className="survey-bar"><span style={{width:`${total?(s.results?.[i]||0)/total*100:0}%`}}/></div></div>)}</>:<div className="survey-options">{s.options.map((o,i)=><label key={i} className={answers[s.id]===i?"selected":""}><input type="radio" name={s.id} disabled={finished||s.participated||busy} checked={answers[s.id]===i} onChange={()=>setAnswers(p=>({...p,[s.id]:i}))}/>{o}</label>)}</div>}
   {!finished&&!s.participated&&<button className="primary" disabled={busy||answers[s.id]===undefined} onClick={()=>vote(s.id)}>익명으로 응답하기</button>}
   {s.participated&&<p className="survey-voted"><LockKeyhole size={16}/> 이미 응답한 설문입니다.</p>}
   {manager&&!finished&&<button className="outline" disabled={busy} onClick={()=>close(s.id)}>설문 마감</button>}
  </article>;})}
  {!items.length&&<section className="widget empty"><ClipboardList size={36}/><p>참여 가능한 설문이 없어요.</p></section>}</div>
  <p className="disclaimer">개발용 설문 기능입니다. 응답 시간 등 부가정보를 이용한 신원 추정 가능성을 줄이기 위한 운영 정책이 필요합니다.</p>
 </div>;
 return manager?<AdminShell profile={me}>{body}</AdminShell>:<main className="admin-page survey-layout"><MobileNav role={me.role}/>{body}</main>;
}
