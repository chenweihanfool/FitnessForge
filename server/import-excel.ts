import XLSX from 'xlsx';
import { Pool } from 'pg';

async function importData() {
  // 读取Excel文件
  const workbook = XLSX.readFile('attached_assets/運動_1761465046408.xlsx');
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

  // 连接数据库
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // 解析运动项目（从第3、4、5行）
    const units = data[2]; // 第3行：单位
    const weights = data[3]; // 第4行：权重系数
    const names = data[4]; // 第5行：项目名称

    const exercises: Array<{name: string, unit: string, weightFactor: number, category: string}> = [];
    
    // 从第3列开始（索引2），解析运动项目
    for (let i = 2; i < 13; i++) {
      if (names[i] && weights[i]) {
        const category = i < 11 ? '力量' : '有氧'; // 根据列位置判断分类
        exercises.push({
          name: String(names[i]),
          unit: String(units[i] || ''),
          weightFactor: parseFloat(weights[i]) || 1,
          category: category
        });
      }
    }
    
    // 添加活动量数据（步数，索引16）
    if (names[16] && units[16]) {
      exercises.push({
        name: '每周平均步数',
        unit: String(units[16]), // 步數
        weightFactor: 1.4, // 用户指定的权重值
        category: '其他'
      });
    }

    console.log('准备导入的运动项目:');
    exercises.forEach((ex, idx) => {
      console.log(`${idx + 1}. ${ex.name} (${ex.unit}, 权重${ex.weightFactor}, 分类:${ex.category})`);
    });

    // 创建运动项目
    const exerciseIds: Record<string, string> = {};
    for (const ex of exercises) {
      const result = await pool.query(
        'INSERT INTO exercises (name, unit, weight_factor, category) VALUES ($1, $2, $3, $4) RETURNING id, name',
        [ex.name, ex.unit, ex.weightFactor, ex.category]
      );
      exerciseIds[ex.name] = result.rows[0].id;
      console.log(`✓ 创建运动项目: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
    }

    // 解析并导入每周数据（从第9行开始）
    let entriesCount = 0;
    for (let rowIdx = 8; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      if (!row[0]) continue; // 跳过空行

      const date = excelDateToJSDate(row[0] as number); // Excel日期转换
      
      // 为每个运动项目创建记录（如果有数据）
      for (let i = 2; i < 13; i++) {
        if (names[i] && row[i] && Number(row[i]) > 0) {
          const exerciseName = String(names[i]);
          const value = parseFloat(String(row[i]));
          
          if (exerciseIds[exerciseName]) {
            await pool.query(
              'INSERT INTO workout_entries (exercise_id, value, date) VALUES ($1, $2, $3)',
              [exerciseIds[exerciseName], value, date]
            );
            entriesCount++;
          }
        }
      }
      
      // 导入活动量数据（索引16 - 步数）
      if (row[16] && Number(row[16]) > 0) {
        const stepValue = parseFloat(String(row[16]));
        if (exerciseIds['每周平均步数']) {
          await pool.query(
            'INSERT INTO workout_entries (exercise_id, value, date) VALUES ($1, $2, $3)',
            [exerciseIds['每周平均步数'], stepValue, date]
          );
          entriesCount++;
        }
      }
    }

    console.log(`\n✓ 成功导入 ${exercises.length} 个运动项目`);
    console.log(`✓ 成功导入 ${entriesCount} 条训练记录`);

  } catch (error) {
    console.error('导入失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Excel日期转JavaScript日期
function excelDateToJSDate(excelDate: number): Date {
  // Excel日期是从1900年1月1日开始的天数
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  return date;
}

importData().catch(console.error);
