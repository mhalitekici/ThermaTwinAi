// Local contract check for this project's exact SPA rewrites, not a Vercel emulator.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    directory: { type: "string" },
    port: { type: "string", default: "5175" },
  },
});
const directory = resolve(values.directory || "dist");
const config = JSON.parse(await readFile("vercel.json", "utf8"));
const rewrites = new Map(
  config.rewrites.map(({ source, destination }) => {
    if (!/^\/[a-z]+$/.test(source) || destination !== "/index.html")
      throw new Error("Update the routing contract server for this rewrite.");
    return [source, destination];
  }),
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};
createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    const path = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    const target = path === "/" ? "/index.html" : rewrites.get(path) || path;
    const file = resolve(directory, "." + target);
    const displacement = relative(directory, file);
    if (
      displacement.startsWith("..") ||
      isAbsolute(displacement) ||
      !(await stat(file)).isFile()
    ) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    response.setHeader("Cache-Control", "no-cache");
    for (const rule of config.headers || []) {
      if (rule.source !== "/(.*)")
        throw new Error("Unsupported header rule in local contract check.");
      for (const header of rule.headers)
        response.setHeader(header.key, header.value);
    }
    response
      .writeHead(200)
      .end(request.method === "HEAD" ? undefined : await readFile(file));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
}).listen(Number(values.port), "127.0.0.1", () => {
  console.log(`Routing contract server: http://127.0.0.1:${values.port}`);
});
