// Developer-only build. Reads a PUBLIC project configuration; privileged keys refused.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
const root = dirname(fileURLToPath(import.meta.url)),
  read = (f) => readFileSync(join(root, "web", f), "utf8");
const cfg = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], "utf8"))
  : { url: "", publicKey: "" };
if (
  Object.keys(cfg).some((k) => !["url", "publicKey"].includes(k)) ||
  typeof cfg.url !== "string" ||
  typeof cfg.publicKey !== "string"
)
  throw Error("Configuration publique : url et publicKey seulement.");
if (cfg.url || cfg.publicKey) {
  const url = new URL(cfg.url);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !/^[-a-z0-9]+\.supabase\.co$/.test(url.hostname)
  )
    throw Error("URL HTTPS Supabase attendue (sans chemin).");
  cfg.url = url.origin;
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(cfg.publicKey)) {
    let jwt;
    try {
      jwt = JSON.parse(Buffer.from(cfg.publicKey.split(".")[1], "base64url"));
    } catch {}
    if (cfg.publicKey.split(".").length !== 3 || jwt?.role !== "anon")
      throw Error(
        "Seule une clé publique publishable ou anon est permise. Jamais service_role / secret.",
      );
  }
}
const scripts = ["domain.js", "services.js", "demo.js", "ui.js"]
  .map(
    (f) =>
      "<script>\n" +
      read(f).replace(/<\/script/gi, "<\\/script") +
      "\n</script>",
  )
  .join("\n");
const config =
  "<script>window.SEMIN_V3_CONFIG=" +
  JSON.stringify(cfg).replace(/</g, "\\u003c") +
  ";</script>";
const html = read("index.template.html")
  .replace("__CONNECT__", cfg.url || "'none'")
  .replace("<!-- STYLES -->", "<style>" + read("style.css") + "</style>")
  .replace("<!-- SCRIPTS -->", config + "\n" + scripts);
const out = process.env.SEMIN_V3_BUILD_DIR
  ? resolve(process.env.SEMIN_V3_BUILD_DIR)
  : join(root, "dist");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "index.html"), html);
console.log("Interface V3.1 construite ; aucune publication.");
