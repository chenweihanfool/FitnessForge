import type { AcwrZone } from "@shared/training/acwr";

// ACWR 分區的顯示文案與顏色，儀表板、快速記錄、新增記錄共用同一份。
export const ACWR_ZONE_META: Record<
  AcwrZone,
  { label: string; advice: string; badge: string; bar: string; text: string }
> = {
  insufficient: {
    label: "資料累積中",
    advice: "記錄滿 4 週後，疲勞風險指數會更準確；現在的數字僅供參考。",
    badge: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
  low: {
    label: "負荷偏低",
    advice: "最近訓練量比平常少，身體很有餘裕。想進步的話可以循序加量，每週增幅別超過 10%。",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  optimal: {
    label: "甜蜜點",
    advice: "近期負荷跟身體適應程度相稱，受傷風險最低，維持目前節奏。",
    badge: "bg-green-500/15 text-green-700 dark:text-green-300",
    bar: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
  },
  caution: {
    label: "注意疲勞",
    advice: "本週負荷明顯高於過去四週的平均。建議今天改練輕量或不同肌群，並確保睡眠與蛋白質。",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    label: "高風險",
    advice: "本週負荷暴增，受傷與過度疲勞風險偏高。建議今天休息或只做低強度活動，下週回到平常的量。",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300",
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
};
