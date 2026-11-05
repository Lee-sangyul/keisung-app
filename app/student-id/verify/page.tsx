"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,ScanLine,Camera,ShieldCheck} from "lucide-react";
import {supabase,type Profile} from "@/lib/supabase";
import {MobileNav} from "@/components/MobileNav";
type Verified={valid:boolean;student:{name:string;grade:number;classNumber:number;studentNumber:number};verifiedAt:string;notice:string};
type Barcode={rawValue:string};
type Detector={detect(source:HTMLVideoElement):Promise<Barcode[]>};
type DetectorCtor=new (options:{formats:string[]})=>Detector;
export default function Verify(){
 const router=useRouter();const [me,setMe]=useState<Profile|null>(null),[token,setToken]=useState(""),[result,setResult]=useState<Verified|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[camera,setCamera]=useState(false);
 const videoRef=useRef<HTMLVideoElement>(null),streamRef=useRef<MediaStream|null>(null),detectorRef=useRef<Detector|null>(null),scanningRef=useRef(false);
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/");return;}const {data:p}=await supabase.from("profiles").select("*").eq("id",user.id).single();if(!p||p.disabled||p.must_change_password||!["teacher","admin","superadmin"].includes(p.role)){router.replace("/dashboard");return;}setMe(p as Profile);})();},[router]);
 function stopCamera(){scanningRef.current=false;streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCamera(false);}
 useEffect(()=>()=>{scanningRef.current=false;streamRef.current?.getTracks().forEach(t=>t.stop());},[]);
 async function verify(qr:string){if(busy)return;setBusy(true);setResult(null);setError("");try{
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("로그인이 필요합니다.");
  const r=await fetch("/api/student-id/verify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({token:qr}),cache:"no-store"});
  const d=await r.json();if(!r.ok)throw Error(d.error||"검증에 실패했어요.");setResult(d);setToken("");
 }catch(e){setError(e instanceof Error?e.message:"오류");}finally{setBusy(false);}}
 async function startCamera(){setError("");try{
  const Ctor=(window as Window & {BarcodeDetector?:DetectorCtor}).BarcodeDetector;
  if(!Ctor)throw Error("이 브라우저는 QR 카메라 인식을 지원하지 않아요. Chrome 최신 버전 또는 별도 QR 스캐너에서 내용을 복사해 입력하세요.");
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});streamRef.current=stream;setCamera(true);
  const video=videoRef.current;if(!video){stream.getTracks().forEach(t=>t.stop());return;}
  video.srcObject=stream;await video.play();detectorRef.current=new Ctor({formats:["qr_code"]});scanningRef.current=true;
  while(scanningRef.current){const values=await detectorRef.current.detect(video);if(values.length){const value=values[0].rawValue;stopCamera();await verify(value);break;}await new Promise(r=>setTimeout(r,300));}
 }catch(e){stopCamera();setError(e instanceof Error?e.message:"카메라 사용 불가");}}
 if(!me)return <main className="center">교사 권한 확인 중...</main>;
 return <main className="admin-page verify-page"><MobileNav role={me.role}/><a className="back" href="/student-id"><ArrowLeft size={17}/> 학생증</a><div className="section-heading"><div><span className="eyebrow">QR VERIFICATION</span><h1>학생증 QR 검증</h1><p className="muted">교사·관리자 계정 전용 · 1회용 QR 확인</p></div></div>
 <section className="widget verify-card"><div className="widget-title"><ScanLine size={21}/><h2>QR 검증</h2></div><p>학생 휴대폰의 QR을 카메라로 읽거나, QR 문자열을 아래에 붙여넣으세요.</p><video className={camera?"scan-video":"scan-video-hidden"} ref={videoRef} muted playsInline/>
 <div className="action-row"><button className="outline" onClick={camera?stopCamera:startCamera}><Camera size={16}/>{camera?"카메라 종료":"카메라로 스캔"}</button></div>
 <form onSubmit={e=>{e.preventDefault();void verify(token.trim());}} className="admin-form"><label>QR 데이터</label><input value={token} onChange={e=>setToken(e.target.value)} placeholder="KSID1:..." required autoComplete="off"/><button className="primary" disabled={busy}>{busy?"검증 중...":"서버에서 검증"}</button></form>
 {error&&<p className="error" role="alert">{error}</p>}
 {result&&<div className="verify-success" role="status"><ShieldCheck size={29}/><h2>서버 검증 성공</h2><p>{result.student.name}</p><strong>{result.student.grade}학년 {result.student.classNumber}반 {result.student.studentNumber}번</strong><small>{new Date(result.verifiedAt).toLocaleString("ko-KR")} 검증 완료 · 해당 QR은 재사용 불가</small><em>{result.notice}</em></div>}
 </section></main>;
}
