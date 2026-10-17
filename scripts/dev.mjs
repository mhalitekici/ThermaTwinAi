import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
if (!existsSync(python)) {
  console.error(
    "Python ortamı bulunamadı. README içindeki kurulum adımlarını tamamlayın.",
  );
  process.exit(1);
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function launch(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("error", () => {
    console.error("Geliştirme servisi başlatılamadı.");
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
// Direct executables keep both services in this process tree on Windows too.
launch(python, [
  "-m",
  "uvicorn",
  "thermatwin.api:app",
  "--host",
  "127.0.0.1",
  "--port",
  "8000",
]);
launch(process.execPath, [
  join(root, "node_modules/vite/bin/vite.js"),
  "--host",
  "127.0.0.1",
  "--strictPort",
]);
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
