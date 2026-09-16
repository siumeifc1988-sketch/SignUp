
export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response("", { headers: cors });
    }
    const url = new URL(request.url);
    if (url.pathname === "/notify" && request.method === "POST") {
      try {
        const body = await request.json();
        const { name, slot, action, dateKey, githubUrl, total } = body;
        const msg = {
          content: `@everyone 【Linking FC FC27 ${dateKey}】\n${action === "join" ? "✅ 報名" : "❌ 取消"} **${name}** -> **${slot}**\n總計 ${total}人次\n🔗 ${githubUrl}`,
          username: "Linking FC Bot"
        };
        if (env.DISCORD_WEBHOOK_URL) {
          await fetch(env.DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(msg)
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(e.message, { status: 500, headers: cors });
      }
    }
    return new Response(
      `LinKing FC Bot OK! /notify 已啟用 (Webhook 收埋咗)\n${url.origin}/\nGitHub: https://siumeifc1988-sketch.github.io/signup/`,
      { headers: cors }
    );
  }
}
