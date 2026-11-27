import { downloadWorkFile, listWorkJobs } from "./작업결과.js";

const SESSION_COOKIE = "bc_session";
const STATE_COOKIE = "bc_naver_state";
const NEXT_COOKIE = "bc_naver_next";
const KAKAO_STATE_COOKIE = "bc_kakao_state";
const KAKAO_NEXT_COOKIE = "bc_kakao_next";
const SESSION_DAYS = 30;
const STATE_SECONDS = 600;
const PBKDF2_ITERATIONS = 100000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url) {
  const path = url.pathname;
  try {
    if (request.method === "GET" && path === "/api/auth/naver/login") return naverLogin(request, env, url);
    if (request.method === "GET" && path === "/api/auth/naver/callback") return naverCallback(request, env, url);
    if (request.method === "GET" && path === "/api/auth/kakao/login") return kakaoLogin(request, env, url);
    if (request.method === "GET" && path === "/api/auth/kakao/callback") return kakaoCallback(request, env, url);
    if ((request.method === "GET" || request.method === "POST") && path === "/api/auth/logout") return logout(request, env);
    if (!env.DB) return json({ error: "계정 저장소가 연결되지 않았습니다." }, 503);
    if (request.method === "POST" && path === "/api/signup") return signup(request, env);
    if (request.method === "POST" && path === "/api/login") return login(request, env);
    if (request.method === "POST" && path === "/api/logout") return logout(request, env);
    if (request.method === "GET" && path === "/api/me") return me(request, env);
    if (request.method === "GET" && path === "/api/work/jobs") {
      try {
        return await listWorkJobs(request, env, userFromRequest, json);
      } catch (error) {
        return json({ error: "결과를 가져오지 못했습니다." }, 502);
      }
    }
    const workFile = path.match(/^\/api\/work\/jobs\/([^/]+)\/(model|quantity|cnc)$/);
    if (request.method === "GET" && workFile) {
      try {
        return await downloadWorkFile(request, env, userFromRequest, decodeURIComponent(workFile[1]), workFile[2]);
      } catch (error) {
        return json({ error: "결과를 가져오지 못했습니다." }, 502);
      }
    }
    if (request.method === "GET" && path === "/api/access") return access(request, env, url);
    if (path.startsWith("/api/interest/")) return interest(request, env, url);
    if (path.startsWith("/api/admin/")) return admin(request, env, url);
    return json({ error: "없는 주소입니다." }, 404);
  } catch (error) {
    return json({ error: "계정 처리를 마치지 못했습니다." }, 500);
  }
}

async function signup(request, env) {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  const name = String(body.name || "").trim().slice(0, 40);
  const password = String(body.password || "");
  if (!validEmail(email)) return json({ error: "이메일 형식을 확인해 주세요." }, 400);
  if (password.length < 8) return json({ error: "비밀번호는 8자 이상으로 정해 주세요." }, 400);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "이미 가입된 이메일입니다." }, 409);
  const passwordRecord = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, email, name, passwordRecord.hash, passwordRecord.salt, now).run();
  await writeLog(env, id, email, "signup");
  return startSession(env, request, { id, email, name, created_at: now });
}

async function login(request, env) {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (await tooManyFailures(env, email)) {
    return json({ error: "로그인이 여러 번 맞지 않았습니다. 잠시 뒤에 다시 시도해 주세요." }, 429);
  }
  const user = await env.DB.prepare(
    "SELECT id, email, name, password_hash, password_salt, created_at FROM users WHERE email = ?"
  ).bind(email).first();
  const matches = user ? await passwordMatches(password, user.password_salt, user.password_hash) : false;
  if (!user || !matches) {
    await writeLog(env, user ? user.id : null, email, "login_failed");
    return json({ error: "이메일 또는 비밀번호가 맞지 않습니다." }, 401);
  }
  await writeLog(env, user.id, email, "login");
  return startSession(env, request, user);
}

