"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,UserPlus,Shield,Users,KeyRound,UserX,UserCheck,History,RefreshCw} from "lucide-react";
import {supabase,type Profile,type Role} from "@/lib/supabase";
import {MobileNav} from "@/components/MobileNav";
type Audit={id:number;actor_id:string;target_id:string;action:string;created_at:string};
export default function Admin(){
 const router=useRouter();
 const [me,setMe]=useState<Profile|null>(null),[users,setUsers]=useState<Profile[]>([]),[logs,setLogs]=useState<Audit[]>([]);
 const [status,setStatus]=useState(""),[busy,setBusy]=useState(false),[actionId,setActionId]=useState<string|null>(null);
 const [username,setUsername]=useState(""),[displayName,setDisplayName]=useState(""),[role,setRole]=useState<Role>("student");
 const [grade,setGrade]=useState(""),[classNumber,setClassNumber]=useState(""),[studentNumber,setStudentNumber]=useState("");
 async function token(){return (await supabase.auth.getSession()).data.session?.access_token;}
 async function refresh(){
  const t=await token();if(!t)return;
  const headers={Authorization:`Bearer ${t}`};
  const [a,b]=await Promise.all([fetch("/api/admin/accounts",{headers,cache:"no-store"}),fetch("/api/admin/audit",{headers,cache:"no-store"})]);
  if(a.ok)setUsers((await a.json()).accounts);
  if(b.ok)setLogs((await b.json()).logs);
 }
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/");return;}
  const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();
  if(!p||!["admin","superadmin"].includes(p.role)||p.disabled||p.must_change_password){router.replace("/dashboard");return;}
  setMe(p);await refresh();
 })();},[router]);
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setStatus("");
  try{
   const t=await token();
   const r=await fetch("/api/admin/accounts",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({username,displayName,role,grade:grade?Number(grade):null,classNumber:classNumber?Number(classNumber):null,studentNumber:studentNumber?Number(studentNumber):null})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"발급 실패");
   setStatus(`발급 성공 · ID: ${data.username} · 임시 비밀번호: ${data.temporaryPassword} · 이 화면을 벗어나면 다시 확인할 수 없어요.`);
   setUsername("");setDisplayName("");await refresh();
  }catch(err){setStatus(err instanceof Error?err.message:"오류");}finally{setBusy(false);}
 }
 async function change(target:Profile,action:"disable"|"enable"|"reset_password"){
  const desc=action==="disable"?"비활성화":action==="enable"?"재활성화":"비밀번호 초기화";
  if(!window.confirm(`${target.display_name} (@${target.username}) 계정을 ${desc}할까요?`))return;
  setActionId(target.id);setStatus("");
  try{
   const t=await token();
   const r=await fetch(`/api/admin/accounts/${target.id}`,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"요청 실패");
   setStatus(action==="reset_password"?`@${target.username} 새 임시 비밀번호: ${data.temporaryPassword} · 안전한 채널로 전달하고 이 화면에서만 확인하세요.`:`@${target.username} 계정 ${desc} 완료`);
   await refresh();
  }catch(err){setStatus(err instanceof Error?err.message:"오류");}finally{setActionId(null);}
 }
 if(!me)return <main className="center">권한 확인 중...</main>;
 const canManage=(p:Profile)=>p.id!==me.id&&p.role!=="superadmin"&&(p.role!=="admin"||me.role==="superadmin");
 return <main className="admin-page"><MobileNav role={me.role}/>
  <a className="back" href="/dashboard"><ArrowLeft size={17}/> 대시보드</a>
  <header className="admin-header"><Shield size={29}/><div><h1>계정 관리</h1><p>계정 발급·상태 변경·비밀번호 초기화 내역을 기록합니다.</p></div></header>
  <div className="admin-grid">
   <section className="widget">
    <div className="widget-title"><UserPlus size={21}/><h2>새 계정 발급</h2></div>
    <form onSubmit={create} className="admin-form">
     <label>로그인 ID</label><input required pattern="[a-z0-9._-]{3,32}" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} placeholder="예: student001"/>
     <label>표시 이름</label><input required maxLength={60} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="표시할 이름"/>
     <label>권한</label><select value={role} onChange={e=>setRole(e.target.value as Role)}><option value="student">학생</option><option value="teacher">교사</option>{me.role==="superadmin"&&<option value="admin">관리자</option>}</select>
     {role==="student"&&<div className="three-input"><div><label>학년</label><input type="number" min="1" max="6" value={grade} onChange={e=>setGrade(e.target.value)}/></div><div><label>반</label><input type="number" min="1" max="30" value={classNumber} onChange={e=>setClassNumber(e.target.value)}/></div><div><label>번호</label><input type="number" min="1" max="50" value={studentNumber} onChange={e=>setStudentNumber(e.target.value)}/></div></div>}
     <button className="primary" disabled={busy}>{busy?"발급 중...":"임시 비밀번호로 발급"}</button>
    </form>
   </section>
   <section className="widget">
    <div className="widget-title"><Users size={21}/><h2>발급된 계정 ({users.length})</h2><button className="text-btn" onClick={refresh} aria-label="새로고침"><RefreshCw size={17}/></button></div>
    <div className="account-list">{users.map(p=><div className="account-item" key={p.id}>
     <div><b>{p.display_name}</b><small>@{p.username} · {p.role} · {p.disabled?"비활성":"활성"}</small></div>
     {canManage(p)&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      <button className="outline" disabled={actionId!==null} onClick={()=>change(p,"reset_password")} aria-label={p.username+" 비밀번호 초기화"}><KeyRound size={15}/></button>
      <button className="outline" disabled={actionId!==null} onClick={()=>change(p,p.disabled?"enable":"disable")} aria-label={p.username+(p.disabled?" 활성화":" 비활성화")}>{p.disabled?<UserCheck size={15}/>:<UserX size={15}/>}</button>
     </div>}
    </div>)}</div>
   </section>
  </div>
  {status&&<div className="status-box" role="status" style={{marginTop:18}}>{status}</div>}
  <section className="widget" style={{marginTop:20}}>
   <div className="widget-title"><History size={21}/><h2>관리자 작업 기록</h2></div>
   {logs.length?logs.map(l=><div className="list-row" key={l.id}><b style={{width:150}}>{new Date(l.created_at).toLocaleString("ko-KR")}</b><span>{l.action} · 대상: {users.find(u=>u.id===l.target_id)?.username||l.target_id.slice(0,8)} · 처리자: {users.find(u=>u.id===l.actor_id)?.username||l.actor_id.slice(0,8)}</span></div>):<p className="hint">표시할 감사 기록이 없어요. SQL 업데이트를 먼저 실행했는지 확인해 주세요.</p>}
  </section>
 </main>;
}
