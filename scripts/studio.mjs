// Runs Prisma Studio so it is reachable from outside the nexora_app container.
//
// Studio only listens on 127.0.0.1, which a Docker port mapping can't reach, and it rejects requests
// whose Origin/Host port differs from its own (403). So Studio runs on 127.0.0.1:PORT and this script
// forwards PORT on the container's network address(es) to it — same port number on both sides.
//
// Usage: docker compose exec app npm run db:studio   → http://localhost:5555
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";

const PORT = Number(process.env.STUDIO_PORT ?? 5555);

// detached: Studio gets its own process group, so stopping it also stops the processes npx starts.
const studio = spawn("npx", ["prisma", "studio", "--port", String(PORT), "--browser", "none"], {
  stdio: "inherit",
  detached: true,
});

// Non-loopback IPv4 addresses of the container (where Docker delivers published ports).
const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

const proxies = addresses.map((address) => {
  const proxy = net.createServer((client) => {
    const upstream = net.connect(PORT, "127.0.0.1");
    client.pipe(upstream).pipe(client);
    const close = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", close);
    upstream.on("error", close);
  });
  proxy.listen(PORT, address);
  return proxy;
});

console.log(`Prisma Studio → http://localhost:${PORT} (forwarding ${addresses.join(", ")})`);

const stop = () => {
  proxies.forEach((p) => p.close());
  try {
    process.kill(-studio.pid, "SIGTERM");
  } catch {
    // already stopped
  }
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
studio.on("exit", (code) => {
  proxies.forEach((p) => p.close());
  process.exit(code ?? 0);
});
