# Separate discovery deployment

Owner request on 25 October 2026: publish the discovery edition to a new GitHub repository and a new Vercel project, leaving existing resources untouched.

- New source: https://github.com/dakshverma-dev/sila-discovery
- Local checkout: `D:/hackathon/VasDaksh-Hackathons/sila-discovery`
- Source baseline: `eafbee04bc82ec236dbc1852ec58ce2fb6e9829e` from Shared Cultural Bookings. Existing Git history and attribution are preserved.
- New Vercel project: `sila-discovery`, ID `prj_jdjbAJ7bCP0NkJ9WVHGtdYQ0TGJv`, workspace `dakshverma675-gmailcoms-projects` (explicitly selected by owner).
- Deployment target: preview. URL and Ready result will be recorded after the build.
- New dedicated Neon resource: `sila-discovery-db`, project `green-night-75361900`, Singapore, installed free plan `free_v3`. No paid upgrade was selected.
- Only the discovery schema and five fictional sessions were initialised in that new database. The server uses a restricted non-superuser role without catalogue-write rights. No pilot database or Auth service is connected.
- Initial database owner credentials were pulled to an ignored local file for bootstrap, then the automatic admin credential connection was detached from the new Vercel project. Runtime receives only the restricted discovery URL, fresh cookie-signing key and Qloo server key.
- Root redirects to `/discover`. `SILA_DISCOVERY_ONLY=1` blocks pilot pages and APIs; the inherited pilot cron is removed from this fork's Vercel configuration.
- No Devpost submission was performed. Optional Claude remains unconfigured; Qloo discovery works directly.

## Checks

The separate checkout passed ESLint, TypeScript, 242 unit tests and production build. Hosted database bootstrap verified all five sessions, a nonprivileged application role and denial of catalogue writes. Hosted deployment and browser results are recorded below once available.

The prior local verification evidence belongs to the original local candidate; it is not presented as a hosted verification run.
