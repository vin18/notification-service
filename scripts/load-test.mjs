const baseUrl = process.env.LOAD_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? "50");
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? "10");

const latencies = [];
let success = 0;
let failure = 0;

async function runOne(index) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": `load-${Date.now()}-${index}`
    },
    body: JSON.stringify({
      tenantId: "load-tenant",
      userId: `load-user-${index}`,
      userEmail: `load-${index}@example.com`,
      channel: "EMAIL",
      subject: `Load ${index}`,
      body: "<p>load test</p>",
      idempotencyKey: `load-${Date.now()}-${index}`
    })
  });

  const durationMs = performance.now() - startedAt;
  latencies.push(durationMs);

  if (response.ok) {
    success += 1;
  } else {
    failure += 1;
  }
}

async function main() {
  const running = new Set();

  for (let index = 0; index < requests; index += 1) {
    const promise = runOne(index).finally(() => {
      running.delete(promise);
    });

    running.add(promise);

    if (running.size >= concurrency) {
      await Promise.race(running);
    }
  }

  await Promise.all(running);

  const sorted = [...latencies].sort((left, right) => left - right);
  const percentile = (value) => {
    const targetIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * value));
    return sorted[targetIndex] ?? 0;
  };

  console.log(JSON.stringify({
    baseUrl,
    requests,
    concurrency,
    success,
    failure,
    latencyMs: {
      p50: Number(percentile(0.5).toFixed(2)),
      p95: Number(percentile(0.95).toFixed(2)),
      max: Number((sorted.at(-1) ?? 0).toFixed(2))
    }
  }, null, 2));
}

await main();
