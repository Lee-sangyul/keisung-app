import {randomUUID} from "node:crypto";
import {authenticate,jsonError} from "@/lib/server-auth";

export const runtime="nodejs";
const headers={"Cache-Control":"no-store, private"};
const BUCKET="keisung-lost-found";
const mimeToExtension:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
function allowedAdmin(role:string){return role==="admin"||role==="superadmin";}
function isValidImage(bytes:Uint8Array,type:string){
 if(type==="image/jpeg")return bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(type==="image/png")return bytes.length>8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
 if(type==="image/webp")return bytes.length>12&&
  String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
 return false;
}
export async function GET(request:Request){
 try{
  const ctx=await authenticate(request);
  if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(ctx.profile.must_change_password)return jsonError("비밀번호부터 변경해 주세요.",403);
  const admin=allowedAdmin(ctx.profile.role);
  let query=ctx.service.from("lost_found_items")
   .select("id,title,description,found_location,found_date,image_path,status,created_at,returned_at")
   .order("created_at",{ascending:false}).limit(100);
  if(!admin)query=query.eq("status","available");
  const {data,error}=await query;
  if(error)return jsonError("분실물 DB 설정이 필요합니다.",500);
  const items=await Promise.all((data||[]).map(async(item)=>{
    let imageUrl:string|null=null;
    if(item.image_path){
      const {data:link,error:signError}=await ctx.service.storage.from(BUCKET).createSignedUrl(item.image_path,900);
      if(!signError)imageUrl=link?.signedUrl||null;
    }
    return {id:item.id,title:item.title,description:item.description,foundLocation:item.found_location,
      foundDate:item.found_date,status:item.status,createdAt:item.created_at,returnedAt:item.returned_at,
      imageUrl};
  }));
  return Response.json({items,canManage:admin},{headers});
 }catch{return jsonError("분실물 조회 오류",500);}
}
export async function POST(request:Request){
 try{
  const ctx=await authenticate(request);
  if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(!allowedAdmin(ctx.profile.role)||ctx.profile.must_change_password)
   return jsonError("관리자만 분실물을 등록할 수 있습니다.",403);
  const form=await request.formData();
  const title=typeof form.get("title")==="string"?String(form.get("title")).trim():"";
  const description=typeof form.get("description")==="string"?String(form.get("description")).trim():"";
  const location=typeof form.get("location")==="string"?String(form.get("location")).trim():"";
  const date=typeof form.get("foundDate")==="string"?String(form.get("foundDate")).trim():"";
  if(title.length<1||title.length>100||description.length>1000||location.length<1||location.length>120||
     !/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||
     Date.parse(date)>Date.now()+24*3600_000)
   return jsonError("분실물 이름·장소·습득일·설명을 확인해 주세요.",400);
  const photo=form.get("photo");let path:string|null=null;
  if(photo instanceof File&&photo.size>0){
   const mime=photo.type;
   if(!mimeToExtension[mime]||photo.size>3*1024*1024)
    return jsonError("사진은 JPG·PNG·WEBP, 3MB 이하만 지원합니다.",400);
   const bytes=new Uint8Array(await photo.arrayBuffer());
   if(!isValidImage(bytes,mime))return jsonError("올바른 이미지 파일이 아닙니다.",400);
   path=`${randomUUID()}.${mimeToExtension[mime]}`;
   const {error:uploadError}=await ctx.service.storage.from(BUCKET).upload(path,bytes,{contentType:mime,upsert:false});
   if(uploadError)return jsonError("사진 업로드 실패: Storage 버킷 설정을 확인해 주세요.",500);
  }
  const {data,error}=await ctx.service.from("lost_found_items").insert({
    title,description,found_location:location,found_date:date,image_path:path,
    registered_by:ctx.user.id,status:"available"
  }).select("id").single();
  if(error){
    if(path)await ctx.service.storage.from(BUCKET).remove([path]);
    return jsonError("분실물 등록에 실패했습니다. DB 설정을 확인해 주세요.",500);
  }
  return Response.json({id:data.id},{status:201,headers});
 }catch{return jsonError("분실물 등록 오류",500);}
}
