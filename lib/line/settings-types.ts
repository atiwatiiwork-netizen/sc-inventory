// Pure (client-safe) LINE settings types + defaults. No server-only imports,
// so both the settings form (client) and the server can use these.

export type DetailLevel = "minimal" | "summary" | "detailed";
export type LowstockMode = "digest" | "immediate" | "off";
export type DailyTrigger = "after" | "fixed";

export type LineSettings = {
  enabled: boolean; // master switch — LINE integration active (gates ALL sends)
  autoSend: boolean; // scheduled auto reports (daily/weekly/monthly + after-submit daily)
  workerSend: boolean; // allow worker-initiated per-category push from the worker app
  token: string;
  recipientId: string;
  recipientName: string;
  detail: DetailLevel;
  dailyTrigger: DailyTrigger;
  fallbackTime: string; // "19:30"
  weeklyDay: number; // 1 = Monday
  weeklyTime: string; // "08:00"
  monthlyDay: number; // 1
  monthlyTime: string; // "08:00"
  lowstockMode: LowstockMode;
  lowstockMax: number;
  headerText: string; // custom prepended text (editable from settings)
  footerText: string; // custom appended text
};

export const DEFAULT_LINE_SETTINGS: LineSettings = {
  enabled: false,
  autoSend: false, // scheduled sending is opt-in
  workerSend: true, // worker-initiated push is on once LINE is enabled
  token: "",
  recipientId: "",
  recipientName: "กลุ่มผู้ดูแลโรงงาน SC",
  detail: "summary",
  dailyTrigger: "after",
  fallbackTime: "19:30",
  weeklyDay: 1,
  weeklyTime: "08:00",
  monthlyDay: 1,
  monthlyTime: "08:00",
  lowstockMode: "digest",
  lowstockMax: 5,
  headerText: "",
  footerText: "",
};
