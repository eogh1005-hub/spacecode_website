// DynamoDB 온디맨드 테이블(userId, jobId)에 끝난 작업만 둔다.
// 파일 바이트는 비공개 버킷의 users/{사용자}/ 키로만 읽고, 주소를 응답에 넣지 않는다.
const OUTPUTS = {
  model: { field: "modelKey", nameField: "modelName", fallback: "결과.3dm" },
  quantity: { field: "quantityKey", nameField: "quantityName", fallback: "생산개수표.csv" },
  cnc: { field: "cncKey", nameField: "cncName", fallback: "cnc.nc" }
};

export async function listWorkJobs(request, env, userFromRequest, json) {
  const user = await userFromRequest(request, env);
  if (!user) return json({ error: "로그인이 필요합니다." }, 401);
  const ready = workConfig(env);
  if (!ready) return json({ error: "작업 결과 저장소가 연결되지 않았습니다." }, 503);
  const items = await queryJobs(env, ready, user.id);
  return json({
    jobs: items.map((item) => ({
      id: item.jobId,
      product: item.product || "",
      status: item.status || "",
      updatedAt: item.updatedAt || "",
      name: item.modelName || item.jobId,
      outputs: Object.fromEntries(Object.keys(OUTPUTS).map((kind) => {
        const output = OUTPUTS[kind];
        const key = ownedKey(user.id, item[output.field]);
        return [kind, { ready: Boolean(key) && isDone(item.status), name: item[output.nameField] || output.fallback }];
      }))
    }))
  });
}

export async function downloadWorkFile(request, env, userFromRequest, jobId, kind) {
  const output = OUTPUTS[kind];
  if (!output || !/^[A-Za-z0-9_-]{1,80}$/.test(jobId)) return text("파일을 찾지 못했습니다.", 404);
  const user = await userFromRequest(request, env);
  if (!user) return text("로그인이 필요합니다.", 401);
  const ready = workConfig(env);
  if (!ready) return text("작업 결과 저장소가 연결되지 않았습니다.", 503);
  const item = await getJob(env, ready, user.id, jobId);
  if (!item || item.userId !== user.id || !isDone(item.status)) return text("파일을 찾지 못했습니다.", 404);
  const key = ownedKey(user.id, item[output.field]);
  if (!key) return text("파일을 찾지 못했습니다.", 404);
  const file = await readPrivateObject(env, ready, key);
  if (!file) return text("파일을 찾지 못했습니다.", 404);
  const name = item[output.nameField] || output.fallback;
  return new Response(file.body, {
    status: 200,
    headers: {
      "Content-Type": fileType(name),
      "Content-Disposition": attachmentName(name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function workConfig(env) {
  const accessKey = String(env.AWS_ACCESS_KEY_ID || "");
  const secretKey = String(env.AWS_SECRET_ACCESS_KEY || "");
  const region = String(env.AWS_REGION || "ap-northeast-2");
  const table = String(env.WORK_JOBS_TABLE || "");
  const bucket = String(env.WORK_FILES_BUCKET || "");
  if (!accessKey || !secretKey || !table || !bucket) return null;
  if (!/^[a-z0-9-]+$/i.test(region) || !/^[A-Za-z0-9_.-]+$/.test(table) || !/^[a-z0-9.-]+$/.test(bucket)) return null;
  return { accessKey, secretKey, region, table, bucket };
}

function isDone(status) {
  return String(status || "").toLowerCase() === "done";
}

function ownedKey(userId, key) {
  const value = String(key || "");
  if (!value || value.includes("..") || value.includes("\\") || value.includes("://") || value.startsWith("/")) return "";
  if (!value.startsWith(`users/${userId}/`)) return "";
  return value;
}

async function queryJobs(env, config, userId) {
  const body = JSON.stringify({
    TableName: config.table,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": { S: userId } },
    ScanIndexForward: false,
    Limit: 20
  });
  const payload = await dynamo(env, config, "Query", body);
  return (payload.Items || []).map(readItem);
}

async function getJob(env, config, userId, jobId) {
  const body = JSON.stringify({
    TableName: config.table,
    Key: { userId: { S: userId }, jobId: { S: jobId } }
  });
  const payload = await dynamo(env, config, "GetItem", body);
  return payload.Item ? readItem(payload.Item) : null;
}

function readItem(item) {
  const value = (name) => (item[name] && item[name].S) || nested(item, name);
  return {
    userId: value("userId"),
    jobId: value("jobId"),
    status: value("status"),
    product: value("product"),
    updatedAt: value("updatedAt"),
    modelKey: value("modelKey"),
    modelName: value("modelName"),
    quantityKey: value("quantityKey"),
    quantityName: value("quantityName"),
    cncKey: value("cncKey"),
    cncName: value("cncName")
  };
}

function nested(item, name) {
  const kind = name.replace(/Key$|Name$/, "");
  const field = name.endsWith("Name") ? "name" : "key";
  const map = item.outputs && item.outputs.M && item.outputs.M[kind] && item.outputs.M[kind].M;
  return (map && map[field] && map[field].S) || "";
}

async function dynamo(env, config, action, body) {
  const response = await signedFetch(config, {
    method: "POST",
    service: "dynamodb",
    host: `dynamodb.${config.region}.amazonaws.com`,
    path: "/",
    headers: {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": `DynamoDB_20120810.${action}`
    },
    body
  });
  if (!response.ok) throw new Error("dynamo");
  return response.json();
}

async function readPrivateObject(env, config, key) {
  const encoded = key.split("/").map(awsEncode).join("/");
  const response = await signedFetch(config, {
    method: "GET",
    service: "s3",
    host: `${config.bucket}.s3.${config.region}.amazonaws.com`,
    path: `/${encoded}`,
    headers: {},
    body: ""
  });
  if (!response.ok) return null;
  return { body: response.body };
}

async function signedFetch(config, request) {
  const now = new Date();
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amz.slice(0, 8);
  const payload = await sha256Hex(request.body);
  const headers = Object.assign({
    host: request.host,
    "x-amz-date": amz,
    "x-amz-content-sha256": payload
  }, request.headers);
  const names = Object.keys(headers).map((name) => name.toLowerCase()).sort();
  const canonicalHeaders = names.map((name) => `${name}:${String(headers[name]).trim()}\n`).join("");
  const signed = names.join(";");
  const canonical = [
    request.method,
    request.path,
    "",
    canonicalHeaders,
    signed,
    payload
  ].join("\n");
  const scope = `${day}/${config.region}/${request.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, await sha256Hex(canonical)].join("\n");
  const key = await signingKey(config.secretKey, day, config.region, request.service);
  const signature = hex(await hmacRaw(key, toSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
  return fetch(`https://${request.host}${request.path}`, {
    method: request.method,
    headers: Object.assign({}, headers, { Authorization: authorization }),
    body: request.method === "GET" ? undefined : request.body
  });
}

async function signingKey(secret, day, region, service) {
  let key = await hmacRaw(new TextEncoder().encode(`AWS4${secret}`), day);
  key = await hmacRaw(key, region);
  key = await hmacRaw(key, service);
  return hmacRaw(key, "aws4_request");
}

async function hmacRaw(key, value) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data));
}

async function sha256Hex(value) {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}

function hex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function awsEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function fileType(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function attachmentName(name) {
  const clean = String(name || "download").replace(/[\r\n"]/g, "");
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

function text(message, status) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" }
  });
}
