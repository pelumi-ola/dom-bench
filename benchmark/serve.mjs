// Tiny static server: http://localhost:PORT/<framework>/ -> apps/<framework>/dist
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps");
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const [, fw, ...rest] = decodeURIComponent(req.url.split("?")[0]).split("/");
    let file = path.join(root, fw || "", "dist", rest.join("/") || "index.html");
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, port: server.address().port })));
}
