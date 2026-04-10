# Corner Case Catalog

Systematic catalog of corner case categories for API testing. Walk through each category for every discovered endpoint. Skip categories tagged as not applicable.

## How to Use This Catalog

For each endpoint in the API map:
1. Check the **Applies to** tag — skip categories that don't match the endpoint's method or resource type.
2. Generate concrete test cases by substituting the endpoint's actual fields, types, and constraints into the example patterns.
3. If an API spec is available, use its constraints (maxLength, enum values, patterns, required fields) to produce more targeted boundary tests.

---

## 1. Required Fields

**Applies to:** POST, PUT, PATCH — any endpoint with a request body  
**Description:** Verify the API rejects requests when required fields are missing.

Example patterns:
- **Omit single required field**: For each required field, send the request with that one field removed. Expect 400 with an error identifying the missing field.
- **Omit all required fields**: Send an empty body `{}`. Expect 400.
- **Empty string for required string**: Send `{ "name": "" }` for a required string field. Expect 400 or observe whether empty strings are accepted.
- **Null for required field**: Send `{ "name": null }`. Expect 400.
- **Only optional fields**: Send a body containing only optional fields, omitting all required ones. Expect 400.

## 2. Type Coercion and Wrong Types

**Applies to:** All endpoints with parameters or body fields  
**Description:** Verify the API handles type mismatches correctly rather than silently coercing.

Example patterns:
- **String where number expected**: Send `{ "age": "twenty" }` for a numeric field. Expect 400.
- **Number where string expected**: Send `{ "name": 12345 }` for a string field. Observe behavior.
- **Boolean where string expected**: Send `{ "name": true }`. Expect 400 or observe.
- **Array where object expected**: Send `[1, 2, 3]` as the body when an object is expected. Expect 400.
- **Nested object where scalar expected**: Send `{ "name": { "first": "Test" } }` when a flat string is expected. Expect 400.

## 3. Boundary Values

**Applies to:** Endpoints with numeric, string, date, or array parameters  
**Description:** Test values at and beyond the edges of valid ranges.

Example patterns:
- **Zero**: Send `0` for numeric fields that may not accept zero. Observe behavior.
- **Negative number**: Send `-1` for fields expecting positive values. Expect 400 or observe.
- **Very large number**: Send `Number.MAX_SAFE_INTEGER + 1` (9007199254740992). Observe precision loss or rejection.
- **Max-length string**: If maxLength is known (e.g., 100), send exactly 100 chars (expect success) and 101 chars (expect 400).
- **Empty string**: Send `""` for optional string fields. Observe whether it's treated as null/missing or accepted.
- **Empty array**: Send `[]` for array fields. Observe whether empty collections are accepted.
- **Date boundaries**: Send dates in the far past (`1970-01-01`), far future (`2099-12-31`), and invalid dates (`2025-02-30`).

## 4. String Formats and Special Characters

**Applies to:** Endpoints accepting text/string fields  
**Description:** Verify the API handles unusual string content safely.

Example patterns:
- **Unicode and emoji**: Send `"Test 🎉 名前"`. Verify it's stored and returned correctly.
- **HTML/XSS payload**: Send `"<script>alert('xss')</script>"`. Verify it's escaped or rejected, never executed.
- **SQL injection pattern**: Send `"'; DROP TABLE users; --"`. Verify no SQL error in response.
- **Very long string**: Send a 10,000+ character string. Expect 400 if there's a length limit, or observe truncation behavior.
- **Whitespace-only string**: Send `"   "` (spaces only). Observe whether it's treated as empty or accepted.
- **Null bytes**: Send `"test\u0000value"`. Observe handling.
- **Newlines and tabs**: Send `"line1\nline2\ttab"`. Verify stored and returned correctly.
- **Leading/trailing whitespace**: Send `"  test  "`. Observe whether it's trimmed.

## 5. Authentication and Authorization

**Applies to:** All protected endpoints  
**Description:** Verify authentication and authorization are enforced correctly.

Example patterns:
- **No auth header**: Send request without any authentication. Expect 401.
- **Invalid token**: Send `Authorization: Bearer invalid-token-value`. Expect 401.
- **Expired token**: If possible to obtain an expired token, send it. Expect 401.
- **Malformed auth header**: Send `Authorization: NotBearer token123`. Expect 401.
- **Wrong role**: Authenticate as a user without the required role/permission. Expect 403.
- **Access another user's resource (IDOR)**: Authenticate as User A, access User B's resource by ID. Expect 403 or 404 (not 200).

## 6. Resource Not Found and Conflict

**Applies to:** GET, PUT, PATCH, DELETE with ID/key parameter  
**Description:** Verify correct behavior when the target resource doesn't exist or has conflicting state.

Example patterns:
- **Non-existent ID**: Send a valid-format but non-existent ID. Expect 404.
- **Deleted resource**: Create a resource, delete it, then try to GET/PUT it. Expect 404.
- **ID format violation**: If IDs are UUIDs, send a non-UUID string. If numeric, send a non-numeric string. Expect 400.
- **ID = 0 or negative**: Send `0` or `-1` as an ID. Expect 400 or 404.
- **Duplicate creation**: Create a resource, then try to create another with the same unique key. Expect 409.

