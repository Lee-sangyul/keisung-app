"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {Bell,BellOff,Send,ArrowLeft} from "lucide-react";
import {supabase,type Profile} from "@/lib/supabase";
import {MobileNav} from "@/components/MobileNav";
import {AdminShell} from "@/components/AdminShell";
type Status={configured:boolean;publicKey:string|null;subscribed:boolean};
function vapidArray(key:string):ArrayBuffer{
 const padding="=".repeat((4-key.length%4)%4),b64=(key+padding).replace(/-/g,"+").replace(/_/g,"/");
 const decoded=atob(b64),array=new Uint8Array(decoded.length);
 for(let i=0;i<decoded.length;i++)array[i]=decoded.charCodeAt(i);
 return array.buffer as ArrayBuffer;
}
export default function Notifications(){
 const router=useRouter();const [me,setMe]=useState<Profile|null>(null),[state,setState]=useState<Status|null>(null);
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[title,setTitle]=useState(""),[body,setBody]=useState("");
 const [audience,setAudience]=useState("all"),[grade,setGrade]=useState(""),[classNumber,setClassNumber]=useState("");
 const manager=!!me&&["admin","superadmin"].includes(me.role);
 async function token(){return (await supabase.auth.getSession()).data.session?.access_token||"";}
 async function reload(){const res=await fetch("/api/push/subscription",{headers:{Authorization:`Bearer ${await token()}`},cache:"no-store"});const d=await res.json();if(!res.ok)throw Error(d.error||"상태 조회 실패");setState(d);}
 useEffect(()=>{let live=true;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/");return;}const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();if(!live)return;if(!p||p.disabled||p.must_change_password){router.replace("/dashboard");return;}setMe(p as Profile);try{await reload();}catch(e){if(live)setMessage(e instanceof Error?e.message:"오류");}})();return()=>{live=false;};},[router]);
 async function subscribe(){if(busy)return;setBusy(true);setMessage("");try{
 if(!state?.configured||!state.publicKey)throw Error("서버에서 푸시 알림을 아직 활성화하지 않았습니다.");
 if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))throw Error("이 브라우저에서는 웹 푸시를 지원하지 않습니다.");
 if(!window.isSecureContext)throw Error("HTTPS 환경에서만 푸시를 사용할 수 있습니다.");
 const permission=await Notification.requestPermission();
 if(permission!=="granted")throw Error("알림 권한이 허용되지 않았습니다. 기기 설정을 확인해 주세요.");
 const registration=await navigator.serviceWorker.register("/push-sw.js",{scope:"/"});
 const existing=await registration.pushManager.getSubscription();
 const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidArray(state.publicKey)});
 const r=await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},body:JSON.stringify(subscription.toJSON())});
 const d=await r.json();if(!r.ok)throw Error(d.error||"서버 저장 실패");
 await reload();setMessage("이 기기에서 알림을 신청했어요.");
 }catch(e){setMessage(e instanceof Error?e.message:"신청 실패");}finally{setBusy(false);}}
 async function unsubscribe(){setBusy(true);setMessage("");try{
 const reg=await navigator.serviceWorker.getRegistration("/push-sw.js");
 const subscription=await reg?.pushManager.getSubscription();
 if(subscription){
  const r=await fetch("/api/push/subscription",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},body:JSON.stringify({endpoint:subscription.endpoint})});
  if(!r.ok)throw Error("서버 구독 해제 실패");
  await subscription.unsubscribe();
 }
 await reload();setMessage("이 기기의 알림 구독을 해제했어요.");
 }catch(e){setMessage(e instanceof Error?e.message:"해제 오류");}finally{setBusy(false);}}
 async function send(e:React.FormEvent){e.preventDefault();if(!confirm("선택한 구독 기기에 푸시 알림을 발송할까요?"))return;setBusy(true);setMessage("");try{
 const res=await fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},
 body:JSON.stringify({title,message:body,audience,grade:grade?Number(grade):null,classNumber:classNumber?Number(classNumber):null,confirmation:"발송"})});
 const d=await res.json();if(!res.ok)throw Error(d.error||"발송 오류");setMessage(`발송 결과: 대상 ${d.recipients}기기, 성공 ${d.sent}건, 실패 ${d.failed}건`);
 }catch(e){setMessage(e instanceof Error?e.message:"발송 오류");}finally{setBusy(false);}}
 if(!me)return <main className="center">알림 설정 불러오는 중...</main>;
 const bodyNode=<div className="notification-page">
 <a href={manager?"/admin":"/dashboard"} className="back"><ArrowLeft size={17}/> {manager?"관리자 홈":"대시보드"}</a>
 <div className="section-heading"><div><p className="eyebrow" style={{color:"#2861b7"}}>PWA PUSH</p><h1>알림 센터</h1><p className="muted">공지·학교 소식 알림을 내 기기에 받을 수 있어요.</p></div></div>
 {message&&<p className="status-box" role="status">{message}</p>}
 <section className="widget notification-optin"><div className="widget-title"><Bell size={21}/><h2>내 기기 알림</h2></div>
 <p>알림은 신청한 기기에서만 표시돼요. 브라우저가 권한을 거부했다면 설정에서 허용해야 합니다.</p>
 <p className="muted">서버 상태: {state?.configured?"발송 설정 완료":"VAPID 발송 설정 필요"} · 구독: {state?.subscribed?"신청됨":"미신청"}</p>
 <button className="primary" disabled={busy||!state?.configured} onClick={subscribe}><Bell size={17}/>{busy?"처리 중...":"이 기기 알림 신청"}</button>
 <button className="outline" disabled={busy||!state?.subscribed} onClick={unsubscribe}><BellOff size={17}/> 알림 해제</button>
 </section>
 {manager&&<section className="widget notification-sender"><div className="widget-title"><Send size={20}/><h2>관리자 알림 발송</h2></div>
 <form className="admin-form" onSubmit={send}>
 <label>제목<input required maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>내용<textarea rows={3} required maxLength={180} value={body} onChange={e=>setBody(e.target.value)}/></label>
 <label>발송 대상<select value={audience} onChange={e=>{setAudience(e.target.value);setGrade("");setClassNumber("");}}><option value="all">전체 신청자</option><option value="student">학생</option><option value="teacher">교직원</option></select></label>
 {audience==="student"&&<div className="three-input"><label>학년<select value={grade} onChange={e=>setGrade(e.target.value)}><option value="">전체 학년</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}학년</option>)}</select></label><label>반<select value={classNumber} onChange={e=>setClassNumber(e.target.value)}><option value="">전체 반</option>{Array.from({length:30},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}반</option>)}</select></label></div>}
 <button className="primary" disabled={busy||!state?.configured}><Send size={17}/> 알림 발송</button>
 </form><p className="muted">관리자별 최소 2분 간격 발송. 기기 구독이 없는 계정에는 전달되지 않습니다.</p>
 </section>}
 <p className="disclaimer">푸시 알림은 사용자 선택에 따라 활성화되며, 기기·브라우저에 따라 지원 여부가 달라질 수 있어요.</p>
 </div>;
 return manager?<AdminShell profile={me}>{bodyNode}</AdminShell>:<main className="admin-page notification-layout"><MobileNav role={me.role}/>{bodyNode}</main>;
}
