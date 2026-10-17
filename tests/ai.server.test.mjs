import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createApp } from "../server/app.mjs";
import { readConfig } from "../server/ai.mjs";
import { allowedFlavors, allowedDifficulties } from "../server/preferences.mjs";
import { recommend_preferences_json } from "../web/src/generated/engine.mjs";

// Explicit test doubles only. The CLI server has no fake-AI mode or default key.
const env = {
  AI_BASE_URL: "https://mock.invalid/v1",
  AI_API_KEY: "test-only-not-a-real-key",
  AI_MODEL: "mock-model",
};
const preference = {
  flavors: ["bitter"],
  difficulty: "easy",
  description: "微苦简单",
};
const completion = (
  content = JSON.stringify(preference),
  finish_reason = "stop",
) =>
  new Response(
    JSON.stringify({ choices: [{ finish_reason, message: { content } }] }),
  );
async function start(t, options = {}) {
  const app = createApp({
    env,
    fetchImpl: async () => completion(),
    ...options,
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        app.close(resolve);
        app.closeAllConnections();
      }),
  );
  return `http://127.0.0.1:${app.address().port}`;
}
const post = (base, body = { text: "想喝微苦、简单一点的酒" }, headers = {}) =>
  fetch(base + "/api/ai/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const read = async (name) =>
  JSON.parse(
    await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"),
  );

test("valid Chat Completions JSON is validated and its free prose is never relayed", async (t) => {
  const base = await start(t, {
    fetchImpl: async () =>
      completion(
        JSON.stringify({
          ...preference,
          description: "Made Up Cocktail 99 ml with personal details",
        }),
      ),
  });
  const response = await post(base);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    preferences: {
      flavors: ["bitter"],
      difficulty: "easy",
      description: "微苦、制作简单",
    },
  });
});

test("invalid model JSON and markdown fences are rejected", async (t) => {
  for (const text of ["not json", "```json\n{}\n```", "null", "[]"]) {
    const base = await start(t, { fetchImpl: async () => completion(text) });
    assert.equal((await post(base)).status, 502);
  }
});

test("unknown flavors including unsupported sour are rejected", async (t) => {
  const base = await start(t, {
    fetchImpl: async () =>
      completion(JSON.stringify({ ...preference, flavors: ["sour"] })),
  });
  const response = await post(base);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "INVALID_AI_RESPONSE");
});

test("model field types, extra recipe fields and unknown difficulties are rejected", async (t) => {
  for (const value of [
    { ...preference, flavors: "bitter" },
    { ...preference, flavors: [3] },
    { ...preference, difficulty: "expert" },
    { ...preference, description: [] },
    { ...preference, recipe: "Invented" },
    { ...preference, amount: 30 },
  ]) {
    const base = await start(t, {
      fetchImpl: async () => completion(JSON.stringify(value)),
    });
    assert.equal((await post(base)).status, 502);
  }
});

test("missing API key is disclosed without issuing any upstream request", async (t) => {
  let calls = 0;
  const base = await start(t, {
    env: { AI_BASE_URL: env.AI_BASE_URL, AI_MODEL: env.AI_MODEL },
    fetchImpl: async () => {
      calls++;
      throw new Error("should not call");
    },
  });
  const status = await (await fetch(base + "/api/ai/status")).json();
  assert.equal(status.configured, false);
  const response = await post(base);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "AI_NOT_CONFIGURED");
  assert.equal(calls, 0);
});

test("upstream error bodies and authentication data never appear in API errors", async (t) => {
  const base = await start(t, {
    fetchImpl: async () =>
      new Response(env.AI_API_KEY + " sensitive upstream info", {
        status: 401,
      }),
  });
  const response = await post(base);
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.ok(!text.includes(env.AI_API_KEY));
  assert.ok(!text.includes("upstream info"));
});

test("provider network exceptions are sanitized", async (t) => {
  const base = await start(t, {
    fetchImpl: async () => {
      throw new Error(env.AI_API_KEY + " private endpoint");
    },
  });
  const response = await post(base);
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes(env.AI_API_KEY));
});

test("AI deadline aborts stalled requests and returns 504", async (t) => {
  let aborted = false;
  const base = await start(t, {
    timeoutMs: 30,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new Error("abort"));
          },
          { once: true },
        ),
      ),
  });
  const response = await post(base);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "AI_TIMEOUT");
  assert.equal(aborted, true);
});

test("truncated generations, tool calls and refusals never become preference results", async (t) => {
  for (const reason of ["length", "tool_calls", "content_filter"]) {
    const base = await start(t, {
      fetchImpl: async () => completion(JSON.stringify(preference), reason),
    });
    assert.equal((await post(base)).status, 502);
  }
  const base = await start(t, {
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify(preference),
                refusal: "refused",
              },
            },
          ],
        }),
      ),
  });
  assert.equal((await post(base)).status, 502);
});