async function logout(request, env) {
  const token = await sessionToken(request, env);
  if (token && env.DB) {
    const tokenHash = await sha256(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  const cookies = [clearCookie()];
  if (request.method === "GET") return redirect("/", cookies);
  return json({ ok: true }, 200, cookies);
}

async function naverLogin(request, env, url) {
  if (!naverConfigured(env)) return redirect("/계정/로그인.html?naver=config");
  const state = hex(crypto.getRandomValues(new Uint8Array(16)));
  const next = safeNext(url.searchParams.get("next"));
  const redirectUri = callbackUrl(url);
  const auth = new URL("https://nid.naver.com/oauth2.0/authorize");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", env.NAVER_CLIENT_ID);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("state", state);
  return redirect(auth.toString(), [stateCookie(state), nextCookie(next)]);
}

async function naverCallback(request, env, url) {
  const done = (reason) => redirect(`/계정/로그인.html?naver=${reason}`, [clearNamedCookie(STATE_COOKIE), clearNamedCookie(NEXT_COOKIE)]);
  if (!naverConfigured(env)) return done("config");
  if (!env.DB) return done("config");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const saved = readCookie(request, STATE_COOKIE);
  if (!code || !state || !saved || saved.length !== state.length || !safeEqual(saved, state)) return done("state");
  try {
    const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
    tokenUrl.searchParams.set("grant_type", "authorization_code");
    tokenUrl.searchParams.set("client_id", env.NAVER_CLIENT_ID);
    tokenUrl.searchParams.set("client_secret", env.NAVER_CLIENT_SECRET);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("state", state);
    const tokenResponse = await fetch(tokenUrl);
    const token = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !token || !token.access_token || token.error) return done("token");
    const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const profile = await profileResponse.json().catch(() => null);
    const info = profile && profile.response;
    if (!profileResponse.ok || !info || profile.resultcode !== "00") return done("profile");
    const email = normalizeEmail(info.email);
    const name = String(info.name || info.nickname || "").trim().slice(0, 40);
    const providerId = String(info.id || "");
    if (!validEmail(email) || !providerId) return done("email");
    const user = await upsertNaverUser(env, email, name, providerId);
    if (!user) return done("email");
    await writeLog(env, user.id, email, "naver_login");
    const cookie = await createSessionCookie(env, user);
    const next = safeNext(readCookie(request, NEXT_COOKIE) || "/");
    return redirect(next, [cookie, clearNamedCookie(STATE_COOKIE), clearNamedCookie(NEXT_COOKIE)]);
  } catch (error) {
    return done("profile");
  }
}

function naverConfigured(env) {
  return Boolean(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET && env.SESSION_SECRET);
}

function callbackUrl(url) {
  return new URL("/api/auth/naver/callback", url.origin).toString();
}

async function ensureNaverColumns(env) {
  const statements = [
    "ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'password'",
    "ALTER TABLE users ADD COLUMN provider_id TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS users_provider_identity ON users(provider, provider_id)"
  ];
  for (const statement of statements) {
    try {
      await env.DB.prepare(statement).bind().run();
    } catch (error) {
      const message = String(error && error.message || error);
      if (!/duplicate column|already exists/i.test(message)) throw error;
    }
  }
}

async function upsertNaverUser(env, email, name, providerId) {
  await ensureNaverColumns(env);
  const byProvider = await env.DB.prepare(
    "SELECT id, email, name, created_at, provider_id FROM users WHERE provider = 'naver' AND provider_id = ?"
  ).bind(providerId).first();
  if (byProvider) return byProvider;
  const byEmail = await env.DB.prepare(
    "SELECT id, email, name, created_at, provider_id FROM users WHERE email = ?"
  ).bind(email).first();
  if (byEmail) {
    if (byEmail.provider_id && byEmail.provider_id !== providerId) return null;
    const nextName = byEmail.name || name;
    await env.DB.prepare(
      "UPDATE users SET provider = 'naver', provider_id = ?, name = ? WHERE id = ?"
    ).bind(providerId, nextName, byEmail.id).run();
    return { id: byEmail.id, email, name: nextName, created_at: byEmail.created_at };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordRecord = await hashPassword(hex(crypto.getRandomValues(new Uint8Array(32))));
  try {
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, password_salt, created_at, provider, provider_id) VALUES (?, ?, ?, ?, ?, ?, 'naver', ?)"
    ).bind(id, email, name, passwordRecord.hash, passwordRecord.salt, now, providerId).run();
  } catch (error) {
    const existing = await env.DB.prepare(
      "SELECT id, email, name, created_at, provider_id FROM users WHERE email = ?"
    ).bind(email).first();
    if (!existing || (existing.provider_id && existing.provider_id !== providerId)) return null;
    return existing;
  }
  return { id, email, name, created_at: now };
}

