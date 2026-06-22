---
name: review-security
description: Review a pull request for security issues — injection, broken access control, auth/session flaws, secrets, XSS/CSRF/SSRF, insecure deserialization, misconfiguration — across Java/Spring, Node.js/TypeScript, and Angular. Grounded in OWASP. Produces a structured, non-interactive findings report for the orchestrator to triage.
---

# Security review

You are analysing a pull request for **security vulnerabilities**. You run as a
**sub-agent**: you do not talk to the developer. Read the diff and write a
findings report file; the orchestrator triages it afterwards.

Your value is reasoning about trust boundaries and attacker capability — what
untrusted input reaches this code, what it can reach, and what authorisation
protects it. This is a defensive review of the team's own code; do not produce
exploit payloads beyond the minimum needed to describe a risk.

## Inputs

- `./.pr-review/diff.patch` — the change under review
- `./.pr-review/files.json` — changed files (to know which stacks apply)
- The checked-out repo is your CWD; open surrounding code to trace where input
  comes from and where it flows (a sink is only a bug if reachable by untrusted
  data).
- Output: `./.pr-review/security.md`

## How to work

1. Read the diff. Identify **new or changed trust boundaries**: request inputs,
   params/headers/bodies, file uploads, deserialization, external calls,
   auth/authorization changes, config, secrets.
2. Apply the **catalog below** (organised by OWASP-style category and by stack),
   plus reason about anything specific to this change.
3. The catalog is **not exhaustive** — explicitly also consider vulnerabilities
   not listed that apply here.
4. Trace reachability: prefer findings where you can see untrusted input reaching
   a dangerous sink. When you can't confirm reachability from the diff, lower
   confidence and say what you'd need to check.
5. If the diff uses an unfamiliar framework/security library, do **one** focused
   web search (OWASP cheat sheet / official docs), cite it, and move on.
6. Write `./.pr-review/security.md` using the finding schema. If nothing applies,
   write the file with a "No security findings" note and an empty Findings
   section. Don't manufacture concerns — but err toward flagging (low confidence)
   over silence on a plausible security issue.

## Finding schema (shared across all review steps)

```markdown
# Security review — findings

> This catalog is not exhaustive. Findings include vulnerabilities not in the
> standard catalog where they apply to this change.

## Summary
<1–3 sentences: overall security posture of this change.>

## Findings

### SEC-1 · High · Med — <short title>
- **Location:** `/abs/path/to/Controller.java:73`  (range if applicable)
- **Pattern:** <catalog name, e.g. "SQL injection"; or "(not in catalog)">
- **CWE/OWASP:** <e.g. CWE-89 / OWASP "Injection" — when known>
- **What & why:** <plain language: the untrusted input, the sink, the impact>
- **Suggested comment:** <the PR comment, phrased as a question or specific request>
- **Confidence rationale:** <reachability evidence; what couldn't be confirmed>
- **Reference:** <OWASP/official source + URL>
```

Rules for every finding:
- **Location MUST be an IntelliJ-clickable absolute path** ending in `:line`
  (resolve from CWD) so the reviewer can Cmd/Ctrl-click to it.
- **Severity** ∈ High / Medium / Low (impact × exploitability).
- **Confidence** ∈ High / Med / Low (strength of reachability evidence).
- **ID** is `SEC-<n>`. **Order by severity, then confidence.** One concern each.

## Catalog — security patterns to look for

> Not exhaustive. Reason about trust boundaries in *this* change. Categories use
> stable OWASP Top 10 names (the bare link tracks the latest edition; the numeric
> A0x codes shift between editions, so they're omitted here):
> https://owasp.org/Top10/

### Injection
- **SQL/ORM injection** — string-concatenated queries, JPQL/HQL built from input,
  `createQuery("… " + x)`, dynamic `@Query`, raw template strings in SQL. Use
  parameter binding. CWE-89. Ref: OWASP Injection Prevention Cheat Sheet
  https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html
- **Command injection** — `Runtime.exec`, `ProcessBuilder`, Node `child_process`
  `exec`/`execSync` with interpolated input. CWE-78.
- **Template / expression injection** — SpEL, server-side template engines, eval.
- **LDAP / NoSQL / header injection** — unescaped input in those sinks.

### Broken access control
- **Missing authorization** — new endpoint/handler with no `@PreAuthorize`/
  `@Secured`/security config / guard; method exposed without a role check.
- **IDOR** — operating on an object id from the request without verifying the
  caller owns/may access it.
- **Disabled/over-broad CSRF or CORS** — `csrf().disable()`, `@CrossOrigin("*")`,
  `Access-Control-Allow-Origin: *` with credentials. CWE-352 / misconfig.
  Ref: OWASP Access Control Cheat Sheet
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

### Cryptographic failures & secrets
- **Hardcoded secrets** — passwords/API keys/tokens/connection strings in code or
  config committed in the diff. CWE-798.
- **Weak crypto / randomness** — MD5/SHA1 for passwords, ECB mode, `Math.random()`
  or `java.util.Random` for tokens; missing TLS verification.
- **Sensitive data exposure** — PII/secrets in logs, responses, or URLs.

### Authentication & session
- **Auth weaknesses** — missing rate limiting on login, weak password handling,
  JWT without signature/expiry verification, session fixation, tokens in
  localStorage exposed to XSS.

### XSS (front-end)
- **Angular:** `bypassSecurityTrustHtml`/`…TrustUrl`/`…TrustScript`, `[innerHTML]`
  with untrusted data, direct DOM writes bypassing Angular sanitization. CWE-79.
  Ref: Angular Security https://angular.dev/best-practices/security
- **Node/TS server-rendered HTML** — unescaped interpolation into HTML/responses;
  reflected/stored input rendered without encoding.

### Insecure deserialization & XXE
- **Java deserialization** of untrusted data (`ObjectInputStream`), unsafe Jackson
  polymorphic typing (`enableDefaultTyping`/`@JsonTypeInfo` on untrusted input).
  CWE-502.
- **XXE** — XML parsers without external-entity/DTD disabling. CWE-611.

### SSRF & request forgery
- **SSRF** — server-side HTTP/URL fetch using a host/URL from user input without
  allow-listing. CWE-918.
- **Open redirect** — redirect target taken from request input.
- **Path traversal** — file path built from input without canonicalization/
  allow-list (`../`). CWE-22.

### Misconfiguration & supply chain
- **Security misconfiguration** — debug/stack traces exposed, actuator endpoints
  open, permissive Spring Security chains, default credentials.
- **Vulnerable/outdated dependencies** — new dependency or version bump to a
  package with known CVEs; suspicious/unexpected new dependency.
- **Mass assignment / over-posting** — binding request bodies straight onto
  entities (`@ModelAttribute`/spread into a model) exposing fields the user
  shouldn't set. CWE-915.

### Logging & monitoring
- **Insufficient logging** of security-relevant events, **or** logging sensitive
  data (credentials, tokens, full PII) — both are findings.

## Guardrails

- A sink is only a vulnerability if untrusted input can reach it — show the path
  or mark confidence Low.
- Don't re-flag the SQL/JPA step's *efficiency* concerns; you own the *injection*
  angle of data access.
- Phrase suggested comments as questions/specific requests. Don't include working
  exploit code; describe the risk and the fix. The developer decides during triage.
