import { randomBytes } from "node:crypto";
import { authenticate, jsonError } from "@/lib/server-auth";
import {accountEmail,type Role} from "@/lib/supabase";
import {audit} from "@/lib/admin";
export const runtime="nodejs";
function allowed(role:string,requested:Role){return role==="superadmin"?["student","teacher","admin"].includes(requested):["student","teacher"].includes(requested);}
export async function GET(request:Request){try{const ctx=await authenticate(request);if(!ctx)return jsonError("인증이 필요합니다.",401);if(!["admin","superadmin"].includes(ctx.profile.role)||ctx.profile.must_change_password)return jsonError("권한이 없습니다.",403);
const url = new URL(request.url);
const q=(url.searchParams.get("q")||"").trim().slice(0,60).replace(/[^\\p{L}\\p{N}\\s._-]/gu,"");
const role=url.searchParams.get("role");
const grade=url.searchParams.get("grade"),cl=url.searchParams.get("classNumber");
let query=ctx.service.from("profiles").select("id,username,display_name,role,grade,class_number,student_number,must_change_password,disabled,created_at",{count:"exact"});
if(q)query=query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
if(role&&["student","teacher","admin","superadmin"].includes(role))query=query.eq("role",role);
if(grade&&/^[1-6]$/.test(grade))query=query.eq("grade",Number(grade));
if(cl&&/^([1-9]|[12][0-9]|30)$/.test(cl))query=query.eq("class_number",Number(cl));
const {data,error,count}=await query.order("created_at",{ascending:false}).limit(200);
if(error)return jsonError("계정 목록 조회 실패",500);return Response.json({accounts:data,total:count,limited:count!=null&&count>200},{headers:{"Cache-Control":"no-store"}});}catch{return jsonError("서버 오류",500);}}
export async function POST(request:Request){try{const ctx=await authenticate(request);if(!ctx)return jsonError("인증이 필요합니다.",401);if(!["admin","superadmin"].includes(ctx.profile.role)||ctx.profile.must_change_password)return jsonError("권한이 없습니다.",403);
const body=await request.json().catch(()=>null);if(!body)return jsonError("잘못된 요청",400);
const username=String(body.username||"").trim().toLowerCase(),displayName=String(body.displayName||"").trim(),role=body.role as Role;
if(!/^[a-z0-9._-]{3,32}$/.test(username)||displayName.length<1||displayName.length>60||!allowed(ctx.profile.role,role))return jsonError("입력값 또는 권한이 올바르지 않습니다.",400);
const nums=[body.grade,body.classNumber,body.studentNumber];if(nums.some(v=>v!=null&&(!Number.isInteger(v)||v<1)))return jsonError("학적 정보가 올바르지 않습니다.",400);
if(role==="student"&&((body.grade!=null&&body.grade>6)||(body.classNumber!=null&&body.classNumber>30)||(body.studentNumber!=null&&body.studentNumber>50)))return jsonError("학적 정보 범위 오류",400);
const temporaryPassword=randomBytes(24).toString("base64url");
const {data,error}=await ctx.service.auth.admin.createUser({email:accountEmail(username),password:temporaryPassword,email_confirm:true,user_metadata:{username,display_name:displayName}});
if(error||!data.user)return jsonError(error?.message||"계정 생성 실패",409);
const {error:profileError}=await ctx.service.from("profiles").insert({id:data.user.id,username,display_name:displayName,role,grade:role==="student"?(body.grade??null):null,class_number:role==="student"?(body.classNumber??null):null,student_number:role==="student"?(body.studentNumber??null):null,must_change_password:true,disabled:false});
if(profileError){await ctx.service.auth.admin.deleteUser(data.user.id);return jsonError("계정 정보 저장 실패",500);}
if(!await audit(ctx.service,ctx.user.id,data.user.id,"create_account"))return jsonError("계정은 생성됐지만 감사 기록에 실패했습니다. 관리자에게 확인해 주세요.",500);
return Response.json({username,temporaryPassword},{status:201,headers:{"Cache-Control":"no-store"}});}catch{return jsonError("서버 오류",500);}}
