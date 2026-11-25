# 工廠 LIVE — maintained source

Edit src/app/ and rebuild; root index.html is generated for GitHub Pages.
Source baseline: main 1261763, handoff f6698cc0efc4d2af318ea38d22fca46438219730.

## Build (from src/)

    python3 build.py                          # local-storage rehearsal backend
    python3 build.py <SUPABASE_URL> <PUBLISHABLE_KEY>  # production -> dist/index.html

Copy the production build to the repository root when publishing. Preserve the
existing public connection settings; never include a service-role/secret key.
No database migration is required for this QA repair.

## Verify (Node 24+)

    cd test
    npm ci
    npm test

Covers calculations, real SQL argument names versus RPC JSON, DOM regressions,
draft persistence, bilingual text, pagination, and PostgreSQL rules. The older
Playwright scripts use LocalApi; passing those is not production proof.

Explicit live integration (creates its own three-factory QA room):

    npm run test:live

Reads public connection settings from root index.html. Local fixtures are ignored
by Git. Also test the deployed UI in separate teacher/student/projector tabs at
390px / 1280x720 / 1920x1080.

## Classroom behavior

- Actual reported tables are paired in order; an odd final three count in a cycle.
  A single factory needs a TA to verify and enter counts.
- Only confirmed or teacher-approved trials feed estimates.
- Missing decisions/results remain unknown; prepaid first-period rent is visible.
- Forecasts concern exits across the whole active class.
- Reasons autosave as local drafts, keyed by room and team. They are explicitly
  not submitted to the teacher and are not in CSV exports.
- The teacher can reveal/hide the short-run vs long-run explanation at debrief.
- Up to 20 factories remain visible on one projection screen.
- Market parameters stay hidden from students/projector until the teacher
  explicitly announces them. Editing parameters withdraws that announcement.
- Projector means use one complete-data cohort across tested headcounts, with
  the cohort size labelled. Paired marginal analysis stays in teacher data.
- Projection ledgers compare all factories with shutdown/exit; the debrief
  foregrounds the lesson formula and labels forecast frequencies.
- Teacher URLs containing a different room code require fresh sign-in before
  loading that room. Boot, rendering and stale click/change dispatch are fenced.
- Ledger 2 compares each factory with its own alternative: exits use estimated
  renewal, renewers use zero. Unknown alternatives are excluded from comparisons.
- Automatic Ledger 2 examples favour opening today and correctly exiting next;
  manual featured choices are scoped to their ledger period.

## RPC regression

Historical SQL declares unquoted p_L, which PostgreSQL folds to p_l. JSON must
send p_l for report, submit, confirm, host count and host decision endpoints.
api_contract_test.js validates JSON arguments against the SQL declarations;
the permissive LocalApi mock would not detect this mismatch.
