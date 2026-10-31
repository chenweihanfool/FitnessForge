// 資料庫裡的肌群名稱、類別與步數項目是舊的簡體字串，程式也拿它們當比對的鍵，所以不能改；
// 顯示到畫面時一律經過這裡轉成繁體。
const LABELS: Record<string, string> = {
  "二头肌": "二頭肌",
  "三头肌": "三頭肌",
  "活动量": "活動量",
  "柔韧性": "柔軟度",
  "每周平均步数": "每週平均步數",
};

export const displayLabel = (name: string) => LABELS[name] ?? name;
