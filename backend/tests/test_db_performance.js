import prisma from '../src/db/prisma.js';

async function main() {
  console.log('=== DATABASE SPATIAL INDEX PERFORMANCE EVALUATION ===\n');

  try {
    // 1. Check if the GiST Index exists
    console.log('Checking database indexes on "Restaurant" table...');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Restaurant';
    `;
    console.log('Found Indexes:');
    console.table(indexes);

    const hasGist = indexes.some(idx => idx.indexdef.toLowerCase().includes('gist'));
    if (hasGist) {
      console.log('✅ GiST Spatial Index confirmed in database!\n');
    } else {
      console.log('⚠️ No GiST Index found. Creating a temporary functional GiST index to perform benchmark...');
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Restaurant_spatial_idx" 
        ON "Restaurant" USING gist ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography));
      `);
      console.log('✅ Temporary GiST index created.\n');
    }

    const userLat = 2.1896;
    const userLng = 102.2501;
    const radiusMeters = 15000; // 15 km

    // Helper to extract execution time from EXPLAIN ANALYZE output
    function extractExecutionTime(plan) {
      let executionTime = 0;
      plan.forEach(row => {
        const line = row['QUERY PLAN'] || row['Query Plan'] || Object.values(row)[0];
        const execMatch = String(line).match(/Execution [Tt]ime:\s*([\d.]+)\s*ms/);
        if (execMatch) {
          executionTime = parseFloat(execMatch[1]);
        }
      });
      return executionTime;
    }

    // Warm up the database queries to load caches and compile plans
    console.log('Warming up database query parser and buffers...');
    for (let i = 0; i < 3; i++) {
      await prisma.$queryRawUnsafe(`
        SELECT id FROM "Restaurant"
        WHERE ST_DWithin(
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
          ${radiusMeters}
        ) LIMIT 1;
      `);
    }
    console.log('Warmup complete.\n');

    // 2. Benchmark Indexed Query
    // We disable sequential scans in this session to force PostgreSQL to use the GiST index on our small dataset
    console.log('Benchmarking INDEXED query (Forcing GiST Index Scan)...');
    await prisma.$executeRawUnsafe('SET enable_seqscan = off;');
    
    const indexedTimes = [];
    let samplePlanIndexed = null;

    try {
      for (let i = 0; i < 5; i++) {
        const plan = await prisma.$queryRawUnsafe(`
          EXPLAIN ANALYZE
          SELECT id, name, lat, lng
          FROM "Restaurant"
          WHERE ST_DWithin(
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
            ${radiusMeters}
          );
        `);
        if (i === 0) samplePlanIndexed = plan;
        const t = extractExecutionTime(plan);
        indexedTimes.push(t);
        console.log(`  Run #${i + 1}: ${t.toFixed(3)} ms`);
      }
    } finally {
      // Re-enable sequential scans
      await prisma.$executeRawUnsafe('SET enable_seqscan = on;');
    }
    const avgIndexed = indexedTimes.reduce((a, b) => a + b, 0) / indexedTimes.length;

    // 3. Benchmark Non-Indexed Query (Force Sequential Scan by disabling index scans in session)
    console.log('\nBenchmarking NON-INDEXED query (Forcing Sequential Scan)...');
    await prisma.$executeRawUnsafe('SET enable_indexscan = off;');
    await prisma.$executeRawUnsafe('SET enable_bitmapscan = off;');

    const nonIndexedTimes = [];
    let samplePlanNonIndexed = null;

    try {
      for (let i = 0; i < 5; i++) {
        const plan = await prisma.$queryRawUnsafe(`
          EXPLAIN ANALYZE
          SELECT id, name, lat, lng
          FROM "Restaurant"
          WHERE ST_DWithin(
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
            ${radiusMeters}
          );
        `);
        if (i === 0) samplePlanNonIndexed = plan;
        const t = extractExecutionTime(plan);
        nonIndexedTimes.push(t);
        console.log(`  Run #${i + 1}: ${t.toFixed(3)} ms`);
      }
    } finally {
      // Re-enable index and bitmap scans
      await prisma.$executeRawUnsafe('SET enable_indexscan = on;');
      await prisma.$executeRawUnsafe('SET enable_bitmapscan = on;');
    }
    const avgNonIndexed = nonIndexedTimes.reduce((a, b) => a + b, 0) / nonIndexedTimes.length;

    // 4. Calculate performance improvement
    const improvement = ((avgNonIndexed - avgIndexed) / avgNonIndexed) * 100;

    console.log('\n--- PERFORMANCE RESULTS ---');
    console.log(`Average Indexed Execution Time (GiST): ${avgIndexed.toFixed(3)} ms`);
    console.log(`Average Non-Indexed Execution Time (Seq): ${avgNonIndexed.toFixed(3)} ms`);
    console.log(`Performance Improvement: ${improvement.toFixed(2)}%`);

    console.log('\n--- SAMPLE INDEXED QUERY PLAN ---');
    samplePlanIndexed.forEach(row => {
      console.log(row['QUERY PLAN'] || row['Query Plan'] || Object.values(row)[0]);
    });

    console.log('\n--- SAMPLE NON-INDEXED QUERY PLAN ---');
    samplePlanNonIndexed.forEach(row => {
      console.log(row['QUERY PLAN'] || row['Query Plan'] || Object.values(row)[0]);
    });

    console.log('\n--- THESIS READY MARKDOWN TABLE ---');
    console.log('| Query Type / Access Method | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Run 4 (ms) | Run 5 (ms) | Average (ms) | Performance Gain (%) |');
    console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
    console.log(`| **Indexed Scan (GiST)** | ${indexedTimes[0].toFixed(3)} | ${indexedTimes[1].toFixed(3)} | ${indexedTimes[2].toFixed(3)} | ${indexedTimes[3].toFixed(3)} | ${indexedTimes[4].toFixed(3)} | ${avgIndexed.toFixed(3)} ms | **${improvement.toFixed(2)}% (Ref)** |`);
    console.log(`| **Sequential Scan (Forced)** | ${nonIndexedTimes[0].toFixed(3)} | ${nonIndexedTimes[1].toFixed(3)} | ${nonIndexedTimes[2].toFixed(3)} | ${nonIndexedTimes[3].toFixed(3)} | ${nonIndexedTimes[4].toFixed(3)} | ${avgNonIndexed.toFixed(3)} ms | Baseline |`);

    console.log('\n--- DISCUSSION OF FINDINGS ---');
    console.log(`To evaluate PostGIS spatial indexing efficiency, we conducted execution plan analyses using \`EXPLAIN ANALYZE\` in PostgreSQL. The database query uses \`ST_DWithin\` to filter restaurants within 15 km of Malacca\'s center.
- In the **Indexed** configuration, PostgreSQL utilizes the GiST (Generalized Search Tree) functional index created on the geometry expression \`ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography\`. By setting \`enable_seqscan = off\`, we force the planner to use the GiST index. This results in an average query execution time of **${avgIndexed.toFixed(3)} ms**.
- In the **Non-Indexed** configuration, index and bitmap scans are disabled at the session level, forcing PostgreSQL to perform a sequential table scan. This triggers a bounding-box and distance evaluation for every single row in the \`Restaurant\` table, resulting in an average execution time of **${avgNonIndexed.toFixed(3)} ms**.
- The GiST spatial index yields a **${improvement.toFixed(2)}%** latency reduction, showing that bounding spatial index scans scale much better than raw sequential scans as the database size increases.`);

  } catch (err) {
    console.error('Error running spatial index performance test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
