---
name: redact-jira
description: Fetch a JIRA ticket's text and produce a privacy-safe version with all personal information redacted, before that text is used anywhere else in a review. Use at the start of a PR review, after the diff is available, to prepare the ticket description for comparison against the implementation.
---

# Redact JIRA ticket

Your only job in this skill is to turn a raw JIRA ticket into a **privacy-safe
ticket file**. You do not review code, compare against the implementation, or
analyse anything here. Producing the clean file is the whole task.

You run as a **sub-agent**: you do not converse with the developer. This is
deliberate — the raw ticket text (which may contain PII) stays in your context
and never reaches the orchestrator. You return only a redaction *summary*.

## Inputs

- Either a JIRA ticket ID/URL, or a path to a file containing raw pasted ticket
  text (the orchestrator passes one of these).
- Output path: `./.pr-review/ticket.md`.

## Procedure

1. **Get the ticket text.** If given a ticket ID/URL, use the connected
   Atlassian/JIRA tool (`getJiraIssue`) to retrieve the summary and description.
   If given a path to raw pasted text, read it from there. (The orchestrator
   handles the case where no connector is available by collecting the paste.)

2. **Identify personal information.** Scan the summary and description for:
   - People's names (reporters, assignees, customers, names in prose)
   - Email addresses, usernames, employee or user IDs
   - Customer or organisation names that identify a specific client
   - Phone numbers, postal addresses
   - Direct quotes attributed to a named person
   - Any free-text that names an individual ("as Anna requested…")

   In a healthcare context, treat any patient-identifying detail as personal
   information even if it appears incidental.

3. **Redact, preserving meaning.** Replace each item with a neutral
   placeholder that keeps the sentence useful for review:
   - Names of people → `[person]`, or a role if the role matters
     (`[the reporter]`, `[a clinician]`)
   - Customers/orgs → `[customer]`
   - Emails/IDs → `[email]`, `[user-id]`
   - Quotes → paraphrase without the attribution

   Keep everything that is about *the change itself* — the feature, the bug,
   acceptance criteria, technical detail. Those are what the review needs.

4. **Write the clean file** to `./.pr-review/ticket.md` with this shape:

   ```markdown
   # <ticket id> — <redacted summary>

   ## Description
   <redacted description>

   ## Acceptance criteria
   <redacted, if present>
   ```

5. **Return a redaction summary.** As your final message, report:
   - What you redacted by **count and kind only — never the original values**
     (e.g. "redacted 2 names and 1 customer reference").
   - The **absolute path** of the file you wrote, so the orchestrator can hand it
     to the developer to review. Resolve it explicitly — e.g.
     `realpath ./.pr-review/ticket.md` (or `echo "$(pwd)/.pr-review/ticket.md"`) —
     and quote that absolute path; do not return the relative `./.pr-review/...`
     form.

   The orchestrator shows this to the developer for confirmation. If the developer
   later reports something you missed, the orchestrator re-runs you with that
   correction.

## Guardrails

- Never write raw personal information into `./.pr-review/ticket.md` or echo
  it back in later steps. The clean file is the only ticket text that
  continues through the review.
- If the developer asks you to "leave the names in, it's internal", explain
  that the cleaned file is what gets compared and potentially summarised into
  PR comments, so the redaction stays. You can keep role labels where the role
  genuinely matters to the change.
- When in doubt about whether something is personal, redact it. Over-redaction
  costs nothing here; the feature detail is preserved either way.
