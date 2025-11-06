<!-- config.js -->
<script>
/**
 * Global, runtime-configurable flags.
 * Change these without touching the rest of the app.
 *
 * AI_MODE: "off" | "local" | "openai"
 *   off    = hide AI button, do nothing
 *   local  = call your local AI through the ai-suggest Edge Function
 *   openai = (optional) call OpenAI via the same function
 */
window.KOSMOS_CFG = {
  AI_MODE: "off",  // start safe. change to "local" when ready.
  // If AI_MODE = "local", the Edge Function forwards to your server:
  // e.g., "https://your-hosted-ai.example.com/parse" (expects JSON {image_url,...})
  LOCAL_AI_JSON_ENDPOINT: "",

  // If your model expects multipart file instead of URL, set this true:
  LOCAL_AI_SEND_MULTIPART: false,

  // Optional — only used if you ever enable OpenAI fallback:
  USE_OPENAI_FALLBACK: false
};
</script>