test("request object, text length, extra inventory fields and common personal identifiers are validated", async (t) => {
  const base = await start(t);
  for (const value of [
    [],
    null,
    {},
    { text: 3 },
    { text: "" },
    { text: "x".repeat(601) },
    { text: "hello", inventory: ["gin"] },
    { text: "联系我 name@example.com" },
    { text: "电话 13800138000" },
  ]) {
    assert.equal((await post(base, value)).status, 400);
  }
  const malformed = await fetch(base + "/api/ai/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await post(base, { text: "x".repeat(5000) })).status, 413);
  assert.equal(
    (await post(base, { text: "ok" }, { "Content-Type": "text/plain" })).status,
    415,
  );
});

test("cross-site origins and invalid hosts are blocked with no permissive CORS headers", async (t) => {
  const base = await start(t);
  const response = await post(
    base,
    { text: "fresh" },
    { Origin: "https://untrusted.invalid" },
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  const hostStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(
      base + "/api/ai/status",
      { headers: { Host: "untrusted.invalid" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(hostStatus, 403);
});

test("only a short text and enum instructions are sent; recipe files stay byte-for-byte unchanged", async (t) => {
  const before = await readFile(
    new URL("../data/recipes.json", import.meta.url),
  );
  let observed;
  const base = await start(t, {
    fetchImpl: async (url, init) => {
      observed = { url, init, body: JSON.parse(init.body) };
      return completion();
    },
  });
  assert.equal((await post(base, { text: "喜欢清新微苦" })).status, 200);
  assert.equal(observed.url, env.AI_BASE_URL + "/chat/completions");
  assert.equal(observed.init.headers.Authorization, `Bearer ${env.AI_API_KEY}`);
  assert.equal(observed.init.redirect, "error");
  assert.deepEqual(Object.keys(observed.body).sort(), [
    "messages",
    "model",
    "response_format",
    "stream",
  ]);
  assert.deepEqual(observed.body.messages[1], {
    role: "user",
    content: "喜欢清新微苦",
  });
  assert.equal(observed.body.messages.length, 2);
  const sent = JSON.stringify(observed.body);
  assert.ok(!sent.includes("white-rum"));
  assert.ok(!sent.includes("Mojito"));
  assert.ok(!sent.includes("青柠汁"));
  assert.ok(!sent.includes("recipes.json"));
  assert.deepEqual(
    await readFile(new URL("../data/recipes.json", import.meta.url)),
    before,
  );
});

test("server preferences feed actual compiled MoonBit, whose difficulty sorting and inventory rules stay authoritative", async (t) => {
  const base = await start(t);
  const { preferences } = await (await post(base)).json();
  const recipes = await read("recipes.json");
  const materials = await read("ingredients.json");
  const rank = (stock, pref) =>
    JSON.parse(
      recommend_preferences_json(
        JSON.stringify(recipes),
        JSON.stringify(stock),
        JSON.stringify(pref),
        JSON.stringify(materials),
      ),
    );
  const unset = rank({ status: "unset", owned: [] }, preferences);
  assert.equal(unset.error, "");
  assert.equal(
    recipes.find((item) => item.id === unset.recommendations[0].recipe_id)
      .difficulty,
    "简单",
  );
  assert.ok(unset.recommendations.every((item) => !item.can_make));
  const intermediate = rank(
    { status: "unset", owned: [] },
    { ...preferences, difficulty: "intermediate" },
  );
  assert.equal(
    recipes.find(
      (item) => item.id === intermediate.recommendations[0].recipe_id,
    ).difficulty,
    "进阶",
  );
  assert.notEqual(
    intermediate.recommendations[0].recipe_id,
    unset.recommendations[0].recipe_id,
  );
  const complete = rank(
    { status: "set", owned: ["gin", "tonic", "ice"] },
    { ...preferences, difficulty: "intermediate" },
  );
  assert.equal(complete.recommendations[0].recipe_id, "gin-tonic");
  assert.equal(complete.recommendations[0].can_make, true);
});

test("configuration placeholders, insecure remote URLs and URL-embedded credentials are not treated as configured", () => {
  for (const config of [
    {},
    { ...env, AI_API_KEY: "replace-with-your-key" },
    { ...env, AI_BASE_URL: "http://remote.invalid/v1" },
    { ...env, AI_BASE_URL: "https://user:secret@mock.invalid/v1" },
    { ...env, AI_BASE_URL: "https://mock.invalid/v1?key=secret" },
  ]) {
    assert.equal(readConfig(config).configured, false);
  }
  assert.equal(readConfig(env).configured, true);
  assert.equal(
    readConfig({ ...env, AI_BASE_URL: "http://127.0.0.1:1234/v1" }).configured,
    true,
  );
});

test("preference contract exactly reflects supported recipe flavors and difficulties", async () => {
  const recipes = await read("recipes.json");
  const contract = await read("preferences.json");
  assert.deepEqual(
    [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort(),
    [...allowedFlavors].sort(),
  );
  assert.deepEqual(
    [...new Set(recipes.map((recipe) => recipe.difficulty))].sort(),
    contract.difficulties
      .map((item) => item.recipe_value)
      .filter(Boolean)
      .sort(),
  );
  assert.deepEqual(allowedDifficulties, ["any", "easy", "intermediate"]);
});

test("overlong or malformed upstream envelopes are rejected without relaying raw content", async (t) => {
  for (const response of [
    () => new Response("x".repeat(70_000)),
    () => new Response("{"),
    () => new Response("{}"),
  ]) {
    const base = await start(t, { fetchImpl: async () => response() });
    assert.equal((await post(base)).status, 502);
  }
});

test("two concurrent requests are allowed; extra in-flight requests are bounded", async (t) => {
  const release = [];
  let ready;
  const gate = new Promise((resolve) => {
    ready = resolve;
  });
  const base = await start(t, {
    fetchImpl: async () =>
      new Promise((resolve) => {
        release.push(() => resolve(completion()));
        if (release.length === 2) ready();
      }),
  });
  const first = post(base);
  const second = post(base);
  await gate;
  assert.equal((await post(base)).status, 429);
  release.forEach((callback) => callback());
  assert.ok(
    (await Promise.all([first, second])).every(
      (response) => response.status === 200,
    ),
  );
});

test("status endpoint exposes no key, URL or model secrets", async (t) => {
  const base = await start(t);
  const response = await fetch(base + "/api/ai/status");
  const text = await response.text();
  assert.equal(JSON.parse(text).configured, true);
  assert.ok(
    !text.includes(env.AI_API_KEY) &&
      !text.includes(env.AI_BASE_URL) &&
      !text.includes(env.AI_MODEL),
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});