async function kakaoLogin(request, env, url) {
  if (!kakaoConfigured(env)) return redirect("/계정/로그인.html?kakao=config");
  const state = hex(crypto.getRandomValues(new Uint8Array(16)));
  const next = safeNext(url.searchParams.get("next"));
  const auth = new URL("https://kauth.kakao.com/oauth/authorize");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", env.KAKAO_REST_API_KEY);
  auth.searchParams.set("redirect_uri", env.KAKAO_REDIRECT_URI);
  auth.searchParams.set("scope", "profile_nickname,profile_image");
  auth.searchParams.set("state", state);
  return redirect(auth.toString(), [namedCookie(KAKAO_STATE_COOKIE, state), namedCookie(KAKAO_NEXT_COOKIE, encodeURIComponent(next))]);
}

async function kakaoCallback(request, env, url) {
  const done = (reason) => redirect(`/계정/로그인.html?kakao=${reason}`, [clearNamedCookie(KAKAO_STATE_COOKIE), clearNamedCookie(KAKAO_NEXT_COOKIE)]);
  if (!kakaoConfigured(env)) return done("config");
  if (!env.DB) return done("config");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const saved = readCookie(request, KAKAO_STATE_COOKIE);
  if (!code || !state || !saved || saved.length !== state.length || !safeEqual(saved, state)) return done("state");
  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.KAKAO_REST_API_KEY,
      redirect_uri: env.KAKAO_REDIRECT_URI,
      code,
      client_secret: env.KAKAO_CLIENT_SECRET
    });
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: tokenBody
    });
    const token = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !token || !token.access_token || token.error) return done("token");
    const profileResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const profile = await profileResponse.json().catch(() => null);
    if (!profileResponse.ok || !profile || !profile.id) return done("profile");
    const account = profile.kakao_account || {};
    const profileInfo = account.profile || {};
    const properties = profile.properties || {};
    const nickname = String(profileInfo.nickname || properties.nickname || "").trim().slice(0, 40);
    const photoUrl = String(profileInfo.profile_image_url || profileInfo.thumbnail_image_url || properties.profile_image || "").trim().slice(0, 500);
    const photo = photoUrl.startsWith("https://") ? photoUrl : "";
    if (!nickname) return done("nickname");
    const user = await upsertKakaoUser(env, String(profile.id), nickname, photo);
    if (!user) return done("profile");
    await writeLog(env, user.id, user.email, "kakao_login");
    const cookie = await createSessionCookie(env, user);
    const next = safeNext(readCookie(request, KAKAO_NEXT_COOKIE) || "/");
    return redirect(next, [cookie, clearNamedCookie(KAKAO_STATE_COOKIE), clearNamedCookie(KAKAO_NEXT_COOKIE)]);
  } catch (error) {
    return done("profile");
  }
}

function kakaoConfigured(env) {
  return Boolean(env.KAKAO_REST_API_KEY && env.KAKAO_CLIENT_SECRET && env.KAKAO_REDIRECT_URI && env.SESSION_SECRET)
    && kakaoRedirectUri(env.KAKAO_REDIRECT_URI);
}

function kakaoRedirectUri(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname === "/api/auth/kakao/callback";
  } catch (error) {
    return false;
  }
}

async function ensureKakaoColumns(env) {
  await ensureNaverColumns(env);
  try {
    await env.DB.prepare("ALTER TABLE users ADD COLUMN photo_url TEXT").bind().run();
  } catch (error) {
    const message = String(error && error.message || error);
    if (!/duplicate column|already exists/i.test(message)) throw error;
  }
}

