import { Hono } from "hono";
import type { Env } from "./env";
import { auth } from "./routes/auth";
import { notes } from "./routes/notes";
import { vaults } from "./routes/vaults";
import { folders } from "./routes/folders";
import { assets } from "./routes/assets";
import { exportRoute } from "./routes/export";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", c.env.APP_URL);
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
});

app.options("/api/*", (c) => c.body(null, 204));

app.route("/api/auth", auth);
app.route("/api/vaults", vaults);
app.route("/api/folders", folders);
app.route("/api/assets", assets);
app.route("/api/export", exportRoute);
app.route("/api/notes", notes);

app.get("/api/health", (c) => c.json({ ok: true }));

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
