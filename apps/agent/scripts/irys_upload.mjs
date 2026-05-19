import { NodeIrys } from "@irys/sdk";

// Read JSON data from stdin
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
const input = Buffer.concat(chunks).toString("utf-8");

const { data, token, nodeUrl, privateKey, providerUrl } = JSON.parse(input);

if (!data || !token || !nodeUrl || !privateKey) {
  console.error(JSON.stringify({ error: "Missing required fields: data, token, nodeUrl, privateKey" }));
  process.exit(1);
}

try {
  const irys = new NodeIrys({
    url: nodeUrl,
    token: token,
    key: privateKey,
    config: {
      providerUrl: providerUrl || "https://rpc-amoy.polygon.technology",
    },
  });

  await irys.ready();

  const receipt = await irys.upload(data, {
    tags: [{ name: "Content-Type", value: "application/json" }],
  });

  console.log(JSON.stringify({ id: receipt.id }));
} catch (err) {
  console.error(JSON.stringify({ error: err.message || String(err) }));
  process.exit(1);
}
