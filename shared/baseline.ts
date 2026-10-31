// 基準值（baselineValue）計算公式——伺服器寫入記錄時算一次並固定存進資料庫，
// 前端新增/編輯表單的「基准值」即時預覽也走同一份，避免兩邊公式各改各的而
// 對不上（先前前端內嵌一份舊係數，預覽值跟實際入庫值差了 4 倍）。

export interface CategorySplitFields {
  category: string | null;
  splitCategory: string | null;
  splitRatio: number | null;
}

// 一筆記錄的基準值分給力量／有氧／活動量各多少（混合運動依 splitRatio 拆分）。
export function splitBaselineByCategory(exercise: CategorySplitFields, baseline: number) {
  const shares = { strength: 0, cardio: 0, activity: 0 };
  const add = (category: string | null, amount: number) => {
    if (category === '力量') shares.strength += amount;
    else if (category === '有氧') shares.cardio += amount;
    else if (category === '活动量') shares.activity += amount;
  };
  const secondary = exercise.splitCategory && exercise.splitRatio && exercise.splitRatio > 0 ? exercise.splitRatio : 0;
  add(exercise.category, baseline * (1 - secondary));
  if (secondary > 0) add(exercise.splitCategory, baseline * secondary);
  return shares;
}

export function calculateBaseline(
  value: number,
  sets: number,
  weightFactor: number,
  category: string | null,
  movementCoefficient: number,
  intensityFactor: number,
  exerciseName: string
): number {
  if (exerciseName === '每周平均步数' || category === '活动量') {
    if (value <= 0) return 0;
    const dailySteps = exerciseName === '每周平均步数' ? value / 7 : value;
    // (dailySteps/500) × (1 - 0.00002×dailySteps) 是一條開口向下的拋物線，
    // 峰值剛好在 25000 步（此時邊際遞減項恰好歸零），過了 25000 步分數開始
    // 倒退，50000 步歸零，再往上就變負數——實測發現真的走到 3、4 萬步（長途
    // 健行、體力活工作、或步數自動同步抓到異常值）分數不但不會更高，還會比
    // 走 1 萬步更低，甚至變負值拖累當週其他類別的加權總分。這裡把公式吃到的
    // 步數本身封頂在曲線峰值 25000，超過一律當 25000 算，確保分數只會越走
    // 越高或持平，不會再倒退或變負——跟其他地方「用封頂而不是放任公式亂跑」
    // 同一個原則（訓練量分封頂 150、雷達圖組數/容量分封頂 150）。
    const cappedDailySteps = Math.min(dailySteps, 25000);
    const dailyScore = (cappedDailySteps / 500) * (1 - 0.00002 * cappedDailySteps);
    return dailyScore * 7 * 2.4;
  }
  if (category === '有氧') {
    // 2026-09-12：有氧公式的固定乘數統一放大 4 倍（1.83→7.3、2.2→8.8），
    // 校正跟力量分之間的量級落差——原本同樣是一週練 3 次、時間強度都算紮實
    // 的訓練量，力量分數量級是有氧的 4 倍左右，且力量那邊的徒手動作參數改採
    // 體重公斤當量校準後（見 v3.25 前後的變更）這個落差被放大更明顯。intensity
    // Factor（強度因子）維持原本角色，繼續負責「同樣是有氧、但強度不同」的
    // 區分，不受這次調整影響。
    if (exerciseName === '開合跳') {
      return (value * (sets || 1) * 2 * intensityFactor) / 10 * 8.8;
    }
    if (exerciseName === '跑步' || exerciseName === '跑步機負重') {
      const minutes = value;
      let km: number;
      if (sets && sets > 0) {
        km = sets;
      } else {
        const defaultPace = exerciseName === '跑步' ? 12 : 20;
        km = minutes / defaultPace;
      }
      return (minutes + km * 10) * intensityFactor * 7.3;
    }
    return value * (sets || 1) * intensityFactor * 8.8;
  }
  if (category === '力量') {
    return weightFactor * value * (sets || 1) * movementCoefficient / 10;
  }
  return value * (sets || 1) * weightFactor;
}