async function upsertKakaoUser(env, providerId, nickname, photo) {
  await ensureKakaoColumns(env);
  const email = `kakao.${providerId}@members.spacecode.app`;
  const existing = await env.DB.prepare(
    "SELECT id, email, name, created_at, provider_id FROM users WHERE provider = 'kakao' AND provider_id = ?"
  ).bind(providerId).first();
  if (existing) {
    await env.DB.prepare(
      "UPDATE users SET name = ?, photo_url = ? WHERE id = ?"
    ).bind(nickname, photo || null, existing.id).run();
    return { id: existing.id, email: existing.email, name: nickname, created_at: existing.created_at };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordRecord = await hashPassword(hex(crypto.getRandomValues(new Uint8Array(32))));
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, password_salt, created_at, provider, provider_id, photo_url) VALUES (?, ?, ?, ?, ?, ?, 'kakao', ?, ?)"
  ).bind(id, email, nickname, passwordRecord.hash, passwordRecord.salt, now, providerId, photo || null).run();
  return { id, email, name: nickname, created_at: now };
}

async function me(request, env) {
  const user = await userFromRequest(request, env);
  if (!user) return json({ user: null }, 401);
  const entitlements = await listEntitlements(env, user.id);
  const email = String(user.email || "");
  const visibleEmail = /@members\.spacecode\.app$/i.test(email) ? "" : email;
  return json({
    user: { email: visibleEmail, name: user.name, createdAt: user.created_at },
    entitlements
  });
}

async function access(request, env, url) {
  const user = await userFromRequest(request, env);
  const product = String(url.searchParams.get("product") || "").trim();
  if (!user || !product) return json({ allowed: false });
  const row = await env.DB.prepare(
    "SELECT status, until FROM entitlements WHERE user_id = ? AND product = ?"
  ).bind(user.id, product).first();
  return json({ allowed: entitlementAllowed(row), product });
}

async function interest(request, env, url) {
  await ensureInterestTables(env);
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/interest/items") return interestItems(env);
  if (request.method === "POST" && path === "/api/interest/visit") return interestVisit(request, env);
  if (request.method === "POST" && path === "/api/interest/heart") return interestHeart(request, env);
  if (request.method === "POST" && path === "/api/interest/alert") return interestAlert(request, env);
  return json({ error: "없는 주소입니다." }, 404);
}

