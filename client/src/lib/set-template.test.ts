import assert from "node:assert/strict";
import { test } from "node:test";
import { computeProgressiveSets, detectProgression } from "./set-template";

test("次數被夾到 1 的遞增樣板仍認得出來（8→6→4→2→1）", () => {
  const rows = computeProgressiveSets(20, 10, 5, 8, 2);
  assert.deepEqual(rows.map((r) => r.reps), [8, 6, 4, 2, 1]);
  assert.deepEqual(detectProgression(rows), { startWeight: 20, increment: 10, numSets: 5, repsPerSet: 8, repsDecrement: 2 });
});

test("夾到 1 之後連續多組 1 下也認得出來", () => {
  const params = { startWeight: 0, increment: 5, numSets: 6, repsPerSet: 5, repsDecrement: 2 };
  const rows = computeProgressiveSets(params.startWeight, params.increment, params.numSets, params.repsPerSet, params.repsDecrement);
  assert.deepEqual(rows.map((r) => r.reps), [5, 3, 1, 1, 1, 1]);
  const detected = detectProgression(rows)!;
  assert.deepEqual(computeProgressiveSets(detected.startWeight, detected.increment, detected.numSets, detected.repsPerSet, detected.repsDecrement), rows);
});

test("一般等差與次數不變照舊", () => {
  assert.deepEqual(detectProgression(computeProgressiveSets(40, 2.5, 4, 5, 0)), { startWeight: 40, increment: 2.5, numSets: 4, repsPerSet: 5, repsDecrement: 0 });
  assert.deepEqual(detectProgression(computeProgressiveSets(10, 10, 3, 10, 2))?.repsDecrement, 2);
});

test("不是遞增樣板的明細回傳 null", () => {
  assert.equal(detectProgression([{ weight: 20, reps: 8 }]), null);
  assert.equal(detectProgression([{ weight: 20, reps: 8 }, { weight: 30, reps: 6 }, { weight: 45, reps: 4 }]), null); // 重量不等差
  assert.equal(detectProgression([{ weight: 20, reps: 8 }, { weight: 30, reps: 6 }, { weight: 40, reps: 5 }]), null); // 次數不等差
  assert.equal(detectProgression([{ weight: 20, reps: 8 }, { weight: 30, reps: 6 }, { weight: 40, reps: 1 }]), null); // 還沒減到 1 就跳到 1
  assert.equal(detectProgression([{ weight: 20, reps: 5 }, { weight: 30, reps: 6 }]), null); // 次數遞增
});
