// worker/src/index.js — turns verified medicine facts into plain-language explanations with Gemini.
// The Gemini key lives only in Worker secrets; APP_TOKEN deters casual abuse but is not real security
// (it ships inside the app bundle).

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

const RULES =
  "You explain medicines to a curious 14-year-old. Use ONLY the facts below. Never name any other protein, never give doses, never give medical advice. Plain language, 2–3 sentences per card.";

const FIELDS = ["drug", "protein", "shortName", "gene", "uniprotId", "functionText", "mechanism", "actionType", "structureNote"];

function factsText(body) {
  return FIELDS.filter((k) => body[k] !== undefined && body[k] !== "")
    .map((k) => `${k}: ${String(body[k])}`)
    .join("\n");
}

const ROUTES = {
  "/explain": {
    keys: ["protein", "drug", "effect"],
    prompt: (facts) =>
      `${RULES} FACTS:\n${facts}\n\nReturn JSON only: {"protein": "<what the protein normally does>", "drug": "<what the drug changes>", "effect": "<why that helps and can cause side effects>. Ask your pharmacist if you have questions."}`,
  },
  "/deepdive": {
    keys: ["sideEffects", "metabolism"],
    prompt: (facts) =>
      `${RULES} FACTS:\n${facts}\n\nReturn JSON only: {"sideEffects": "<which side effects follow from this target and why, 3–4 sentences, ending with 'Ask your pharmacist if you have questions.'>", "metabolism": "<how the body absorbs, breaks down and clears the drug, 3 sentences, no numbers that could be read as doses>"}`,
  },
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function callGemini(env, prompt) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    }),
  });
  if (!res.ok) return { error: `gemini ${res.status}` };
  const data = await res.json();
  try {
    return { value: JSON.parse(data.candidates[0].content.parts[0].text) };
  } catch {
    return { error: "gemini returned unparseable output" };
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/health") return json({ ok: true });

    const route = ROUTES[pathname];
    if (!route) return json({ error: "not found" }, 404);
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
    if (!env.APP_TOKEN || request.headers.get("x-app-token") !== env.APP_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON body" }, 400);
    }
    if (!body || typeof body.drug !== "string" || typeof body.protein !== "string") {
      return json({ error: "drug and protein are required" }, 400);
    }

    const result = await callGemini(env, route.prompt(factsText(body)));
    if (result.error) return json({ error: result.error }, 502);

    const out = result.value;
    const valid = out && typeof out === "object" && route.keys.every((k) => typeof out[k] === "string" && out[k].trim());
    if (!valid) return json({ error: "gemini returned unexpected shape" }, 502);

    const clean = Object.fromEntries(route.keys.map((k) => [k, out[k].trim()]));
    return json(clean, 200, { "Cache-Control": "private, max-age=86400" });
  },
};
