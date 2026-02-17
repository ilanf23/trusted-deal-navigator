

## Option A: CSP Headers and XSS Hardening

### Problem

Auth tokens live in `localStorage` (unavoidable for an SPA). If an attacker injects JavaScript via XSS, they can read those tokens. The goal is to make XSS exploitation as difficult as possible.

### What We Will Do

#### 1. Add Content-Security-Policy via meta tag

Add a `<meta>` CSP tag to `index.html` that restricts what scripts, styles, and connections the browser will allow:

```text
default-src 'self';
script-src 'self' https://assets.calendly.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.calendly.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.openai.com https://assets.calendly.com;
frame-src https://calendly.com;
object-src 'none';
base-uri 'self';
form-action 'self';
```

This blocks inline scripts injected via XSS from executing (only scripts from `'self'` and Calendly are allowed). No `unsafe-eval` or `unsafe-inline` for scripts.

#### 2. Replace regex-based HTML sanitization with DOMPurify

The current `sanitizeEmailHtml()` in `EvansGmail.tsx` uses regex stripping, which is fragile and bypassable. Three files use `dangerouslySetInnerHTML` with user-sourced content:

| File | Risk |
|---|---|
| `src/pages/admin/EvansGmail.tsx` | Email HTML bodies -- uses regex sanitizer |
| `src/pages/admin/IlansGmail.tsx` | Email HTML bodies -- NO sanitization at all |
| `src/components/admin/FloatingInbox.tsx` | Email bodies -- NO sanitization at all |

**Changes:**
- Install `dompurify` (and `@types/dompurify`)
- Create a shared `src/lib/sanitize.ts` utility that wraps DOMPurify with a strict config (strips all event handlers, `javascript:` URIs, `<script>`, `<iframe>`, `<form>`, `<object>`, `<embed>`)
- Replace the regex sanitizer in `EvansGmail.tsx` with the DOMPurify utility
- Add sanitization to `IlansGmail.tsx` and `FloatingInbox.tsx` (currently have none)
- The `chart.tsx` usage is safe (static generated CSS, not user input)

#### 3. Add security headers via edge function (optional enhancement)

Create a lightweight middleware-style approach by documenting recommended headers for production deployment:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

These will be added as a `<meta>` tag where possible and documented for CDN/proxy configuration.

### Files to Create
- `src/lib/sanitize.ts` -- shared DOMPurify wrapper

### Files to Modify
- `index.html` -- add CSP meta tag and security meta tags
- `src/pages/admin/EvansGmail.tsx` -- replace regex sanitizer with DOMPurify
- `src/pages/admin/IlansGmail.tsx` -- add DOMPurify sanitization
- `src/components/admin/FloatingInbox.tsx` -- add DOMPurify sanitization
- `package.json` -- add `dompurify` dependency

### What This Achieves

| Attack Vector | Before | After |
|---|---|---|
| Injected inline `<script>` | Executes freely | Blocked by CSP |
| `eval()` / `new Function()` | Allowed | Blocked by CSP (no unsafe-eval) |
| XSS via email HTML body | Regex-stripped (bypassable) | DOMPurify (battle-tested parser) |
| Unsanitized email in IlansGmail | Fully vulnerable | DOMPurify sanitized |
| Unsanitized email in FloatingInbox | Fully vulnerable | DOMPurify sanitized |
| External script injection | Allowed | Only allowlisted domains via CSP |

### What This Does NOT Do

- Does not move tokens out of `localStorage` (requires architectural change to BFF)
- Does not add httpOnly cookies (not possible in SPA without server middleware)

### Why This Is Effective

Even though tokens remain in `localStorage`, an attacker cannot steal them because:
1. CSP prevents injected scripts from running
2. DOMPurify prevents XSS via the email rendering surfaces (the most likely attack vector in this app)
3. The combination makes it extremely difficult to execute arbitrary JavaScript in the first place

