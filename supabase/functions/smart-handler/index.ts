// supabase/functions/smart-handler/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MINDEE_API_KEY = Deno.env.get("MINDEE_API_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function coalesce<T>(...vals: T[]): T | null {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Missing file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Upload to Storage (public URL back to client)
    const bucket = "receipts-warm";
    const objectPath = `${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;

    // 2) OCR via Mindee
    const fd = new FormData();
    fd.append("document", file);

    // Try expense_receipts v5 first, then receipt v4 as fallback
    async function callMindee(url: string) {
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Token ${MINDEE_API_KEY}` },
        body: fd,
      });
      const js = await r.json();
      return { ok: r.ok, js };
    }

    const urls = [
      "https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict",
      "https://api.mindee.net/v1/products/mindee/receipt/v4/predict",
    ];

    let raw: any = null;
    for (const u of urls) {
      const { ok, js } = await callMindee(u);
      if (ok && js) { raw = js; break; }
      // if not ok, keep trying next
    }

    // Robust extraction across common Mindee shapes
    // Shapes seen:
    //  - document.inference.prediction
    //  - document.inference.pages[0].prediction
    const doc = raw?.document?.inference;
    const pred =
      doc?.prediction ??
      (Array.isArray(doc?.pages) && doc.pages.length > 0 ? doc.pages[0]?.prediction : null) ??
      {};

    const extracted = {
      vendor: coalesce(
        pred?.supplier_name?.value,
        pred?.merchant_name?.value,
        pred?.supplier?.value,
      ),
      total: coalesce(
        pred?.total_amount?.value,
        pred?.total_incl_tax?.value,
        pred?.total_excl_tax?.value
      ),
      tax: coalesce(
        pred?.total_tax?.value,
        pred?.taxes?.total?.value
      ),
      date: coalesce(
        pred?.date?.value,
        pred?.purchase_date?.value
      ),
    };

    // If everything is null, still return success with url so UI can show manual form
    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        extracted,
        // Uncomment next line for debugging in Supabase logs only
        // _debug: { hasRaw: !!raw, keys: Object.keys(pred || {}) }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
