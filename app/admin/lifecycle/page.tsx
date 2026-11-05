"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {GraduationCap,ArrowLeft,ShieldAlert,RotateCcw,Users} from "lucide-react";
import {supabase,type Profile} from "@/lib/supabase";
import {AdminShell} from "@/components/AdminShell";
type Student={id:string;username:string;display_name:string;grade:number|null;class_number:number|null;student_number:number|null};
type Batch={id:string;target_year:number;created_at:string;rolled_back_at:string|null};
type Preview={students:Student[];hash:string;total:number;promote:number;graduate:number;incomplete:number;batches:Batch[];hint:string};
export default function Lifecycle(){
 const router=useRouter();const [me,setMe]=useState<Profile|null>(null),[data,setData]=useState<Preview|null>(null);
 const [year,setYear]=useState(new Date().getFullYear()+1),[phrase,setPhrase]=useState(""),[agree,setAgree]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function token(){return (await supabase.auth.getSession()).data.session?.access_token||"";}
 async function reload(){const t=await token();const r=await fetch("/api/admin/lifecycle",{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"명단 로딩 실패");setData(d);}
 useEffect(()=>{let live=true;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/");return;}const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();if(!live)return;if(!p||p.disabled||p.must_change_password||!["admin","superadmin"].includes(p.role)){router.replace("/dashboard");return;}setMe(p as Profile);try{await reload();}catch(e){if(live)setMessage(e instanceof Error?e.message:"조회 실패");}})();return()=>{live=false;};},[router]);
 async function apply(){if(!data||busy||!agree||phrase!==`진급 ${year}`)return;if(!confirm(`학생 ${data.total}명에 대한 ${year}학년도 진급·졸업 처리를 실행할까요? 반·번호는 유지됩니다.`))return;setBusy(true);setMessage("");try{
 const r=await fetch("/api/admin/lifecycle",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},body:JSON.stringify({year,hash:data.hash,confirmation:phrase,keepClassAndNumber:agree})});
 const d=await r.json();if(!r.ok)throw Error(d.error||"실패");
 setMessage(`${d.processed}명 학년도 전환 완료. 변경 기록: ${d.batchId}`);setPhrase("");setAgree(false);await reload();
 }catch(e){setMessage(e instanceof Error?e.message:"오류");}finally{setBusy(false);}}
 async function rollback(id:string){if(!confirm("진급·졸업 처리를 이전 학적으로 되돌릴까요? 이후 해당 학생 계정에 변경이 있었다면 복원되지 않습니다."))return;setBusy(true);setMessage("");try{
 const r=await fetch("/api/admin/lifecycle",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},body:JSON.stringify({batchId:id,confirmation:"되돌리기"})});
 const d=await r.json();if(!r.ok)throw Error(d.error||"복원 실패");setMessage(`${d.restored}명 이전 상태로 복원했어요.`);await reload();
 }catch(e){setMessage(e instanceof Error?e.message:"오류");}finally{setBusy(false);}}
 if(!me)return <main className="center">관리 권한 확인 중...</main>;
 return <AdminShell profile={me}><div className="lifecycle-page">
 <a href="/admin" className="back"><ArrowLeft size={17}/> 관리자 홈</a>
 <div className="section-heading"><div><p className="eyebrow" style={{color:"#285fb0"}}>ACADEMIC YEAR</p><h1>진급·졸업 관리</h1><p className="muted">전체 학년 일괄 전환 · 적용 전 명단 확인 · 변경 이력 복원</p></div></div>
 {message&&<p className="status-box" role="status">{message}</p>}
 <div className="lifecycle-summary">
  <div className="stat"><Users size={22}/><span>처리 대상</span><strong>{data?.total??"—"}명</strong></div>
  <div className="stat"><GraduationCap size={22}/><span>1~5학년 진급</span><strong>{data?.promote??"—"}명</strong></div>
  <div className="stat"><GraduationCap size={22}/><span>6학년 졸업</span><strong>{data?.graduate??"—"}명</strong></div>
 </div>
 <section className="widget lifecycle-warning"><div className="widget-title"><ShieldAlert size={22}/><h2>실행 전 반드시 확인</h2></div>
  <p>이 기능은 1~5학년을 한 학년씩 올리고, 6학년은 졸업 상태로 전환해 계정을 비활성화합니다.</p>
  <p><strong>반과 번호는 그대로 유지합니다.</strong> 실제 학교의 학급 재편성 결과가 다르다면 이 기능으로 적용하지 마세요. 개발용 테스트 데이터에서만 이용하세요.</p>
  <p>학적이 비어 있는 계정 {data?.incomplete??"?"}명 · 현재 활성 학생만 처리합니다. 관리자 승인 및 학년별 대조 없이 실제 데이터 적용 금지.</p>
 </section>
 <section className="widget lifecycle-apply"><div className="widget-title"><GraduationCap size={21}/><h2>최종 확인 및 전환 실행</h2></div>
  <label>진급 목표 학년도<input type="number" min={new Date().getFullYear()} max={new Date().getFullYear()+2} value={year} onChange={e=>setYear(Number(e.target.value))}/></label>
  <label className="check-line"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/> 명단을 확인했고, 반·번호 유지 방식에 동의합니다.</label>
  <label>확인 문구: <strong>진급 {year}</strong><input value={phrase} placeholder={`진급 ${year}`} onChange={e=>setPhrase(e.target.value)}/></label>
  <button className="primary" disabled={busy||!data||!data.total||data.incomplete>0||!agree||phrase!==`진급 ${year}`} onClick={apply}>{busy?"처리 중...":"진급·졸업 처리 실행"}</button>
 </section>
 <section className="widget lifecycle-roster"><h2>대상자 미리보기 (최대 30명 표시)</h2>
  <div className="bulk-table-wrap"><table className="bulk-table"><thead><tr><th>ID</th><th>이름</th><th>현재 학적</th><th>예상 변경</th></tr></thead><tbody>{data?.students.slice(0,30).map(s=><tr key={s.id}><td>{s.username}</td><td>{s.display_name}</td><td>{s.grade}학년 {s.class_number}반 {s.student_number}번</td><td>{s.grade===6?"졸업 · 비활성화":s.grade?`${s.grade+1}학년 (반/번호 유지)`:"정보 없음"}</td></tr>)}</tbody></table></div>
 </section>
 <section className="widget lifecycle-history"><h2>최근 학년도 전환 이력</h2>{data?.batches.length?data.batches.map(b=><div className="account-item" key={b.id}><div><strong>{b.target_year}학년도</strong><small>{new Date(b.created_at).toLocaleString("ko-KR")} · {b.rolled_back_at?"복원 완료":"적용됨"}</small></div>{!b.rolled_back_at&&<button className="outline" disabled={busy} onClick={()=>rollback(b.id)}><RotateCcw size={16}/> 이전 상태로 복원</button>}</div>):<p className="muted">전환 기록이 없어요.</p>}</section>
 </div></AdminShell>;
}
