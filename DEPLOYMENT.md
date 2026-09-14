# Public demo deployment

URL: https://wonderful-web-production.up.railway.app

Deployed 2026-09-14 from commit `b0ebbc8` using Railway's Docker builder.
Project: `7400ea5d-d2f2-48ed-ab34-75f2cf5b304c`
App service: `wonderful-web` (`d21585de-e702-4fa4-92ee-bb27e77484f1`)
Database service: `Postgres` (`f0b3873a-a5b5-432d-93ab-947ec42d257f`)

The application uses the private `Postgres.DATABASE_URL` service reference.
No local environment files or existing local databases were uploaded.
Startup applies migrations and seeds only an empty database. The server-side
scheduler runs in the app process; application sleeping is disabled.

Verification: cloud build/type validation passed; 21 local regression tests
passed; `/talent`, `/scout`, `/radar` and their summary APIs returned HTTP 200
externally. Agent status records contain successful initial runs and future
scheduled dates. Initial research encountered Wikipedia HTTP 429 responses,
which are displayed as source errors. Some product data remains synthetic.

Hosting uses the owner's existing trial credit (up to $5 authorized). No paid
plan was selected. The URL is independent of the local computer, but continued
availability depends on Railway account credit and service health. This is
not a promise of unlimited free hosting.

The current version endpoint reads Git at runtime and may report `unknown`
in this source-only Docker deployment; the deployed source commit is recorded
above and in the release archive. App changes require another deployment.

Do not upload `.env` files or local databases. Use Railway variables for secrets.
