export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Signature-Ed25519,X-Signature-Timestamp"
    };
    if (request.method === "OPTIONS") return new Response("", { headers: cors });

    // === 1. API: /notify (網站報名 -> Discord) ===
    if (url.pathname === "/notify" && request.method === "POST") {
      try {
        const body = await request.json();
        const { name, slot, action, dateKey, githubUrl, total } = body;
        const webhook = env.DISCORD_WEBHOOK_URL;
        if (!webhook) {
          return new Response("Missing DISCORD_WEBHOOK_URL secret", { status: 500, headers: cors });
        }
        const content = `@everyone 【Linking FC FC27 ${dateKey}】\n${action === "join" ? "✅ 報名" : "❌ 取消"} **${name}** -> **${slot}**\n總計 ${total}人次\n🔗 ${githubUrl || "https://siumeifc1988-sketch.github.io/signup/"}`;
        const discordRes = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, username: "Linking FC Bot" })
        });
        const txt = await discordRes.text();
        return new Response(JSON.stringify({ ok: discordRes.ok, discordStatus: discordRes.status, discordBody: txt }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    // === 2. API: /interactions (真 Bot 驗證用，如果你之後要做 /報名) ===
    if (url.pathname === "/interactions" && request.method === "POST") {
      // 先簡單回 PING，令 Discord 認證通過
      const bodyText = await request.clone().text();
      try {
        const body = JSON.parse(bodyText);
        if (body.type === 1) {
          return new Response(JSON.stringify({ type: 1 }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      } catch {}
      return new Response(JSON.stringify({ type: 1 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // === 3. 健康檢查 ===
    if (url.pathname === "/health" || (url.pathname === "/" && request.headers.get("accept")?.includes("text/plain"))) {
      return new Response("LinKing FC Bot OK! /notify ready", { headers: cors });
    }

    // === 4. 其他全部當靜態網站派發 ===
    // Cloudflare 新版 Workers with Assets 會提供 env.ASSETS
    if (env.ASSETS) {
      try {
        // 先試吓 ASSETS
        const assetRes = await env.ASSETS.fetch(request);
        // 如果係 /notify 唔存在，ASSETS 會 404，我哋已經上面處理咗，所以呢度直接回
        if (assetRes.status !== 404) return assetRes;
      } catch {}
    }
    // 如果冇 ASSETS binding，就回一個簡單提示，叫你去綁 assets
    // 但為咗你而家 "Add files via upload" 模式，呢度會由 Cloudflare 自動處理靜態，所以一般唔會行到呢度
    return new Response("Not found - 請確認 wrangler.toml 有 [assets] 設定", { status: 404, headers: cors });
  }
};
