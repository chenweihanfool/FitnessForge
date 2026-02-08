const { Pool } = require('pg');

const devPool = new Pool({ connectionString: process.env.DATABASE_URL });

// We'll read from production using the execute_sql_tool results saved to files
async function main() {
  const client = await devPool.connect();
  try {
    await client.query('BEGIN');
    
    // Clear dev tables in correct order (foreign key constraints)
    console.log('Clearing development database...');
    await client.query('DELETE FROM weekly_muscle_stats');
    await client.query('DELETE FROM workout_entries');
    await client.query('DELETE FROM exercises');
    console.log('Dev database cleared.');
    
    // Insert exercises
    console.log('Inserting exercises...');
    const exerciseRows = [
      ['959bd3a0-976d-4eae-806e-06d81d5a0068','二頭肌彎舉','下',12,'力量',null,0,0,0,0,0,100,0,0,0],
      ['c82a8755-86e3-4ae6-b076-b2c61dc7e9b4','伏地起身','下',20,'力量',null,0,60,0,0,15,0,0,0,25],
      ['704d2557-8844-4f3e-aa73-89dcc8f7992e','反向划船','下',20,'力量',null,0,0,60,0,0,20,10,0,10],
      ['1d59f600-b043-47ae-bdc4-c10b18a1c57b','啞鈴深蹲','下',20,'力量',null,0,0,0,55,0,0,20,25,0],
      ['442d3c73-851e-4b0d-820a-5e5e427ced86','弓步蹲','下',20,'力量',null,0,0,0,55,0,0,10,35,0],
      ['22b1edb4-0252-494f-8613-eb45f43ae35f','引體吊掛','秒',5,'力量',null,0,0,60,0,0,30,10,0,0],
      ['37c348a2-3d3e-43f3-b5b8-fad67622d3ca','捲腹','秒',5,'力量',null,0,0,0,0,0,0,100,0,0],
      ['49f0c9e7-2650-4264-a521-88f7b34b49f4','每周平均步数','步數',0.12,'活动量',null,0,0,0,0,0,0,0,0,0],
      ['b8d04002-44fd-4626-95d1-c50ec8668f20','深蹲','下',50,'力量',null,0,0,0,50,0,0,20,30,0],
      ['b8b9ada3-a2cc-4820-8718-79a9043c1e84','硬舉','下',90,'力量',null,0,0,40,20,0,0,20,20,0],
      ['b716449a-e3a8-40de-8d90-f08c82fee93f','站立肩推','下',20,'力量',null,0,0,0,0,60,0,20,0,20],
      ['4c49fc7f-0ee3-41ce-9846-e2653ddbec33','超人式','秒',4,'力量',null,0,0,50,20,0,0,0,30,0],
      ['17ede18a-def1-4cf9-8091-a700d2b804c9','跑步','KM',600,'有氧',null,0,0,0,0,0,0,0,0,0],
      ['d38b8076-7aec-4ff5-8b7c-fb17aa7f965e','跑步機負重','KM',1200,'有氧','力量',0.4,0,0,63,0,0,0,37,0],
      ['eeded533-fc23-413c-bf0f-2bee77d41c87','開合跳','下',5,'有氧','力量',0.3,0,0,67,33,0,0,0,0],
      ['4461cdd9-4f8d-4961-8b98-7d14c947b152','雙槓捲腹','下',25,'力量',null,0,0,0,30,0,0,70,0,0],
      ['92490af9-1d02-43c0-9696-a04121bb0910','雙槓臂屈伸','下',25,'力量',null,0,40,0,0,10,0,0,0,50],
    ];
    
    for (const row of exerciseRows) {
      await client.query(
        `INSERT INTO exercises (id, name, unit, weight_factor, category, split_category, split_ratio, muscle_chest, muscle_back, muscle_legs, muscle_shoulders, muscle_arms, muscle_core, muscle_glutes, muscle_full_body) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        row
      );
    }
    console.log(`Inserted ${exerciseRows.length} exercises.`);
    
    await client.query('COMMIT');
    console.log('Exercises committed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
  } finally {
    client.release();
    await devPool.end();
  }
}

main();
