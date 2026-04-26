// ╔══════════════════════════════════════════════════════════╗
// ║          CyberShield AI — Backend Server                 ║
// ║          Node.js + Express + Claude API                  ║
// ╚══════════════════════════════════════════════════════════╝

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// ══ CONFIG ══
// ⚠️ ضع مفتاح API هنا — أو استخدم متغيرات البيئة (أفضل)
const CLAUDE_API_KEY = "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";
const PORT = process.env.PORT || 3000;
const CLAUDE_MODEL = "claude-3-haiku-20240307"; // أسرع وأرخص

// ══ MIDDLEWARE ══
app.use(cors({
  origin: "*", // في الإنتاج: ضع رابط موقعك هنا مثل "https://yoursite.com"
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "50kb" }));

// ══ STATIC — يخدم index.html ══
app.use(express.static(join(__dirname, "public")));

// ══ RATE LIMITING بسيط (حماية من الإفراط) ══
const requestCounts = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const windowMs = 60_000; // دقيقة واحدة
  const maxReqs = 10;      // 10 طلبات/دقيقة لكل IP

  const entry = requestCounts.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    requestCounts.set(ip, { count: 1, start: now });
  } else {
    entry.count++;
    if (entry.count > maxReqs) {
      return res.status(429).json({
        error: "⚠️ تجاوزت الحد المسموح. انتظر دقيقة ثم حاول مجدداً."
      });
    }
    requestCounts.set(ip, entry);
  }
  next();
}

// ══ SYSTEM PROMPT ══
const SYSTEM_PROMPT = `أنت محلل أمن سيبراني خبير مستوى عالمي. تقدم تحليلاً احترافياً دقيقاً ومنظماً باللغة العربية.
تميّز بين مستويات الخطورة وتوضح الأدلة التقنية بوضوح.
استخدم ⚠️ للخطرات الحرجة، ✅ للنقاط الآمنة، 🔴 للتحذيرات العاجلة.`;

// ══ /analyze ══
app.post("/analyze", rateLimit, async (req, res) => {
  const { input, threat } = req.body;

  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "❌ لا توجد بيانات للتحليل" });
  }

  if (input.length > 3000) {
    return res.status(400).json({ error: "❌ النص طويل جداً (الحد 3000 حرف)" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `حلّل هذا التهديد من نوع "${threat || 'غير محدد'}":

${input}

قدم التحليل في هذه النقاط بالترتيب:
1. تعريف التهديد: تعريف دقيق
2. مؤشرات الخطورة: الأدلة التقنية الموجودة في البيانات
3. آلية العمل: كيف يعمل خطوة بخطوة
4. الأضرار المحتملة: ما يمكن أن يفعله
5. مستوى الخطورة: [مستوى الخطورة: XX/100]
6. طريقة الولوج: كيف دخل إلى النظام
7. خلاصة سريعة: جملة تلخّص الوضع`
          }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      if (response.status === 401) {
        return res.status(401).json({ error: "❌ مفتاح API غير صحيح أو منتهي" });
      }
      return res.status(502).json({ error: `❌ خطأ من Anthropic: ${errBody.error?.message || response.status}` });
    }

    const data = await response.json();
    const result = data.content?.[0]?.text || "";

    res.json({ result, model: CLAUDE_MODEL });

  } catch (err) {
    console.error("[/analyze] Error:", err.message);
    res.status(500).json({ error: "❌ خطأ في الاتصال بالخادم" });
  }
});

// ══ /plan ══
app.post("/plan", rateLimit, async (req, res) => {
  const { analysis, threat } = req.body;

  if (!analysis) {
    return res.status(400).json({ error: "❌ لا يوجد تحليل مسبق" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `بناءً على هذا التحليل الأمني:
"${analysis.slice(0, 500)}"

نوع التهديد: ${threat || 'غير محدد'}

اكتب بالضبط 6 خطوات عملية مرقمة لإزالة التهديد وتعقيم الجهاز.
كل خطوة تبدأ بـ "خطوة N:" وتذكر أداة مجانية محددة للتنفيذ.`
          }
        ]
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "❌ خطأ في توليد الخطة" });
    }

    const data = await response.json();
    res.json({ plan: data.content?.[0]?.text || "" });

  } catch (err) {
    console.error("[/plan] Error:", err.message);
    res.status(500).json({ error: "❌ خطأ في الخادم" });
  }
});

// ══ /health ══
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: CLAUDE_MODEL,
    uptime: Math.floor(process.uptime()) + "s",
    keyConfigured: CLAUDE_API_KEY !== "PUT_YOUR_KEY_HERE"
  });
});

// ══ Fallback لـ SPA ══
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

// ══ START ══
app.listen(PORT, () => {
  console.log("╔════════════════════════════════════╗");
  console.log("║     CyberShield AI — Backend       ║");
  console.log(`║     http://localhost:${PORT}           ║`);
  console.log(`║     Model: ${CLAUDE_MODEL}  ║`);
  console.log(`║     API Key: ${CLAUDE_API_KEY !== "PUT_YOUR_KEY_HERE" ? "✅ Configured" : "❌ NOT SET"} ║`);
  console.log("╚════════════════════════════════════╝");
});
