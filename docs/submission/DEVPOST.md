# Submission copy — review before publishing

Project name: **Sila — shared culture, grounded in taste**

Tagline: **Turn what your club loves into an Edinburgh outing that actually fits.**

Public demo link: https://sila-discovery-4mxmd4sx7-dakshverma675-gmailcoms-projects.vercel.app/discover — separate Vercel preview; hosting checks and browser-verification limitation are in `HOSTING.md`.

Repository: https://github.com/dakshverma-dev/sila-discovery — dedicated hackathon fork. Original project: https://github.com/dakshverma-dev/Shared-Cultural-Bookings.

## Inspiration

Small cultural clubs can know each other well and still struggle to pick an outing. A jazz circle might enjoy a gallery; a film club might prefer a garden. A category dropdown misses those connections, while a generic AI suggestion can ignore the budget, dates or number of people who need to fit.

Sila starts with a few cultural things the club already loves, then brings taste intelligence and practical constraints together.

## What it does

An organiser selects up to three real Qloo search results, enters their club's places, dates and per-person budget, and receives up to three feasible sample sessions at verified Edinburgh venues. Qloo supplies the venue affinity order; Sila checks the catalogue facts. The shortlist makes its evidence and exclusions visible.

The organiser can inspect a session and save a private, conditional sample request. That request is stored on the server, remains accessible to its anonymous visitor identity, and survives an application restart. Price, version and capacity are checked again before it is saved. It does not reserve seats, send a venue message, confirm anything or take payment.

The sessions are explicitly fictional. The Qloo identities and recommendation calls are real.

## How we built it

The discovery edition extends an existing Next.js / React / TypeScript application. Qloo `/search` resolves selected interests; `/v2/insights` ranks a fixed set of five verified place IDs. We retain the returned order and deterministically remove sessions outside the requested dates, budget or sample capacity. Money is integer GBP pence, with date filtering in Europe/London.

A separate PostgreSQL database stores anonymous runs and conditional requests. Signed HttpOnly visitor cookies, row-level ownership policies, same-origin writes and request idempotency protect the workflow. It has no write path into Sila's real pilot.

There is also an optional Claude Haiku 5.5 integration using the official Anthropic SDK. Its bounded tools discover eligible sessions and inspect returned facts; server validation rejects invented or reordered final IDs. **At preparation time this path has mocked contract tests but no verified live Anthropic run, because the key is not configured.** The working demonstration uses direct live Qloo discovery. Retain this disclosure unless later live evidence justifies updating it.

## Challenges

The important integration problem was joining real cultural intelligence to a small, truthful catalogue. All five venues resolved in search, but the two captured Insights profiles returned only four. Sila excludes the omitted venue rather than inventing a score. We also kept a recommendation visibly separate from permission to book: a saved request is conditional, not inventory ownership or venue approval.

## What we're proud of

Changing only the selected interest changes the live shortlist. For the captured seven-place, £35, 19–22 November search, Spirited Away led with the Botanic Garden; Miles Davis led with Fruitmarket. Printmakers was filtered for price and Stills for insufficient sample places / missing provider coverage. The trace lets a judge inspect that difference directly.

Concurrent retries create one request, another visitor cannot read it, and stale prices or capacity fail before saving. The result is a small end-to-end product rather than recommendation text with an inactive booking button.

## What we learned

Taste ranking and booking eligibility are different kinds of evidence. Qloo can connect cultural interests across domains, but a useful suggestion still needs explicit facts, honest coverage limits and a fresh eligibility check before an action.

## What's next

Finish a verified live model run, publish the isolated discovery demo after owner review, and test the concept with consenting club organisers and venues. Real sessions would require approved terms, actual capacity, manual venue review and the pilot's release controls. No partnerships or user-study outcomes are claimed yet.

## Existing work disclosure

Sila's cultural-booking concept, pilot implementation, sample customer interface, editorial design and original Qloo adapter existed before this submission preparation. The new work in this local branch is the dedicated discovery input/result/session/request journey, verified place mappings, live place ranking, signed interest provenance, deterministic catalogue filtering, isolated persistent request store, optional bounded model tooling, provider evidence and submission documentation. The manual-introduction pilot has not been converted into automated matching.

## Built with

Next.js, React, TypeScript, Qloo API, PostgreSQL, Docker, Zod, Vitest; optional Anthropic SDK / Claude Haiku 5.5. The separate existing pilot uses Supabase Auth; the new anonymous discovery store uses signed visitor identities and PostgreSQL RLS.
