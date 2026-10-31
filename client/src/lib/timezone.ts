/**
 * 獲取UTC+8（臺北時間）的當前時間
 * @returns UTC+8時間字串（格式：YYYY-MM-DDTHH:mm），用於datetime-local輸入
 */
export function getTaipeiTime(): string {
  const now = new Date();
  
  // Date.getTime()已經返回UTC時間戳
  // 直接加8小時即可得到UTC+8
  const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  
  // toISOString()返回UTC格式的字串，但由於我們已經加了8小時
  // 所以這個字串實際上表示的是UTC+8的時間
  return utc8Time.toISOString().slice(0, 16);
}

/**
 * 將日期轉換為UTC+8（臺北時間）顯示
 * @param date 日期物件或ISO字串
 * @returns UTC+8時間字串（格式：YYYY-MM-DDTHH:mm）
 */
export function toTaipeiTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // 資料庫儲存的是UTC時間，需要加8小時轉換為臺北時間顯示
  const utc8Time = new Date(dateObj.getTime() + (8 * 60 * 60 * 1000));
  
  return utc8Time.toISOString().slice(0, 16);
}
