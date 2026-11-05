/** Shared, side-effect-free validation for development-only student bulk provisioning. */
export type StudentImportRow = {
  username: string;
  displayName: string;
  grade: number;
  classNumber: number;
  studentNumber: number;
};
export type StudentImportFailure = { index: number; username: string; error: string };
export const MAX_STUDENT_IMPORT_ROWS = 1000;
export const MAX_STUDENT_IMPORT_BATCH = 20;
const expectedKeys = ["username", "displayName", "grade", "classNumber", "studentNumber"] as const;

const headers: Record<string, typeof expectedKeys[number]> = {
  username: "username", id: "username", "아이디": "username", "로그인아이디": "username",
  display_name: "displayName", displayname: "displayName", name: "displayName", "이름": "displayName", "학생이름": "displayName",
  grade: "grade", "학년": "grade",
  class_number: "classNumber", classnumber: "classNumber", class: "classNumber", "반": "classNumber",
  student_number: "studentNumber", studentnumber: "studentNumber", number: "studentNumber", "번호": "studentNumber"
};

/** RFC-4180-style quoted fields, escaped double quotes, BOM and CRLF. */
function csvRecords(input: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { value += '"'; i++; }
      else if (quoted) quoted = false;
      else if (value === "") quoted = true;
      else throw Error("CSV 따옴표 형식이 잘못됐습니다.");
    } else if (char === "," && !quoted) {
      row.push(value); value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(cell => cell.trim() !== "")) records.push(row);
      if (records.length > MAX_STUDENT_IMPORT_ROWS + 1) throw Error("한 파일은 최대 1,000명까지만 지원합니다.");
      row = []; value = "";
    } else {
      value += char;
    }
  }
  if (quoted) throw Error("CSV 따옴표가 닫히지 않았습니다.");
  row.push(value);
  if (row.some(cell => cell.trim() !== "")) records.push(row);
  return records;
}

export function validateStudentRows(rows: StudentImportRow[]): StudentImportFailure[] {
  const failures: StudentImportFailure[] = [], usernames = new Set<string>(), slots = new Set<string>();
  rows.forEach((r, index) => {
    const username = typeof r?.username === "string" ? r.username : "";
    const displayName = typeof r?.displayName === "string" ? r.displayName : "";
    const problems: string[] = [];
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) problems.push("ID는 영문 소문자·숫자·._-로 3~32자여야 합니다");
    if (!displayName.trim() || displayName.length > 60 || /[\r\n]/.test(displayName)) problems.push("이름은 1~60자로 입력해 주세요");
    if (!Number.isInteger(r?.grade) || r.grade < 1 || r.grade > 6) problems.push("학년은 1~6");
    if (!Number.isInteger(r?.classNumber) || r.classNumber < 1 || r.classNumber > 30) problems.push("반은 1~30");
    if (!Number.isInteger(r?.studentNumber) || r.studentNumber < 1 || r.studentNumber > 50) problems.push("번호는 1~50");
    const slot = `${r?.grade}/${r?.classNumber}/${r?.studentNumber}`;
    if (usernames.has(username)) problems.push("파일 안에서 ID가 중복됨");
    if (slots.has(slot)) problems.push("파일 안에서 학년·반·번호가 중복됨");
    usernames.add(username); slots.add(slot);
    if (problems.length) failures.push({ index, username, error: problems.join(" · ") });
  });
  return failures;
}

export function parseStudentCsv(input: string): { rows: StudentImportRow[]; errors: string[] } {
  const records = csvRecords(input.replace(/^\uFEFF/, ""));
  if (!records.length) throw Error("비어 있는 파일이에요.");
  const columns = records[0].map(h => headers[h.trim().toLowerCase()]);
  if (expectedKeys.some(key => !columns.includes(key)) || new Set(columns).size !== columns.length) {
    throw Error("CSV 헤더는 아이디,이름,학년,반,번호 또는 username,display_name,grade,class_number,student_number 여야 합니다.");
  }
  const data = records.slice(1);
  if (!data.length) throw Error("등록할 학생 데이터가 없습니다.");
  if (data.length > MAX_STUDENT_IMPORT_ROWS) throw Error("한 파일은 최대 1,000명까지만 지원합니다.");
  const errors: string[] = [];
  const rows = data.map((cells, index) => {
    if (cells.length !== columns.length) errors.push(`${index + 2}행: 열 개수가 맞지 않습니다.`);
    const map = Object.fromEntries(columns.map((key, column) => [key, (cells[column] ?? "").trim()]));
    return {
      username: (map.username || "").toLowerCase(),
      displayName: map.displayName || "",
      grade: Number(map.grade),
      classNumber: Number(map.classNumber),
      studentNumber: Number(map.studentNumber),
    };
  });
  errors.push(...validateStudentRows(rows).map(f => `${f.index + 2}행: ${f.error}`));
  return { rows, errors };
}

export function csvCell(value: string | number): string {
  const raw = String(value);
  // Protect Excel/Sheets from spreadsheet-formula injection in downloaded credentials.
  const safe = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
