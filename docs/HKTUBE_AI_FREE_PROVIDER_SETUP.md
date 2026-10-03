# HkTube AI: free Groq setup

HkTube can use Groq's OpenAI-compatible API as its primary chat provider and retain Gemini as a free fallback. No paid plan is required for the Groq Free Plan, but its quotas are shared by the whole Groq organization and are not unlimited.

## Provider behavior

- If `GROQ_API_KEY` is set, HkTube uses Groq first with `openai/gpt-oss-20b` by default.
- If Groq returns a rate-limit/quota error, a transient server error, or a transport failure, HkTube tries the configured Gemini endpoint.
- If Groq is not configured, the existing Gemini-first behavior remains; Gemini can still fall back to an OpenAI-compatible provider if one is configured.
- HkTube requests strict JSON-schema output. Groq lists GPT-OSS 20B as supporting strict structured outputs.

## Configure production

1. Create a Groq account and an API key in the [Groq Console](https://console.groq.com/keys).
2. In Vercel, open **hktube → Settings → Environment Variables**.
3. Add `GROQ_API_KEY` for **Production**. Keep it server-only; do not use a `VITE_` prefix and do not put the key in chat, source code, or a committed `.env` file.
4. Optionally add `GROQ_MODEL=openai/gpt-oss-20b`. This is the default if the variable is omitted.
5. Redeploy the production project so the new secret is available to the server.

## Free-plan limits and cost

Groq's published free-plan table lists `openai/gpt-oss-20b` at up to 30 requests per minute, 1,000 requests per day, 8,000 tokens per minute, and 200,000 tokens per day. Limits are organization-wide; all HkTube users share them. Actual limits can change or vary by account/model, so check the live [Groq Limits page](https://console.groq.com/settings/limits).

Groq's model page currently shows approximately 1,000 tokens/second. Its token prices apply to paid usage; the free plan itself does not require a purchase. The free plan is still subject to quota exhaustion, and Gemini fallback has its own independent quota. This improves capacity and resilience compared with relying on only Gemini's free quota, but it does not promise unlimited availability.

## Official references

- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq GPT-OSS 20B model details](https://console.groq.com/docs/model/openai/gpt-oss-20b)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
