"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,CalendarDays,Edit3,Plus,Save,Trash2,X,ShieldCheck} from "lucide-react";
import {supabase,type Profile} from "@/lib/supabase";
import {MobileNav} from "@/components/MobileNav";
import {WEEKDAYS,PERIODS,TIMETABLE_COLORS,newTimetableForm,type TimetableEntry,type TimetableForm} from "@/lib/timetable";

export default function TimetablePage(){
 const router=useRouter();
 const [me,setMe]=useState<Profile|null>(null);
 const [loading,setLoading]=useState(true);
 const [entries,setEntries]=useState<TimetableEntry[]>([]);
 const [form,setForm]=useState<TimetableForm|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const today=new Date().getDay();

 const load=useCallback(async()=>{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw Error("로그인이 필요합니다.");
  const r=await fetch("/api/timetable",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
  const d=await r.json();if(!r.ok)throw Error(d.error||"시간표 조회 실패");
  setEntries(d.entries||[]);
 },[]);

 useEffect(()=>{
  let active=true;
  (async()=>{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){router.replace("/");return;}
   const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();
   if(!active)return;
   if(!p||p.disabled||p.must_change_password){router.replace("/dashboard");return;}
   if(p.role!=="student"){router.replace(["admin","superadmin"].includes(p.role)?"/admin":"/dashboard");return;}
   setMe(p as Profile);
   try{await load();}catch(e){if(active)setMessage(e instanceof Error?e.message:"오류");}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[router,load]);

 const countByDay=useMemo(()=>WEEKDAYS.map((_,day)=>entries.filter(e=>e.weekday===day+1).length),[entries]);

 function openEntry(entry:TimetableEntry){
  setMessage("");
  setForm({id:entry.id,weekday:entry.weekday,startPeriod:entry.start_period,endPeriod:entry.end_period,
   subject:entry.subject,room:entry.room,teacher:entry.teacher,color:entry.color});
 }

 async function save(e:React.FormEvent){
  e.preventDefault();if(!form||busy)return;
  setBusy(true);setMessage("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error("로그인이 필요합니다.");
   const r=await fetch("/api/timetable",{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(form)});
   const d=await r.json();if(!r.ok)throw Error(d.error||"저장 실패");
   setForm(null);await load();setMessage("시간표에 저장했어!");
  }catch(e){setMessage(e instanceof Error?e.message:"수업 저장 오류");}
  finally{setBusy(false);}
 }

 async function remove(){
  if(!form?.id||busy||!confirm("이 수업을 시간표에서 삭제할까요?"))return;
  setBusy(true);setMessage("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error("로그인이 필요합니다.");
   const r=await fetch("/api/timetable",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({id:form.id})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"삭제 실패");
   setForm(null);await load();setMessage("수업을 삭제했어.");
  }catch(e){setMessage(e instanceof Error?e.message:"삭제 오류");}
  finally{setBusy(false);}
 }

 if(loading||!me)return <main className="center">내 시간표 불러오는 중...</main>;

 return <main className="tt-page">
  <MobileNav role={me.role}/>
  <div className="tt-wrap">
   <a className="back" href="/dashboard"><ArrowLeft size={17}/> 대시보드</a>
   <div className="tt-heading">
    <div><span className="eyebrow">MY TIMETABLE</span><h1>나만의 시간표</h1>
     <p>에타처럼 직접 만드는 5일 시간표 · 한 교시 칸을 눌러 수업을 추가해 봐.</p>
    </div>
    <button className="tt-new" onClick={()=>setForm(newTimetableForm(today>=1&&today<=5?today:1,1))}><Plus size={18}/> 수업 추가</button>
   </div>
   {message&&<p className="status-box" role="status">{message}</p>}
   <section className="tt-board" aria-label="월요일부터 금요일까지 개인 시간표">
    <div className="tt-scroll">
     <div className="tt-grid">
      <div className="tt-corner" style={{gridColumn:1,gridRow:1}}>교시</div>
      {WEEKDAYS.map((day,index)=><div key={day} className={today===index+1?"tt-day tt-today":"tt-day"} style={{gridColumn:index+2,gridRow:1}}>
       <strong>{day}</strong><small>{countByDay[index]}과목</small>
      </div>)}
      {PERIODS.map(period=><div key={period} className="tt-period" style={{gridColumn:1,gridRow:period+1}}>{period}<small>교시</small></div>)}
      {WEEKDAYS.flatMap((_,dayIndex)=>PERIODS.map(period=>{
       const current=entries.find(item=>item.weekday===dayIndex+1&&item.start_period<=period&&item.end_period>=period);
       if(current&&current.start_period!==period)return null;
       const style={gridColumn:dayIndex+2,gridRow:`${period+1} / span ${current?current.end_period-current.start_period+1:1}`};
       if(current)return <button type="button" key={dayIndex+"-"+period} className="tt-subject"
        style={{...style,backgroundColor:current.color}}
        onClick={()=>openEntry(current)} aria-label={`${WEEKDAYS[dayIndex]}요일 ${period}교시 ${current.subject} 수정`}>
        <strong>{current.subject}</strong>
        {current.room&&<span>{current.room}</span>}
        {current.teacher&&<small>{current.teacher}</small>}
        {current.end_period>current.start_period&&<em>{current.start_period}~{current.end_period}교시</em>}
       </button>;
       return <button type="button" key={dayIndex+"-"+period} className="tt-empty-cell" style={style}
         onClick={()=>{setMessage("");setForm(newTimetableForm(dayIndex+1,period));}}
         aria-label={`${WEEKDAYS[dayIndex]}요일 ${period}교시 수업 추가`}><Plus size={17}/></button>;
      }))}
     </div>
    </div>
   </section>
   <div className="tt-footnotes">
    <span><Edit3 size={17}/> 색깔 칸을 누르면 수정할 수 있어.</span>
    <span><CalendarDays size={17}/> 휴대폰에서는 좌우로 스크롤해서 확인해.</span>
   </div>
   <p className="disclaimer"><ShieldCheck size={16}/> 이 시간표는 학생 본인이 작성하는 개인 기록이며 학교 공식 시간표와 연동되지 않아요.</p>
  </div>

  {form&&<div className="tt-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setForm(null);}}>
   <section className="tt-modal" role="dialog" aria-modal="true" aria-label={form.id?"수업 수정":"수업 추가"}>
    <div className="tt-modal-head"><h2>{form.id?"수업 수정":"수업 추가"}</h2><button type="button" aria-label="닫기" onClick={()=>setForm(null)}><X size={21}/></button></div>
    <form onSubmit={save} className="tt-form">
     <label htmlFor="tt-subject">과목 이름</label>
     <input id="tt-subject" required maxLength={50} value={form.subject}
      placeholder="예: 국어" autoFocus onChange={e=>setForm({...form,subject:e.target.value})}/>
     <div className="tt-form-grid">
      <label>요일<select value={form.weekday} onChange={e=>setForm({...form,weekday:Number(e.target.value)})}>
       {WEEKDAYS.map((d,i)=><option key={d} value={i+1}>{d}요일</option>)}</select></label>
      <label>시작 교시<select value={form.startPeriod} onChange={e=>setForm({...form,startPeriod:Number(e.target.value),endPeriod:Math.max(form.endPeriod,Number(e.target.value))})}>
       {PERIODS.map(p=><option key={p} value={p}>{p}교시</option>)}</select></label>
      <label>끝 교시<select value={form.endPeriod} onChange={e=>setForm({...form,endPeriod:Number(e.target.value)})}>
       {PERIODS.filter(p=>p>=form.startPeriod).map(p=><option key={p} value={p}>{p}교시</option>)}</select></label>
     </div>
     <label htmlFor="tt-room">교실·장소 (선택)</label>
     <input id="tt-room" maxLength={60} value={form.room} placeholder="예: 음악실" onChange={e=>setForm({...form,room:e.target.value})}/>
     <label htmlFor="tt-teacher">담당 교사 (선택)</label>
     <input id="tt-teacher" maxLength={60} value={form.teacher} placeholder="예: 담임 선생님" onChange={e=>setForm({...form,teacher:e.target.value})}/>
     <span className="tt-colors-label">시간표 색상</span>
     <div className="tt-colors">{TIMETABLE_COLORS.map(color=><button key={color} type="button" className={form.color===color?"tt-color selected":"tt-color"}
       onClick={()=>setForm({...form,color})} style={{background:color}} aria-label={color+" 색상 선택"} aria-pressed={form.color===color}/>)}</div>
     <button className="primary" disabled={busy}><Save size={17}/>{busy?"저장 중...":"시간표에 저장"}</button>
     {form.id&&<button className="tt-delete" type="button" disabled={busy} onClick={remove}><Trash2 size={17}/> 수업 삭제</button>}
    </form>
   </section>
  </div>}
 </main>;
}
