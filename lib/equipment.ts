export const EQUIPMENT_TYPES = ["크롬북", "전자칠판", "충전기", "기타"] as const;
export const REPORT_STATUS = {
  received: "접수",
  in_progress: "처리 중",
  resolved: "해결",
} as const;

export type ReportStatus = keyof typeof REPORT_STATUS;

export const NEXT_STATUS: Partial<Record<ReportStatus, ReportStatus>> = {
  received: "in_progress",
  in_progress: "resolved",
};

export const EQUIPMENT_CODE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
export const REPORT_ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export type EquipmentAsset = {
  code: string;
  category: string;
  location: string;
};

export type EquipmentReport = {
  id: string;
  asset_code: string | null;
  category: string;
  location: string;
  description: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
};

export function equipmentReturnPath(search: string) {
  const code = new URLSearchParams(search).get("equipment");
  return code && EQUIPMENT_CODE.test(code) ? "/equipment?asset=" + code : null;
}
