"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileUp, Download, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase, type Profile } from "@/lib/supabase";
import { AdminShell } from "@/components/AdminShell";
import {
  parseStudentCsv, csvCell, MAX_STUDENT_IMPORT_BATCH,
  type StudentImportRow, type StudentImportFailure,
} from "@/lib/bulk-students";

type Created = StudentImportRow & { temporaryPassword: string };
type Result = { created: Created[]; failed: StudentImportFailure[]; processed: number };

function saveCsv(name: string, rows: (string | number)[][]) {
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  // Delay revocation to allow the browser to start saving.
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function BulkStudentPage() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [created, setCreated] = useState<Created[]>([]);
  const [failures, setFailures] = useState<StudentImportFailure[]>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("");
  const stopRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (!active) return;
      if (!profile || profile.disabled || profile.must_change_password ||
        !["admin", "superadmin"].includes(profile.role)) {
        router.replace("/dashboard"); return;
      }
      setMe(profile as Profile);
    })();
    return () => { active = false; stopRef.current = true; };
  }, [router]);

  async function chooseFile(file?: File) {
    if (!file || running) return;
    setFilename(file.name);
    setRows([]); setErrors([]); setCreated([]); setFailures([]);
    setProgress(0); setCompleted(false); setMessage("");
    if (!/\.csv$/i.test(file.name)) { setErrors([".csv 파일을 선택해 주세요."]); return; }
    if (file.size > 300 * 1024) { setErrors(["파일은 300KB 이하로 제한됩니다."]); return; }
    try {
      const result = parseStudentCsv(await file.text());
      setRows(result.rows); setErrors(result.errors);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "CSV 파일을 읽지 못했습니다."]);
    }
  }

  async function runImport() {
    if (running || !rows.length || errors.length) return;
    if (!window.confirm(`학생 ${rows.length}명을 등록할까요? 이미 존재하는 계정은 덮어쓰지 않으며, 성공한 계정은 바로 생성됩니다.`)) return;
    stopRef.current = false;
    setRunning(true); setCompleted(false); setCreated([]); setFailures([]); setProgress(0); setMessage("");
    const successes: Created[] = [], rejects: StudentImportFailure[] = [];
    let processed = 0;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw Error("로그인이 만료됐습니다. 다시 로그인해 주세요.");
      for (let offset = 0; offset < rows.length; offset += MAX_STUDENT_IMPORT_BATCH) {
        if (stopRef.current) { setMessage("사용자가 중단했습니다. 이미 등록된 계정은 유지됩니다."); break; }
        const chunk = rows.slice(offset, offset + MAX_STUDENT_IMPORT_BATCH);
        const response = await fetch("/api/admin/accounts/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ rows: chunk }), cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw Error(payload.error || `${offset + 1}번째 학생부터 서버 처리가 중단됐습니다. 이미 생성된 계정이 있을 수 있으니 재시도 전 계정 검색으로 확인하세요.`);
        }
        const result = payload as Result;
        successes.push(...(result.created || []));
        rejects.push(...(result.failed || []).map(item => ({ ...item, index: item.index + offset })));
        processed += chunk.length;
        setCreated([...successes]); setFailures([...rejects]); setProgress(processed);
      }
      if (!stopRef.current) {
        setCompleted(true);
        setMessage(`등록 요청 완료: 성공 ${successes.length}명, 실패 ${rejects.length}명.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "서버 통신 오류. 재시도 전에 이미 생성된 계정을 확인해 주세요.");
    } finally { setRunning(false); }
  }

  function downloadCredentials() {
    if (!created.length || running) return;
    saveCsv("keisung-student-new-accounts.csv", [
      ["아이디", "이름", "학년", "반", "번호", "임시 비밀번호"],
      ...created.map(r => [r.username, r.displayName, r.grade, r.classNumber, r.studentNumber, r.temporaryPassword]),
    ]);
    // Clear sensitive passwords from memory after delivering the file.
    setCreated([]);
    setMessage("임시 비밀번호 파일을 내려받았습니다. 안전한 위치에 보관하고 학생별로 개별 전달하세요. 브라우저에는 비밀번호를 남기지 않았습니다.");
  }

  function downloadFailures() {
    if (!failures.length || running) return;
    saveCsv("keisung-student-import-errors.csv", [
      ["원본 CSV 행", "아이디", "사유"],
      ...failures.map(f => [f.index + 2, f.username, f.error]),
    ]);
  }

  if (!me) return <main className="center">관리자 접근 권한 확인 중...</main>;
  return <AdminShell profile={me}>
    <div className="bulk-page">
      <a href="/admin/accounts" className="back"><ArrowLeft size={17}/> 계정 관리</a>
      <header className="admin-portal-heading bulk-heading">
        <div><p className="admin-portal-eyebrow">BULK STUDENT PROVISIONING</p>
          <h1>학생 일괄 등록</h1>
          <p>CSV 파일로 학생 계정을 순서대로 생성합니다. 승인된 테스트 정보만 사용해 주세요.</p>
        </div>
        <button className="outline bulk-template-btn" onClick={() => saveCsv("keisung-student-template.csv", [["아이디", "이름", "학년", "반", "번호"]])}>
          <Download size={17}/> CSV 양식 다운로드
        </button>
      </header>

      <div className="bulk-grid">
        <section className="widget bulk-upload-widget">
          <div className="widget-title"><FileUp size={22}/><h2>1. 학생 명단 선택</h2></div>
          <p className="muted">CSV 열 순서: <b>아이디, 이름, 학년, 반, 번호</b>. UTF-8, 최대 1,000명/파일. 아이디는 중복될 수 없어요.</p>
          <label className="bulk-file-area">
            <UploadCloud size={33}/>
            <strong>{filename || "CSV 파일 선택"}</strong>
            <span>파일은 선택만으로 서버에 전송되지 않습니다.</span>
            <input type="file" accept=".csv,text/csv" disabled={running} onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ""; }}/>
          </label>
          {rows.length > 0 && <p className="bulk-selection-summary">명단 <strong>{rows.length}명</strong> · 사전 검사 {errors.length ? "오류 발견" : "통과"}</p>}
          {errors.length > 0 && <div className="bulk-validation-errors" role="alert">
            <strong><AlertTriangle size={17}/> 입력 오류 {errors.length}건 — 수정 후 다시 업로드해 주세요.</strong>
            {errors.slice(0,20).map((e,i) => <p key={i}>{e}</p>)}
            {errors.length > 20 && <small>외 {errors.length - 20}건의 오류가 더 있습니다.</small>}
          </div>}
          <div className="bulk-caution"><AlertTriangle size={19}/>
            <p>실제 학생 개인정보는 학교 승인 및 보안·보존 정책 마련 전 업로드하지 마세요. 생성된 계정은 즉시 로그인할 수 있으며 최초 로그인 때 비밀번호 변경이 필요합니다.</p>
          </div>
        </section>

        <section className="widget bulk-progress-widget">
          <div className="widget-title"><CheckCircle2 size={22}/><h2>2. 계정 등록</h2></div>
          <p className="muted">20명씩 순차 처리해요. 실패한 계정은 건너뛰고 계속 진행하며, 정상 계정은 덮어쓰지 않아요.</p>
          {rows.length > 0 && <div className="bulk-progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={rows.length}>
            <span style={{width: `${Math.min(100,progress / rows.length * 100)}%`}}/>
          </div>}
          <p className="bulk-progress-count">{progress} / {rows.length}명 처리</p>
          <button className="primary" disabled={running || !rows.length || errors.length > 0 || (progress > 0 && !completed)} onClick={runImport}>
            <FileUp size={18}/>{running ? "등록 진행 중..." : completed ? "명단 다시 등록" : "학생 일괄 등록 시작"}
          </button>
          {running && <button type="button" className="outline bulk-stop-btn" onClick={() => { stopRef.current = true; }}>현재 묶음 처리 후 중단</button>}
          {message && <p role="status" className="status-box">{message}</p>}
          <div className="bulk-result-buttons">
            <button className="outline" disabled={running || !created.length} onClick={downloadCredentials}><Download size={17}/> 임시 비밀번호 CSV 다운로드 ({created.length})</button>
            <button className="outline" disabled={running || !failures.length} onClick={downloadFailures}><AlertTriangle size={17}/> 실패 목록 CSV ({failures.length})</button>
          </div>
          <small className="bulk-note">임시 비밀번호는 이 화면에서만 일시적으로 보관됩니다. 다른 페이지로 이동하면 다시 조회할 수 없으니 등록 후 반드시 다운로드하세요.</small>
        </section>
      </div>

      {rows.length > 0 && <section className="widget bulk-preview-widget">
        <div className="widget-title"><FileUp size={21}/><h2>3. 명단 미리보기</h2></div>
        <p className="muted">처음 20명만 표시합니다. 실제 등록에는 파일 전체 명단이 사용됩니다.</p>
        <div className="bulk-table-wrap"><table className="bulk-table">
          <thead><tr><th>행</th><th>ID</th><th>이름</th><th>학년</th><th>반</th><th>번호</th></tr></thead>
          <tbody>{rows.slice(0,20).map((r,i) => <tr key={i}>
            <td>{i+2}</td><td>{r.username}</td><td>{r.displayName}</td><td>{r.grade}</td><td>{r.classNumber}</td><td>{r.studentNumber}</td>
          </tr>)}</tbody>
        </table></div>
      </section>}
      {failures.length > 0 && <section className="widget bulk-failures">
        <h2>등록하지 못한 계정 ({failures.length})</h2>
        {failures.slice(0,20).map((f,i) => <p key={i}><strong>{f.index+2}행 · {f.username}</strong> — {f.error}</p>)}
        {failures.length > 20 && <p className="muted">전체 실패 목록은 CSV로 다운로드하세요.</p>}
      </section>}
    </div>
  </AdminShell>;
}
