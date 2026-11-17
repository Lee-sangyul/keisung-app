"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, QrCode, Wrench } from "lucide-react";
import QRCode from "qrcode";
import { AdminShell } from "@/components/AdminShell";
import { MobileNav } from "@/components/MobileNav";
import { supabase, type Profile } from "@/lib/supabase";
import { EQUIPMENT_TYPES, NEXT_STATUS, REPORT_STATUS, type EquipmentAsset, type EquipmentReport } from "@/lib/equipment";
import styles from "./equipment.module.css";

type ReportList = { reports: EquipmentReport[]; hasMore: boolean; admin: boolean; canHandle: boolean };

async function equipmentRequest<T>(query = "", method = "GET", body?: object): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("다시 로그인해 주세요.");
  const response = await fetch("/api/equipment" + query, {
    method,
    cache: "no-store",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "요청을 처리할 수 없습니다.");
  return data as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리할 수 없습니다.";
}

export default function EquipmentPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [asset, setAsset] = useState<EquipmentAsset | null>(null);
  const [reportMode, setReportMode] = useState(false);
  const [category, setCategory] = useState<string>(EQUIPMENT_TYPES[0]);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [assetType, setAssetType] = useState<string>(EQUIPMENT_TYPES[0]);
  const [assetLocation, setAssetLocation] = useState("");
  const [qr, setQr] = useState<{ code: string; image: string; url: string } | null>(null);
  const [list, setList] = useState<ReportList | null>(null);
  const [filter, setFilter] = useState("");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [assetLoading, setAssetLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");

  useEffect(() => {
    let active = true;
    async function initialize() {
      const code = new URLSearchParams(window.location.search).get("asset");
      const query = code ? "?" + new URLSearchParams({ equipment: code }) : "";
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/" + query);
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (!active) return;
      if (!data || data.disabled) {
        await supabase.auth.signOut();
        router.replace("/");
        return;
      }
      if (data.must_change_password) {
        router.replace("/dashboard" + query);
        return;
      }
      setReportMode(Boolean(code));
      setProfile(data as Profile);
      if (code) {
        const result = await equipmentRequest<{ asset: EquipmentAsset }>("?" + new URLSearchParams({ asset: code }));
        if (active) setAsset(result.asset);
      }
    }
    initialize().catch(error => { if (active) setError(errorMessage(error)); })
      .finally(() => { if (active) setAssetLoading(false); });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setListLoading(true);
    setListError("");
    const params = new URLSearchParams({ page: String(page), status: filter, mine: String(mine) });
    equipmentRequest<ReportList>("?" + params).then(result => {
      if (active) setList(result);
    }).catch(error => {
      if (active) setListError(errorMessage(error));
    }).finally(() => {
      if (active) setListLoading(false);
    });
    return () => { active = false; };
  }, [profile, filter, mine, page, revision]);

  async function runAction(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAction(async () => {
      await equipmentRequest("", "POST", { code: asset?.code, category, location, description });
      setDescription("");
      if (!asset) setLocation("");
      setMessage("고장 신고를 접수했어요.");
      setFilter("");
      setMine(true);
      setPage(1);
      setRevision(value => value + 1);
    });
  }

  function submitAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const lookup = button?.value === "lookup";
    void runAction(async () => {
      const code = assetCode.trim().toUpperCase();
      const result = lookup
        ? await equipmentRequest<{ asset: EquipmentAsset }>("?" + new URLSearchParams({ asset: code }))
        : await equipmentRequest<{ asset: EquipmentAsset }>("", "POST", { kind: "asset", code, category: assetType, location: assetLocation });
      const url = new URL("/equipment", window.location.origin);
      url.searchParams.set("asset", result.asset.code);
      const image = await QRCode.toDataURL(url.toString(), { width: 320, margin: 4 });
      setQr({ code: result.asset.code, image, url: url.toString() });
      setMessage(lookup ? "QR을 불러왔어요." : "기자재를 등록했어요.");
    });
  }

  function advance(report: EquipmentReport) {
    void runAction(async () => {
      try {
        await equipmentRequest("", "PATCH", { id: report.id, status: report.status });
        setMessage("처리 상태를 변경했어요.");
      } finally {
        setRevision(value => value + 1);
      }
    });
  }

  if (!profile) return <main className="center">{error || "계정 확인 중..."}</main>;
  const isAdmin = profile.role === "admin" || profile.role === "superadmin";
  const canHandle = list?.canHandle ?? false;
  const home = isAdmin ? "/admin" : "/dashboard";
  const content = <div className={styles.page}>
    <header>
      <a className="text-btn" href={home}><ArrowLeft size={18}/> 홈</a>
      <h1><Wrench size={25}/> 기자재 고장 신고</h1>
    </header>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {reportMode || !canHandle ? <section className={styles.panel} aria-labelledby="report-title">
      <h2 id="report-title">고장 신고하기</h2>
      {assetLoading ? <p>기자재 확인 중...</p> : <form onSubmit={submitReport}>
        {asset ? <p className={styles.asset}><strong>{asset.category}</strong> · {asset.location} · {asset.code}</p> : <>
          <label>기자재 종류<select value={category} onChange={event => setCategory(event.target.value)}>
            {EQUIPMENT_TYPES.map(type => <option key={type}>{type}</option>)}
          </select></label>
          <label>위치<input value={location} onChange={event => setLocation(event.target.value)} placeholder="예: 6학년 4반 교실" maxLength={80} required /></label>
        </>}
        <label>고장 증상<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="예: 충전기를 연결해도 전원이 켜지지 않아요" maxLength={500} rows={3} required /></label>
        <button className="primary" disabled={busy}>신고 접수</button>
      </form>}
    </section> : <button className="outline" onClick={() => setReportMode(true)}>고장 신고하기</button>}

    {isAdmin && <details className={styles.panel}>
      <summary><QrCode size={18}/> 기자재 등록 및 QR</summary>
      <form onSubmit={submitAsset}>
        <label>기자재 코드<input value={assetCode} onChange={event => setAssetCode(event.target.value)} placeholder="예: CB-604-01" minLength={3} maxLength={32} required /></label>
        <label>종류<select value={assetType} onChange={event => setAssetType(event.target.value)}>
          {EQUIPMENT_TYPES.map(type => <option key={type}>{type}</option>)}
        </select></label>
        <label>위치<input value={assetLocation} onChange={event => setAssetLocation(event.target.value)} maxLength={80} required /></label>
        <div className={styles.actions}>
          <button className="primary" disabled={busy}>등록하고 QR 만들기</button>
          <button className="outline" value="lookup" formNoValidate disabled={busy}>기존 코드 QR 불러오기</button>
        </div>
      </form>
      {qr && <figure className={styles.qr}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr.image} width={180} height={180} alt={`기자재 ${qr.code} 신고 QR`} />
        <figcaption><a href={qr.image} download={`${qr.code}.png`}>QR 다운로드</a> · <a href={qr.url}>신고 링크 열기</a></figcaption>
      </figure>}
    </details>}

    <section className={styles.panel} aria-labelledby="reports-title">
      <div className={styles.listHeader}>
        <h2 id="reports-title">{canHandle && !mine ? "전체 신고" : "내 신고"}</h2>
        <div className={styles.actions}>
          {canHandle && <label className={styles.checkbox}><input type="checkbox" checked={mine} onChange={event => { setMine(event.target.checked); setPage(1); }} /> 내 신고만</label>}
          <select aria-label="신고 상태 필터" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}>
            <option value="">모든 상태</option>
            {Object.entries(REPORT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="outline" disabled={listLoading} onClick={() => setRevision(value => value + 1)}>새로고침</button>
        </div>
      </div>
      {listError ? <p className="error" role="alert">{listError}</p> : listLoading ? <p role="status">신고를 불러오는 중...</p> :
        !list?.reports.length ? <p>표시할 신고가 없어요.</p> : <ul className={styles.reports}>
          {list.reports.map(report => {
            const next = NEXT_STATUS[report.status];
            return <li key={report.id}>
              <div className={styles.listHeader}>
                <strong>{report.category} · {report.location}</strong>
                <span className={styles.badge} data-status={report.status}>{REPORT_STATUS[report.status]}</span>
              </div>
              <p>{report.description}</p>
              <div className={styles.listHeader}>
                <small>{report.asset_code && `${report.asset_code} · `}{new Date(report.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</small>
                {canHandle && next && <button className="outline" disabled={busy} onClick={() => advance(report)}>{next === "resolved" ? "해결 완료" : "처리 시작"}</button>}
              </div>
            </li>;
          })}
        </ul>}
      {(page > 1 || list?.hasMore) && <div className={styles.actions}>
        <button className="outline" disabled={page === 1 || listLoading} onClick={() => setPage(value => value - 1)}>이전</button>
        <span>{page} 페이지</span>
        <button className="outline" disabled={!list?.hasMore || listLoading} onClick={() => setPage(value => value + 1)}>다음</button>
      </div>}
    </section>
  </div>;
  return isAdmin ? <AdminShell profile={profile}>{content}</AdminShell> :
    <main className={styles.shell}>{content}<MobileNav role={profile.role}/></main>;
}