async function ensureInterestTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS interest_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      image_path TEXT NOT NULL DEFAULT '',
      badge TEXT NOT NULL DEFAULT '출시 예정',
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS interest_hearts (
      item_id TEXT NOT NULL,
      visitor_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (item_id, visitor_key)
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS interest_alerts (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      email TEXT NOT NULL,
      consent_at TEXT NOT NULL,
      utm_source TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE (item_id, email)
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS interest_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      visitor_key TEXT NOT NULL DEFAULT '',
      utm_source TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`
  ).run();
  const seeds = [
    [
      "curved-formwork",
      "직선 거푸집 자동 설계(정형 곡선 가능)",
      "직선 거푸집의 도면과 제작에 필요한 정보를 자동으로 맞춥니다.",
      "images/curved-formwork.png",
      "출시 예정",
      1
    ],
    [
      "takeoff-automation",
      "적산 프로그램 자동화",
      "수량 산출과 견적 작업을 빠르고 정확하게 맞춥니다.",
      "images/takeoff-automation.jpg",
      "출시 예정",
      2
    ],
    [
      "crane-blind-spot-sensor",
      "소형크레인 사각지대 센서",
      "소형크레인 주변 사각지대 위험을 감지해 알립니다.",
      "images/crane-blind-spot-sensor.png",
      "출시 예정",
      3
    ],
    [
      "site-feedback-automation",
      "공사 현장 의견 수렴 자동화",
      "현장 의견을 모아 정리하고 전달까지 이어집니다.",
      "images/site-feedback-automation.jpg",
      "출시 예정",
      4
    ],
    [
      "drawing-legal-review",
      "도면 법적 검토 자동화",
      "도면이 통일되지 않아 생기는 문제를 법적 검토에서 잡습니다.",
      "images/drawing-legal-review.png",
      "진행중",
      5
    ],
    [
      "fire-alarm-helper",
      "화재 경보 알림 도움기",
      "화재 경보를 필요한 사람에게 빠르게 알리고 대응 흐름을 모읍니다.",
      "images/fire-alarm-helper.jpg",
      "출시 완료",
      6
    ]
  ];
  const createdAt = new Date().toISOString();
  for (const seed of seeds) {
    const existing = await env.DB.prepare("SELECT id FROM interest_items WHERE id = ?")
      .bind(seed[0])
      .first();
    if (existing) continue;
    await env.DB.prepare(
      `INSERT INTO interest_items (id, name, summary, image_path, badge, sort, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(seed[0], seed[1], seed[2], seed[3], seed[4], seed[5], createdAt).run();
  }
  await env.DB.prepare("UPDATE interest_items SET name = ? WHERE id = ?")
    .bind("직선 거푸집 자동 설계(정형 곡선 가능)", "curved-formwork")
    .run();
  await env.DB.prepare("UPDATE interest_items SET name = ?, summary = ?, image_path = ?, badge = ?, sort = ? WHERE id = ?")
    .bind(
      "화재 경보 알림 도움기",
      "화재 경보를 필요한 사람에게 빠르게 알리고 대응 흐름을 모읍니다.",
      "images/fire-alarm-helper.jpg",
      "출시 완료",
      6,
      "fire-alarm-helper"
    )
    .run();
}

async function interestItems(env) {
  const items = await env.DB.prepare(
    "SELECT id, name, summary, image_path, badge, sort FROM interest_items ORDER BY sort ASC, created_at ASC"
  ).all();
  const hearts = await env.DB.prepare(
    "SELECT item_id, COUNT(*) AS count FROM interest_hearts GROUP BY item_id"
  ).all();
  const counts = new Map();
  for (const row of hearts.results || []) counts.set(row.item_id, Number(row.count) || 0);
  return json({
    items: (items.results || []).map((item) => ({
      id: item.id,
      name: item.name,
      summary: item.summary,
      imagePath: item.image_path,
      badge: item.badge,
      hearts: counts.get(item.id) || 0
    }))
  });
}

async function interestVisit(request, env) {
  const body = await readBody(request);
  const itemId = String(body.itemId || "").trim().slice(0, 80);
  const visitorKey = String(body.visitorKey || "").trim().slice(0, 120);
  const utmSource = String(body.utmSource || "").trim().slice(0, 80);
  if (!itemId) return json({ error: "아이템이 필요합니다." }, 400);
  await env.DB.prepare(
    "INSERT INTO interest_visits (item_id, visitor_key, utm_source, created_at) VALUES (?, ?, ?, ?)"
  ).bind(itemId, visitorKey, utmSource, new Date().toISOString()).run();
  return json({ ok: true });
}

async function interestHeart(request, env) {
  const body = await readBody(request);
  const itemId = String(body.itemId || "").trim().slice(0, 80);
  const visitorKey = String(body.visitorKey || "").trim().slice(0, 120);
  if (!itemId || !visitorKey) return json({ error: "아이템과 방문 키가 필요합니다." }, 400);
  const item = await env.DB.prepare("SELECT id FROM interest_items WHERE id = ?").bind(itemId).first();
  if (!item) return json({ error: "없는 아이템입니다." }, 404);
  const existing = await env.DB.prepare(
    "SELECT item_id FROM interest_hearts WHERE item_id = ? AND visitor_key = ?"
  ).bind(itemId, visitorKey).first();
  if (!existing) {
    await env.DB.prepare(
      "INSERT INTO interest_hearts (item_id, visitor_key, created_at) VALUES (?, ?, ?)"
    ).bind(itemId, visitorKey, new Date().toISOString()).run();
  }
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM interest_hearts WHERE item_id = ?"
  ).bind(itemId).first();
  return json({ ok: true, hearts: Number(count && count.count) || 0, already: Boolean(existing) });
}

