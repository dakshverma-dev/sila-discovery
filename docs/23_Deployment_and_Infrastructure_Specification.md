# Deployment and Infrastructure Specification


D23 | Version 0.1 | 12 October 2026


Specify environments, secrets, job scheduling and release recovery.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Deployment topology

Host the Next.js application on Vercel and use a Supabase project for Auth, PostgreSQL and bounded Edge Function workers. Use separate staging and judge-demo projects or strictly isolated workspaces with tested permissions; real pilot identities must not exist in public judge sandboxes.

## Environment configuration

| Variable | Location | Meaning |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Browser and server | Supabase project endpoint; public configuration. |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Browser and server | Public project key; safe only with grants and policies. |
| SUPABASE_SERVICE_ROLE_KEY | Trusted server and worker only | Privileged database access; never in browser bundle. |
| QLOO_BASE_URL | Worker only | https://hackathon.api.qloo.com for hackathon key. |
| QLOO_API_KEY | Worker only | Secret; no value provided in the pack. |
| LLM_PROVIDER | Worker only | Selected provider adapter; pin model at implementation. |
| LLM_MODEL | Worker only | Explicit tested model identifier; unresolved until chosen. |
| LLM_API_KEY | Worker only | Secret if a live LLM is enabled. |
| WORKER_TRIGGER_SECRET | API and worker only | Authenticate internal job invocation. |
| DEMO_CAPABILITY_SECRET | Application server only | Sign isolated expiring judge sessions. |
| APP_BASE_URL | Server | Canonical published HTTPS origin. |
| DEMO_MODE | Server | Synthetic-workspace controls; never enables pilot role switching. |

## Job dispatch

The API stores a job and triggers an authenticated worker invocation after commit. The worker leases the job and checkpoints stages. Supabase pg_cron can expire proposals and retry QUEUED or abandoned RUNNING jobs. Test pg_cron and worker invocation in the selected Supabase plan. Do not rely on minute-level Vercel Hobby cron; its plan-specific limits must be checked before any scheduler choice.

## Release sequence

- Pin compatible dependency versions and commit a lockfile.
- Apply reviewed schema, functions, grants and policies to staging; run permission and transaction tests.
- Configure secrets in hosted secret stores; keep .env.example values blank.
- Seed only synthetic demo organisations and cultural labels; resolve real Qloo IDs at runtime or through private setup.
- Deploy a preview and complete external end-to-end verification.
- Promote the tested version to the final URL and record the deployment commit.

## Monitoring and costs

Monitor API error rate, provider-call consumption, job timeouts, abandoned leases, catalogue drift, expiry processing and unexpected privileged actions. Set spend and quota alerts using available provider controls. Any cash budget is unresolved; obtain actual plan pricing before a real deployment commitment.

## Rollback and restore

Retain the previous application deployment. Use additive migrations and avoid rolling back a database by dropping reservation history. On incident, disable new matching or publication while preserving read-only booking status. Rehearse database restore using synthetic records and confirm that active slot and reservation invariants survive.

## Judging support

Keep the published app usable through the official judging period, which ends 16 November 2026 Eastern Time. Hackathon keys are temporary; obtain an appropriate production arrangement before continuing a real service after judging. Recheck official dates before the final submission.

## Related documents

D09, D19, D24, D28

## Sources

- SRC10: Supabase Row Level Security. https://supabase.com/docs/guides/database/postgres/row-level-security
- SRC11: Supabase Cron. https://supabase.com/docs/guides/cron
- SRC12: Vercel Cron usage and pricing. https://vercel.com/docs/cron-jobs/usage-and-pricing
- SRC08: Qloo official competition rules. https://qloo.devpost.com/rules
