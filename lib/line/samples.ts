// Representative sample data for the LINE settings preview, so an admin can see
// the exact format of each message type before sending. Display-only constants.

import { formatDateThai, type WeeklyData, type MonthlyData, type WorkerCatData, type LowItem } from "@/lib/line/format";

export const SAMPLE_LOWSTOCK: { dateLabel: string; time: string; lowstock: LowItem[]; lowstockCount: number } = {
  dateLabel: formatDateThai(),
  time: "19:20",
  lowstock: [
    { name: 'ราง 1" 4m', stock: 18, min: 60, unit: "เส้น" },
    { name: 'ราง 2" 4m', stock: 44, min: 50, unit: "เส้น" },
    { name: "สกรูยึดราง M10×60", stock: 36, min: 40, unit: "กล่อง" },
    { name: "สีกันสนิม เทา 1กล.", stock: 18, min: 20, unit: "กระป๋อง" },
  ],
  lowstockCount: 6,
};

export const SAMPLE_WEEKLY: WeeklyData = {
  rangeLabel: "9 – 15 มิ.ย.",
  categories: [
    { name: "รางเหล็ก", unitTh: "เมตร", value: 3860 },
    { name: "สกรู / น็อต", unitTh: "กล่อง", value: 102 },
    { name: "สี / เคลือบ", unitTh: "กระป๋อง", value: 28 },
  ],
  lowstockCount: 5,
  topGroup: "รถส่งต่างจังหวัด",
};

export const SAMPLE_MONTHLY: MonthlyData = {
  monthLabel: "พฤษภาคม 2569",
  categories: [
    { name: "รางเหล็ก", unitTh: "เมตร", value: 15240 },
    { name: "สกรู / น็อต", unitTh: "กล่อง", value: 410 },
    { name: "สี / เคลือบ", unitTh: "กระป๋อง", value: 96 },
  ],
  topSkus: [
    { label: "RAIL-1-2M", name: 'ราง 1" 2 ม.', value: 1240, unitTh: "เส้น" },
    { label: "RAIL-2-3M", name: 'ราง 2" 3 ม.', value: 980, unitTh: "เส้น" },
    { label: "RAIL-1-1M", name: 'ราง 1" 1 ม.', value: 870, unitTh: "เส้น" },
  ],
  topGroup: "รถส่งต่างจังหวัด",
};

export const SAMPLE_WORKERCAT: WorkerCatData = {
  dateLabel: formatDateThai(),
  worker: "สมชาย (EMP001)",
  categoryName: "รางเหล็ก",
  isRail: true,
  groups: [
    {
      name: "รถส่งต่างจังหวัด",
      items: [
        { name: 'ราง 1" 2m', qty: 120, unit: "เส้น", lengthM: 2 },
        { name: 'ราง 1" 2.5m', qty: 120, unit: "เส้น", lengthM: 2.5 },
        { name: 'ราง 1" 3m', qty: 120, unit: "เส้น", lengthM: 3 },
        { name: 'ราง 1" 4m', qty: 60, unit: "เส้น", lengthM: 4 },
      ],
    },
  ],
};