async function interestAlert(request, env) {
  const body = await readBody(request);
  const itemId = String(body.itemId || "").trim().slice(0, 80);
  const email = normalizeEmail(body.email);
  const utmSource = String(body.utmSource || "").trim().slice(0, 80);
  if (!itemId) return json({ error: "아이템이 필요합니다." }, 400);
  if (!validEmail(email)) return json({ error: "이메일 형식을 확인해 주세요." }, 400);
  if (!body.consent) return json({ error: "개인정보 수집·이용에 동의해 주세요." }, 400);
  const item = await env.DB.prepare("SELECT id FROM interest_items WHERE id = ?").bind(itemId).first();
  if (!item) return json({ error: "없는 아이템입니다." }, 404);
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT id FROM interest_alerts WHERE item_id = ? AND email = ?"
  ).bind(itemId, email).first();
  if (existing) return json({ ok: true, already: true });
  await env.DB.prepare(
    `INSERT INTO interest_alerts (id, item_id, email, consent_at, utm_source, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), itemId, email, now, utmSource, now).run();
  return json({ ok: true });
}

async function adminInterest(env) {
  const items = await env.DB.prepare(
    "SELECT id, name FROM interest_items ORDER BY sort ASC, created_at ASC"
  ).all();
  const hearts = await env.DB.prepare(
    "SELECT item_id, COUNT(*) AS count FROM interest_hearts GROUP BY item_id"
  ).all();
  const alerts = await env.DB.prepare(
    "SELECT item_id, COUNT(*) AS count FROM interest_alerts GROUP BY item_id"
  ).all();
  const visits = await env.DB.prepare(
    "SELECT item_id, COUNT(*) AS count FROM interest_visits GROUP BY item_id"
  ).all();
  const sources = await env.DB.prepare(
    `SELECT CASE WHEN utm_source = '' THEN '(없음)' ELSE utm_source END AS source,
            COUNT(*) AS count
     FROM interest_visits
     GROUP BY source
     ORDER BY count DESC`
  ).all();
  const heartMap = new Map();
  const alertMap = new Map();
  const visitMap = new Map();
  for (const row of hearts.results || []) heartMap.set(row.item_id, Number(row.count) || 0);
  for (const row of alerts.results || []) alertMap.set(row.item_id, Number(row.count) || 0);
  for (const row of visits.results || []) visitMap.set(row.item_id, Number(row.count) || 0);
  const sourceRows = sources.results || [];
  const sourceTotal = sourceRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0) || 1;
  return json({
    items: (items.results || []).map((item) => ({
      id: item.id,
      name: item.name,
      visits: visitMap.get(item.id) || 0,
      hearts: heartMap.get(item.id) || 0,
      alerts: alertMap.get(item.id) || 0
    })),
    pageVisits: visitMap.get("products") || 0,
    sources: sourceRows.map((row) => ({
      source: row.source,
      count: Number(row.count) || 0,
      ratio: Math.round(((Number(row.count) || 0) / sourceTotal) * 1000) / 10
    }))
  });
}

async function admin(request, env, url) {
  if (!env.ADMIN_TOKEN) return json({ error: "관리 키가 설정되지 않았습니다." }, 503);
  const header = request.headers.get("Authorization") || "";
  if (header !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: "관리 권한이 없습니다." }, 401);
  if (request.method === "GET" && url.pathname === "/api/admin/users") return adminUsers(env);
  if (request.method === "POST" && url.pathname === "/api/admin/entitlements") return grant(request, env);
  if (request.method === "GET" && url.pathname === "/api/admin/interest") {
    await ensureInterestTables(env);
    return adminInterest(env);
  }
  return json({ error: "없는 주소입니다." }, 404);
}

async function adminUsers(env) {
  const users = await env.DB.prepare(
    "SELECT id, email, name, created_at FROM users ORDER BY created_at DESC LIMIT 200"
  ).all();
  const rights = await env.DB.prepare(
    "SELECT user_id, product, status, until FROM entitlements"
  ).all();
  const byUser = new Map();
  for (const row of rights.results || []) {
    const list = byUser.get(row.user_id) || [];
    list.push({ product: row.product, status: row.status, until: row.until, allowed: entitlementAllowed(row) });
    byUser.set(row.user_id, list);
  }
  return json({
    users: (users.results || []).map((user) => ({
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
      entitlements: byUser.get(user.id) || []
    }))
  });
}

async function grant(request, env) {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  const product = String(body.product || "").trim();
  const status = body.status === "inactive" ? "inactive" : "active";
  const until = body.until ? String(body.until) : null;
  if (!validEmail(email) || !product) return json({ error: "이메일과 제품 코드가 필요합니다." }, 400);
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (!user) return json({ error: "가입된 이메일이 없습니다." }, 404);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO entitlements (user_id, product, status, until, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, product) DO UPDATE SET status = excluded.status, until = excluded.until, updated_at = excluded.updated_at`
  ).bind(user.id, product, status, until, now).run();
  await writeLog(env, user.id, email, `entitlement:${product}:${status}`);
  return json({ ok: true, email, product, status, until });
}

