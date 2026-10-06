// Read-only: last 50 mainnet txs of the deployer. No keys used.
import https from "node:https";

const HOST = "explorer.mainnet.chain.robinhood.com";
const ADDR = "0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d";

function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "172.66.147.70",
        port: 443,
        path,
        method: "GET",
        headers: { Host: HOST, "User-Agent": "Mozilla/5.0" },
        servername: HOST,
        timeout: 20000,
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

let next = `/api/v2/addresses/${ADDR}/transactions?limit=50`;
let shown = 0;
while (next && shown < 50) {
  const r = await get(next);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 120)}`);
  const j = JSON.parse(r.body);
  for (const t of j.items ?? []) {
    const dir = t.from.hash.toLowerCase() === ADDR.toLowerCase() ? "OUT" : "IN ";
    console.log(
      `${t.timestamp} ${dir} ${t.hash} to=${(t.to?.hash ?? "CREATE").slice(0, 14)} value=${t.value} fee=${t.fee?.value ?? "?"} status=${t.status}`
    );
    shown++;
  }
  next = j.next_page_params
    ? `/api/v2/addresses/${ADDR}/transactions?${new URLSearchParams({ ...j.next_page_params, limit: 50 }).toString()}`
    : null;
}
console.log("total shown:", shown);