## 7. Idempotency and Duplicate Requests

**Applies to:** POST (create), PUT (update)  
**Description:** Verify behavior under repeated or concurrent identical requests.

Example patterns:
- **Identical POST twice**: Submit the same create request twice in sequence. Expect either 409 (duplicate detection) or two separate resources (if duplicates are allowed). Document which behavior is correct.
- **PUT same data twice**: Update a resource with identical data twice. Both should succeed (PUT is idempotent). Second response should match first.
- **Rapid sequential requests**: Send 3-5 identical requests in quick succession. Verify consistent behavior — no partial writes, no 500 errors.
- **Idempotency key** (if supported): Send the same request with the same idempotency key twice. Expect the second to return the first's result without creating a duplicate.

## 8. Pagination, Filtering, and Sorting

**Applies to:** GET list endpoints with query parameters  
**Description:** Verify collection endpoints handle edge-case query parameters gracefully.

Example patterns:
- **Page zero**: Send `?page=0`. Expect 400 or equivalent of page 1 — document behavior.
- **Negative page**: Send `?page=-1`. Expect 400.
- **Page beyond data**: Send `?page=999999` when only a few pages of data exist. Expect 200 with empty results array and correct total count.
- **Page size zero**: Send `?pageSize=0`. Expect 400 or default page size.
- **Very large page size**: Send `?pageSize=100000`. Expect 400, a capped page size, or observe performance impact.
- **Invalid sort field**: Send `?sort=nonExistentField`. Expect 400 or observe default sort.
- **Empty filter value**: Send `?status=`. Observe whether it filters or returns all results.
- **Filter with special characters**: Send `?search=%25%26%3D`. Verify proper URL decoding.

## 9. Content-Type and Headers

**Applies to:** All endpoints  
**Description:** Verify the API handles unexpected content types and headers.

Example patterns:
- **Wrong Content-Type**: Send `Content-Type: text/plain` with a JSON body to a JSON endpoint. Expect 400 or 415.
- **Missing Content-Type**: Omit the Content-Type header on a POST with a body. Observe behavior.
- **Body on GET**: Send a request body with a GET request. Expect the body to be ignored.
- **Accept header mismatch**: Send `Accept: application/xml` when only JSON is supported. Expect 406 or observe.

## 10. Concurrency and Race Conditions

**Applies to:** PUT, PATCH, DELETE on shared resources  
**Description:** Verify behavior under concurrent modifications.

Example patterns:
- **Simultaneous updates**: Send two PUT requests to the same resource concurrently with different data. Verify one succeeds and the other either succeeds with last-write-wins or returns 409 (optimistic locking).
- **Delete during update**: Send DELETE and PUT concurrently on the same resource. Verify no 500 errors — one should succeed, the other should get 404 or 409.
- **Read-after-write**: Create a resource, then immediately GET it. Verify it's returned correctly (eventual consistency check).
- **Stale ETag** (if supported): GET a resource with ETag, modify it via another request, then PUT with the original ETag. Expect 412 Precondition Failed.

## 11. Response Structure Validation

**Applies to:** All endpoints  
**Description:** Verify response bodies match the expected schema consistently.

Example patterns:
- **Success response shape**: Verify the response contains all expected fields with correct types. No extra unexpected fields.
- **Error response consistency**: Trigger multiple different 400 errors. Verify they all follow the same error schema (e.g., `{ error: string, details?: [...] }`).
- **List response metadata**: Verify list endpoints return correct pagination metadata (total count, page number, page size) alongside the data array.
- **Empty list response**: Verify that an empty result set still returns the correct structure (`{ data: [], total: 0 }`) not `null` or `undefined`.
- **Content-Type header**: Verify all JSON responses include `Content-Type: application/json`.

## 12. HTTP Method Compliance

**Applies to:** All endpoints  
**Description:** Verify the API correctly rejects wrong HTTP methods.

Example patterns:
- **Wrong method**: Send GET to a POST-only endpoint, POST to a GET-only endpoint. Expect 405 Method Not Allowed.
- **OPTIONS request**: Send an OPTIONS request. Expect 200 or 204 with CORS headers (if CORS is configured).
- **HEAD request**: Send HEAD to a GET endpoint. Expect 200 with headers but no body.

## 13. Rate Limiting and Payload Limits

**Applies to:** All endpoints (if rate limiting or payload limits exist)  
**Description:** Verify the API enforces limits and responds with appropriate status codes.

Example patterns:
- **Oversized request body**: Send a request body exceeding the server's size limit (e.g., 10MB+ JSON). Expect 413 Payload Too Large.
- **Deeply nested JSON**: Send a body with 50+ levels of nesting. Observe whether the server rejects or processes it.
- **Many query parameters**: Send a request with 100+ query parameters. Observe handling.
- **Rapid requests** (if rate limiting exists): Send 100+ requests in quick succession. Expect 429 Too Many Requests after the limit is reached. Verify the response includes a `Retry-After` header.