async function startSession(env, request, user) {
  const cookie = await createSessionCookie(env, user, false);
  const entitlements = await listEntitlements(env, user.id);
  return json({
    user: { email: user.email, name: user.name, createdAt: user.created_at },
    entitlements
  }, 200, cookie);
}

async function createSessionCookie(env, user, signed = true) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), user.id, tokenHash, now.toISOString(), expires.toISOString()).run();
  const value = signed ? `${token}.${await hmacSign(env.SESSION_SECRET, token)}` : token;
  return sessionCookie(value);
}

async function userFromRequest(request, env) {
  const token = await sessionToken(request, env);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  return env.DB.prepare(
    `SELECT users.id, users.email, users.name, users.created_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
  ).bind(tokenHash, now).first();
}

async function sessionToken(request, env) {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return "";
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return /^[0-9a-f]{64}$/.test(raw) ? raw : "";
  if (!env.SESSION_SECRET) return "";
  const token = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!/^[0-9a-f]{64}$/.test(token)) return "";
  const expected = await hmacSign(env.SESSION_SECRET, token);
  if (expected.length !== signature.length || !safeEqual(expected, signature)) return "";
  return token;
}

async function hmacSign(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

async function listEntitlements(env, userId) {
  const rows = await env.DB.prepare(
    "SELECT product, status, until FROM entitlements WHERE user_id = ? ORDER BY product"
  ).bind(userId).all();
  return (rows.results || []).map((row) => ({
    product: row.product,
    status: row.status,
    until: row.until,
    allowed: entitlementAllowed(row)
  }));
}

function entitlementAllowed(row) {
  if (!row || row.status !== "active") return false;
  if (!row.until) return true;
  return new Date(row.until).getTime() > Date.now();
}

async function tooManyFailures(env, email) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM auth_log WHERE email = ? AND event = 'login_failed' AND at > ?"
  ).bind(email, since).first();
  return row && row.count >= 8;
}

async function writeLog(env, userId, email, event) {
  await env.DB.prepare(
    "INSERT INTO auth_log (user_id, email, event, at) VALUES (?, ?, ?, ?)"
  ).bind(userId, email || "", event, new Date().toISOString()).run();
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return { salt: hex(salt), hash: hex(new Uint8Array(bits)) };
}

async function passwordMatches(password, saltHex, expectedHash) {
  const next = await hashPassword(password, saltHex);
  return safeEqual(next.hash, expectedHash);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function hex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromHex(value) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readBody(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const parts = header.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

function clearCookie() {
  return clearNamedCookie(SESSION_COOKIE);
}

function stateCookie(state) {
  return namedCookie(STATE_COOKIE, state);
}

function namedCookie(name, value) {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${STATE_SECONDS}`;
}

function nextCookie(next) {
  return `${NEXT_COOKIE}=${encodeURIComponent(next)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${STATE_SECONDS}`;
}

function clearNamedCookie(name) {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function safeNext(value) {
  const next = String(value || "");
  if (!next || next.length > 200) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("://")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}

function redirect(location, cookies) {
  const headers = new Headers({ Location: headerLocation(location), "Cache-Control": "no-store" });
  for (const cookie of cookies || []) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function headerLocation(location) {
  if (/^https?:\/\//i.test(location)) return location;
  const url = new URL(location, "https://spacecode.app");
  return `${url.pathname}${url.search}`;
}

function json(body, status = 200, cookies) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  const response = new Response(JSON.stringify(body), { status, headers });
  const list = cookies ? (Array.isArray(cookies) ? cookies : [cookies]) : [];
  for (const cookie of list) response.headers.append("Set-Cookie", cookie);
  return response;
}
