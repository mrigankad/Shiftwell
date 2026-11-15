// Minimal stand-in for `codex app-server`: answers initialize and account/rateLimits/read.
let buf = "";
process.stdin.on("data", (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (m.id === 1) process.stdout.write(JSON.stringify({ id: 1, result: {} }) + "\n");
    if (m.id === 2) {
      if (process.env.CODEX_HOME?.includes("signedout")) process.stdout.write(JSON.stringify({ id: 2, error: { message: "Not signed in" } }) + "\n");
      else process.stdout.write(JSON.stringify({ id: 2, result: { rateLimits: {
        primary: { usedPercent: 9, windowDurationMins: 10080, resetsAt: 1900000000 },
        secondary: { usedPercent: 44, windowDurationMins: 300, resetsAt: 1900000500 }, planType: "plus" } } }) + "\n");
    }
  }
});
