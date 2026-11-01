# SPACE CRM & ERP — React / Laravel / MySQL

The active application uses React + TypeScript + Vite 8, a Laravel 12 JSON API, and MySQL 8.4. The original React screens, layouts, fields, dialogs, and styling are restored from commit bc25301. Their existing service calls now use the session-authenticated Laravel API. Original ancillary fields are retained in validated MySQL JSON attributes; relationships and financial values remain explicit validated columns. No Supabase service is used.

## Current local preview

Open http://127.0.0.1:8080/ . Laravel listens on 127.0.0.1:8000 and MySQL on 127.0.0.1:3307. All services bind to loopback.

From this project folder, restart local services without changing the data:

```powershell
node scripts/start-local.mjs
```

The portable PHP/MySQL installation and database files are in `../tools`, outside the repository. The start script is specific to this workspace. Database credentials are in ignored `backend/.env`; no passwords are shipped in frontend code. Login details for this review are in the delivered review guide.

## Standard installation on another computer

Install PHP 8.4+ with PDO MySQL, OpenSSL, mbstring, fileinfo, curl, XML/DOM, and ZIP; Composer; Node 22.12+ (this workspace uses Node 24); and MySQL 8.4. Create an empty `space_crm` database and a separate `space_crm_test` database. Create an application MySQL account with access only to these databases. Give the deployed runtime account narrower privileges after migrations.

```sh
npm ci
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Set MySQL connection settings, APP_URL, and CRM_ADMIN_PASSWORD (at least 12 characters) in backend/.env. Set the desired CRM_ADMIN_EMAIL. Then:

```sh
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

In a separate terminal at the project root run `npm run dev`. Vite proxies same-origin `/api` calls to Laravel, preserving session and CSRF protection. Use 127.0.0.1 consistently for the local preview.

For deployment, serve the React dist files and route `/api` to Laravel's public directory under the same HTTPS origin. Set APP_ENV=production, APP_DEBUG=false, SESSION_SECURE_COOKIE=true, configure persistent private file storage, backups, mail, and a real web server. The PHP built-in server and Vite are local development servers.

## Verification

```powershell
node scripts/verify-local.mjs
```

Or run `npm run typecheck`, `npm run lint`, `npm run build`, then `php vendor/phpunit/phpunit/phpunit` from backend. Copy backend/.env into backend/.env.testing, change APP_ENV to testing and DB_DATABASE to space_crm_test, and use a separate test database. Tests assert the database name before destructive test setup; never point tests at your review data. PHPUnit's XML intentionally omits a redundant bootstrap attribute because the installed PHPUnit executable already loads Composer's autoloader; this also avoids a restricted-Windows is_readable false negative.

The local Windows bootstrap compatibility helper verifies an actual temporary write to bootstrap/cache when Windows ACL checks incorrectly report it unwritable. It never changes ACLs or modifies vendor files.

## Retained dummy cycle

The fresh database contains records prefixed DUMMY. The main client has a closed-won EGP 100,000 booth deal, two installments and receipts totaling EGP 100,000, an invoice with zero remaining balance, and a paid EGP 5,000 commission. A second EGP 50,000 sponsorship deal remains in proposal stage. Meeting attendance, task completion, proposal acceptance, contract attachment, employee account, support resolution, and chat are linked to the cycle. The original data is retained alongside the additional review cycles described below.

`scripts/demo-cycle.mjs` exercises the live HTTP API, including sessions, CSRF, protected deletes, and overpayment rejection. It requires CRM_ADMIN_PASSWORD in the environment and refuses to duplicate an existing review cycle. The completed run's results are supplied with the review guide. It records simulated receipts only and never calls a payment processor or sends email.

See docs/RELATIONSHIPS.md for the relationship map and business rules.

## Scope and remaining boundaries

The restored core screens use persistent Laravel records, real relationship options, session permissions, private attachments, and the tested sales/receipt/commission cycle. The original checkout also contains unfinished controls and missing pages; these are not evidence of implemented functionality. It does not implement bank/payment-provider execution, email delivery, verified electronic signatures, tax-compliant invoice issuance, refunds/reversals, live WebSocket chat, payroll processing, recurring meeting automation, AI features, or a full accounting ledger. Status changes record internal business states. Those features were not operational in the original checkout and are not represented as working integrations now.

List pagination/search currently operate in the browser after loading a module's records; API-side pagination, bulk datasets, and concurrent-user load testing should be added before a large deployment. This is one organization's workspace with module-level roles, not a multi-tenant SaaS or ownership-scoped access system.

Original Supabase-shaped service names remain as compatibility imports only and route to Laravel. No live Supabase data was read or migrated.
