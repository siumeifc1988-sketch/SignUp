/**
 * LinKing FC 安全版 Worker - 含 iPhone 手動註冊
 */
import { verifyKey } from 'discord-interactions';
const FIREBASE_PROJECT_ID = "football-signup-64bd9";
async function getTodayAttendance() {
  try {
    const hkDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/attendance/${hkDate}`;
    const res = await fetch(url);
    if (!res.ok) { if (res.status === 404) return { date: hkDate, empty: true }; throw new Error(res.status); }
    const json = await res.json(); return { date: hkDate, fields: json.fields || {} };
  } catch (e) { return { error: e.message }; }
}
function parseSlots(fields) {
  const result = { '2100': [], '2130': [], '2200': [], '2230': [], 'Unsure': [] };
  try { const map = fields?.slots?.mapValue?.fields; if (!map) return result;
    for (const k of Object.keys(result)) { const arr = map[k]?.arrayValue?.values || []; result[k] = arr.map(v => v.stringValue).filter(Boolean); }
  } catch {} return result;
}
const COMMANDS = [
  { name: "報名", description: "睇今日報名名單" },
  { name: "ping", description: "測試Bot在唔在線" },
  { name: "規矩", description: "睇球隊規矩" },
  { name: "場地", description: "睇場地" },
];
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/manual-register' && request.method === 'POST') {
      try {
        const { appId, token } = await request.json();
        if (!appId || !token) return new Response('Missing appId/token', { status: 400 });
        const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
          method: 'PUT',
          headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(COMMANDS)
        });
        const text = await res.text();
        return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }
    if (url.pathname === '/manual-register' && request.method === 'OPTIONS') {
      return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }
    if (url.pathname === '/register') {
      if (!env.DISCORD_BOT_TOKEN) return new Response('Missing DISCORD_BOT_TOKEN secret - 請用 /manual-register (iPhone 版)', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
      if (!env.DISCORD_APPLICATION_ID) return new Response('Missing DISCORD_APPLICATION_ID', { status: 500 });
      const res = await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/commands`, {
        method: 'PUT',
        headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(COMMANDS)
      });
      const text = await res.text();
      return new Response(`Register status ${res.status}:\n${text}`, { status: res.ok ? 200 : 500 });
    }
    if (url.pathname === '/notify' && request.method === 'POST') {
      try {
        const { name, slot, action } = await request.json();
        if (!name || !slot) return new Response('Bad request', { status: 400 });
        if (name.length > 20 || slot.length > 10) return new Response('Too long', { status: 400 });
        const webhookUrl = env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) return new Response('Webhook not configured', { status: 500 });
        const embed = { title: action === 'leave' ? '❌ 有人退出' : '⚽ 有人報名', color: action === 'leave' ? 0xFF4444 : 0xA3FF12,
          fields: [{ name: '球員', value: name, inline: true }, { name: '時段', value: slot, inline: true }, { name: '時間', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }],
          footer: { text: 'LinKing FC 自動通知' }, timestamp: new Date().toISOString() };
        ctx.waitUntil(fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) }));
        return Response.json({ ok: true }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }
    if (request.method === 'GET' && url.pathname === '/') { return new Response('LinKing FC Bot OK! 用 /manual-register (iPhone)', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }); }
    if (request.method === 'POST') {
      const sig = request.headers.get('X-Signature-Ed25519'); const ts = request.headers.get('X-Signature-Timestamp');
      const body = await request.text(); const valid = await verifyKey(body, sig, ts, env.DISCORD_PUBLIC_KEY);
      if (!valid) return new Response('Bad sig', { status: 401 });
      const interaction = JSON.parse(body);
      if (interaction.type === 1) return Response.json({ type: 1 });
      if (interaction.type === 2) {
        const cmd = interaction.data.name;
        if (cmd === '報名' || cmd === 'baoming') {
          const att = await getTodayAttendance();
          if (att.error) return Response.json({ type: 4, data: { content: `❌ 讀取失敗` } });
          if (att.empty) return Response.json({ type: 4, data: { embeds: [{ title: `今日 ${att.date} 未有人報`, description: '👉 https://siumeifc1988-sketch.github.io/signup/', color: 0xA3FF12 }] } });
          const slots = parseSlots(att.fields); const total = Object.values(slots).flat().length;
          return Response.json({ type: 4, data: { embeds: [{ title: `⚽ 今日 ${att.date} 已有 ${total}人`, color: 0xA3FF12, fields: Object.entries(slots).map(([k,v]) => ({ name: k, value: v.join(', ') || '—', inline: false })), url: 'https://siumeifc1988-sketch.github.io/signup/' }] } });
        }
        if (cmd === 'ping') return Response.json({ type: 4, data: { content: '🏓 LinKing FC Bot 安全版在線！Webhook 已收埋喺 Cloudflare' } });
        if (cmd === '規矩') return Response.json({ type: 4, data: { embeds: [{ title: '📜 規矩', description: '20:30 截止，報名網: https://siumeifc1988-sketch.github.io/signup/', color: 0xA3FF12 }] } });
        if (cmd === '場地') return Response.json({ type: 4, data: { embeds: [{ title: '📍 場地', description: '荃灣海濱 / 葵涌', color: 0xA3FF12 }] } });
      }
    }
    return new Response('Not found', { status: 404 });
  }
};