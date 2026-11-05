import {createHash} from "node:crypto";
import {adminContext,noStore} from "@/lib/admin";
import {jsonError} from "@/lib/server-auth";
export const runtime="nodejs";
export const maxDuration=60;
type Student={id:string;username:string;display_name:string;grade:number|null;class_number:number|null;student_number:number|null};
async function roster(service:ReturnType<typeof import("@/lib/server-auth").serviceClient>){
 const {data,error,count}=await service.from("profiles").select("id,username,display_name,grade,class_number,student_number",{count:"exact"})
 .eq("role","student").eq("disabled",false).is("graduated_at",null).order("id").limit(1001);
 if(error)throw Error("DB: "+error.code);
 if((count||0)>1000|| (data||[]).length>1000)throw Error("이 버전은 1,000명 이하만 처리할 수 있습니다.");
 return (data||[]) as Student[];
}
function hash(rows:Student[]){return createHash("sha256").update(JSON.stringify(rows)).digest("hex");}
export async function GET(request:Request){
 try{
 const {ctx,error}=await adminContext(request);if(error||!ctx)return error||jsonError("권한 없음",403);
 const students=await roster(ctx.service);
 const {data:batches}=await ctx.service.from("student_lifecycle_batches").select("id,target_year,created_at,rolled_back_at").order("created_at",{ascending:false}).limit(8);
 return Response.json({students,hash:hash(students),total:students.length,
  promote:students.filter(s=>s.grade!=null&&s.grade<6).length,graduate:students.filter(s=>s.grade===6).length,
  incomplete:students.filter(s=>!s.grade||!s.class_number||!s.student_number).length,
  batches:batches||[],hint:"진급 시 반·번호는 유지됩니다. 실제 학급 배정이 달라지면 적용하지 마세요."},{headers:noStore});
 }catch(e){return jsonError(e instanceof Error?e.message:"조회 오류",500);}
}
export async function POST(request:Request){
 try{
 const {ctx,error}=await adminContext(request);if(error||!ctx)return error||jsonError("권한 없음",403);
 const body=await request.json().catch(()=>null);
 const year=body?.year,signature=body?.hash;
 if(!Number.isInteger(year)||typeof signature!=="string"||body?.confirmation!==`진급 ${year}`||body?.keepClassAndNumber!==true)
 return jsonError("학년도·명단 확인 및 최종 동의가 필요합니다.",400);
 const students=await roster(ctx.service);
 if(!students.length||students.some(s=>s.grade==null||s.class_number==null||s.student_number==null))
 return jsonError("학적 정보가 누락된 학생이 있습니다. 먼저 계정을 정리해 주세요.",409);
 if(hash(students)!==signature)return jsonError("명단이 변경되었습니다. 다시 미리보기 해 주세요.",409);
 const {data,error:dbError}=await ctx.service.rpc("apply_student_lifecycle",{p_actor:ctx.user.id,p_year:year,
 p_students:students.map(s=>({id:s.id,grade:s.grade,classNumber:s.class_number,studentNumber:s.student_number}))});
 if(dbError)return jsonError("학년도 전환 실패: 명단 중복·해당 연도 처리 여부·DB 설정을 확인해 주세요.",409);
 return Response.json({batchId:data,processed:students.length},{headers:noStore});
 }catch(e){return jsonError(e instanceof Error?e.message:"처리 오류",500);}
}
export async function PATCH(request:Request){
 try{
 const {ctx,error}=await adminContext(request);if(error||!ctx)return error||jsonError("권한 없음",403);
 const body=await request.json().catch(()=>null);const id=body?.batchId;
 if(typeof id!=="string"||!/^[a-f\d-]{36}$/i.test(id)||body?.confirmation!=="되돌리기")
 return jsonError("되돌릴 배치와 확인 문구가 필요합니다.",400);
 const {data,error:dbError}=await ctx.service.rpc("rollback_student_lifecycle",{p_actor:ctx.user.id,p_batch:id});
 if(dbError)return jsonError("복원 실패: 후속 변경이 있거나 이미 취소된 작업일 수 있습니다.",409);
 return Response.json({restored:data},{headers:noStore});
 }catch{return jsonError("복원 중 오류가 발생했습니다.",500);}
}
