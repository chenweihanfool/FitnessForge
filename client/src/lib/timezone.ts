/**
 * 获取UTC+8（台北时间）的当前时间
 * @returns UTC+8时间字符串（格式：YYYY-MM-DDTHH:mm），用于datetime-local输入
 */
export function getTaipeiTime(): string {
  const now = new Date();
  
  // Date.getTime()已经返回UTC时间戳
  // 直接加8小时即可得到UTC+8
  const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  
  // toISOString()返回UTC格式的字符串，但由于我们已经加了8小时
  // 所以这个字符串实际上表示的是UTC+8的时间
  return utc8Time.toISOString().slice(0, 16);
}

/**
 * 将日期转换为UTC+8（台北时间）显示
 * @param date 日期对象或ISO字符串
 * @returns UTC+8时间字符串（格式：YYYY-MM-DDTHH:mm）
 */
export function toTaipeiTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // 数据库存储的是UTC时间，需要加8小时转换为台北时间显示
  const utc8Time = new Date(dateObj.getTime() + (8 * 60 * 60 * 1000));
  
  return utc8Time.toISOString().slice(0, 16);
}
