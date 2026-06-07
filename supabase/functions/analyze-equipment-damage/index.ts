const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DamageLevel = "normal" | "minor" | "obvious" | "severe";

type DamageResult = {
  status: "正常" | "异常";
  damage_level: DamageLevel;
  risk_label: "低" | "中" | "高";
  confidence: number;
  issue_count: number;
  summary: string;
  issues: string[];
  needs_admin_review: boolean;
  target_matched: boolean;
  comparable: boolean;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`缺少环境变量：${name}`);
  return value;
}

function cleanModelText(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
}

function parseModelJson(text: string) {
  const cleaned = cleanModelText(text);
  const direct = tryParseJson(cleaned);
  if (direct) return direct;
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("MiniMax 未返回 JSON 结果");
  const extracted = tryParseJson(match[0]);
  if (!extracted) throw new Error("MiniMax 返回 JSON 格式错误");
  return extracted;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeLevel(value: unknown): DamageLevel {
  const raw = String(value || "").toLowerCase();
  if (["normal", "正常", "none"].includes(raw)) return "normal";
  if (["minor", "轻微", "轻微损耗"].includes(raw)) return "minor";
  if (["obvious", "明显", "明显损耗", "damaged"].includes(raw)) return "obvious";
  if (["severe", "严重", "严重损坏"].includes(raw)) return "severe";
  return "obvious";
}

function clampConfidence(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.75;
  if (num > 1) return Math.min(1, Math.max(0, num / 100));
  return Math.min(1, Math.max(0, num));
}

function normalizeResult(raw: Record<string, unknown>): DamageResult {
  const damageLevel = normalizeLevel(raw.damage_level);
  const issues = Array.isArray(raw.issues)
    ? raw.issues.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
    : [];
  const confidence = clampConfidence(raw.confidence);
  const targetMatched = raw.target_matched === true;
  const comparable = raw.comparable === true;
  const forcedInvalid = confidence < 0.7 || targetMatched !== true || comparable !== true;
  const invalidReason = !targetMatched
    ? "照片中未清楚显示目标器材，无法完成归还质检对比。"
    : !comparable
      ? "两张照片无法有效对比目标器材，无法完成归还质检。"
      : "检测可信度过低，无法完成归还质检。";
  const abnormal = forcedInvalid || damageLevel !== "normal";
  const issueCount = Number.isFinite(Number(raw.issue_count))
    ? Math.max(0, Math.min(9, Number(raw.issue_count)))
    : issues.length;
  const riskLabel = damageLevel === "severe" || damageLevel === "obvious"
    ? "高"
    : damageLevel === "minor" || forcedInvalid
      ? "中"
      : "低";
  const normalizedIssues = forcedInvalid && !issues.length ? [invalidReason] : issues;

  return {
    status: abnormal ? "异常" : "正常",
    damage_level: forcedInvalid && damageLevel === "normal" ? "obvious" : damageLevel,
    risk_label: riskLabel,
    confidence,
    issue_count: abnormal ? Math.max(1, issueCount || normalizedIssues.length || 1) : 0,
    summary: String(forcedInvalid ? invalidReason : (raw.summary || (abnormal ? "检测到疑似新增损耗，建议管理员复核。" : "未发现明显新增损耗。"))).trim(),
    issues: normalizedIssues,
    needs_admin_review: abnormal || Boolean(raw.needs_admin_review),
    target_matched: targetMatched,
    comparable,
  };
}

function minimaxErrorMessage(status: number, text: string) {
  const lower = text.toLowerCase();
  if (
    status === 402 ||
    lower.includes("insufficient_balance") ||
    lower.includes("insufficient balance") ||
    lower.includes("quota has been exceeded") ||
    lower.includes("quota exceeded")
  ) {
    return "MiniMax 余额不足或密钥配置异常，请检查 Supabase 里的 API Key、接口区域和可用额度。";
  }
  if (status === 401 || status === 403 || lower.includes("invalid api key") || lower.includes("unauthorized")) {
    return "MiniMax API Key 无效，请检查 Supabase 里的密钥配置。";
  }
  return `MiniMax 检测服务请求失败（${status}），请稍后重试。`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "只支持 POST 请求" }, 405);

  try {
    const apiKey = requiredEnv("MINIMAX_API_KEY");
    const baseUrl = Deno.env.get("MINIMAX_BASE_URL") || "https://api.minimaxi.com";
    const model = Deno.env.get("MINIMAX_MODEL") || "MiniMax-M3";
    const body = await req.json();

    const equipmentName = String(body.equipmentName || "").trim();
    const assetId = String(body.assetId || "").trim();
    const beforeImageDataUrl = String(body.beforeImageDataUrl || "").trim();
    const afterImageDataUrl = String(body.afterImageDataUrl || "").trim();

    if (!equipmentName || !assetId) throw new Error("缺少器材信息");
    if (!beforeImageDataUrl.startsWith("data:image/")) throw new Error("请上传借出前照片");
    if (!afterImageDataUrl.startsWith("data:image/")) throw new Error("请上传归还照片");

    const prompt = [
      "你是校园体育器材归还质检助手。",
      "第一张图片是借出前照片，第二张图片是归还后照片。",
      `器材：${equipmentName}，编号：${assetId}。`,
      "先确认两张图片是否都清楚显示同一类目标器材；如果任一图片不是该器材、目标器材不清楚、被遮挡严重、无法和另一张图对比，必须判为异常。",
      "只有两张图片都能确认是目标器材，才继续对比归还后是否出现新增破损、变形、开裂、漏气、明显污损、部件脱落等新增损耗。",
      "不要只识别器材类别后就判正常；正常必须建立在两张目标器材照片可对比且没有新增损耗的基础上。",
      "不要因为拍摄角度、光线、轻微阴影直接判异常。",
      "必须只返回 JSON，不要 Markdown，不要解释。",
      "JSON 字段固定为：",
      "{",
      '  "damage_level": "normal | minor | obvious | severe",',
      '  "confidence": 0.0 到 1.0,',
      '  "target_matched": true 或 false,',
      '  "comparable": true 或 false,',
      '  "issue_count": 数字,',
      '  "summary": "一句中文结论",',
      '  "issues": ["新增损耗点1", "新增损耗点2"],',
      '  "needs_admin_review": true 或 false',
      "}",
    ].join("\n");

    const minimaxResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        thinking: { type: "adaptive" },
        temperature: 0.1,
        max_completion_tokens: 900,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: beforeImageDataUrl } },
              { type: "image_url", image_url: { url: afterImageDataUrl } },
            ],
          },
        ],
      }),
    });

    const minimaxText = await minimaxResponse.text();
    if (!minimaxResponse.ok) {
      throw new Error(minimaxErrorMessage(minimaxResponse.status, minimaxText));
    }

    const minimaxJson = JSON.parse(minimaxText);
    const content = minimaxJson?.choices?.[0]?.message?.content;
    if (!content) throw new Error("MiniMax 未返回检测内容");

    const parsed = parseModelJson(String(content));
    const result = normalizeResult(parsed);

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "检测失败" }, 400);
  }
});
