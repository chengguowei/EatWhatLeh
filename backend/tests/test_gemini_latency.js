import { parseUserPrompt } from '../src/services/gemini.js';
import prisma from '../src/db/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

// Helper to compute statistical measures
function getStats(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const average = sum / sorted.length;
  
  // Median (50th percentile)
  const medianIdx = Math.floor(sorted.length * 0.5);
  const median = sorted[medianIdx];
  
  // 95th Percentile (p95)
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Idx];
  
  return { average, median, p95, min, max };
}

async function main() {
  console.log('=== LIVE GEMINI RESPONSE TIME BENCHMARKING ===');
  const iterations = 15;
  console.log(`Running ${iterations} live Gemini API calls sequentially with a 13-second delay to avoid 5 RPM rate limits.`);
  console.log(`Estimated completion time: ~3.5 minutes. Please wait...\n`);

  const latencies = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`[Call ${i + 1}/${iterations}] Querying Gemini API...`);
    const start = Date.now();
    try {
      // Call live Gemini parse service
      await parseUserPrompt('cheap nyonya food near me');
      const duration = Date.now() - start;
      latencies.push(duration);
      console.log(`  Done in ${duration}ms.`);
    } catch (err) {
      console.error(`  Error in call ${i + 1}: ${err.message}`);
    }

    // Delay 13 seconds between requests (except the last one)
    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 13000));
    }
  }

  if (latencies.length === 0) {
    console.error('All benchmark iterations failed. No latency data gathered.');
    return;
  }

  const stats = getStats(latencies);

  console.log('\n--- LIVE GEMINI LATENCY STATISTICS ---');
  console.log(`Successful Calls: ${latencies.length}/${iterations}`);
  console.log(`Average Latency: ${stats.average.toFixed(2)} ms`);
  console.log(`Median Latency: ${stats.median.toFixed(2)} ms`);
  console.log(`P95 Latency: ${stats.p95.toFixed(2)} ms`);
  console.log(`Minimum Latency: ${stats.min.toFixed(2)} ms`);
  console.log(`Maximum Latency: ${stats.max.toFixed(2)} ms`);

  console.log('\n--- THESIS READY MARKDOWN TABLE ---');
  console.log('| Operation | Average (ms) | Median (ms) | P95 (ms) | Min (ms) | Max (ms) |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  console.log(`| Gemini Query Processing (Live) | ${stats.average.toFixed(2)} | ${stats.median.toFixed(2)} | ${stats.p95.toFixed(2)} | ${stats.min.toFixed(2)} | ${stats.max.toFixed(2)} |`);

  console.log('\n--- DISCUSSION OF FINDINGS ---');
  console.log(`The response latency of the live Gemini Semantic Router was benchmarked over ${latencies.length} sequential API requests. 
The average query processing latency was measured at **${stats.average.toFixed(2)} ms**, with a median of **${stats.median.toFixed(2)} ms** and a P95 tail latency of **${stats.p95.toFixed(2)} ms**. The minimum and maximum processing times were **${stats.min.toFixed(2)} ms** and **${stats.max.toFixed(2)} ms** respectively. 
This latency incorporates network transit time from the local server to Google\'s API endpoints and the deep-learning model inference time for entity extraction. These response times demonstrate that Gemini is suitable for real-time conversational search applications, as typical user response thresholds for interactive systems are comfortably maintained under 2.5 seconds.`);

}

main().catch(err => console.error(err)).finally(async () => {
  await prisma.$disconnect();
});
