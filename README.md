# FreshLoop

FreshLoop is a privacy-first food inventory and shopping planner for people who want to use what they have, waste less, and shop more intentionally. The Stage 1 MVP is a responsive, installable web app that works without accounts, paid services, or a backend.

![FreshLoop status](https://img.shields.io/badge/status-MVP-1f4b3f) ![License](https://img.shields.io/badge/license-MIT-f4c7a1)

## What works

- Friendly local-mode onboarding with household name and currency preferences
- Inventory creation and editing with fractional quantities, units, locations, categories, optional dates, date type, and date source
- Explicit distinction between user-entered and estimated dates
- “Use soon” dashboard (available items whose dates are today, past, or within three days)
- Search by name, brand, and category; filter by location and status
- Mark items consumed or discarded, restore them, or remove them
- Shopping list with duplicate confirmation and “may be at home” hints
- Browser-local JSON export and deliberate full deletion
- Responsive desktop/mobile UI, semantic forms, focus styles, live announcements, and reduced-motion support
- Installable PWA shell and offline access after the first successful visit

The app never claims that a date proves food is safe or unsafe. Estimated dates are labeled and editable.

## Quick start

Requires Node.js 20 or later. No dependencies or environment variables are needed.

```bash
npm run dev
```

Open <http://localhost:4173>. On first use, create a local household. Four sample items are included so the main journeys can be explored immediately; they can be edited or removed.

Checks:

```bash
npm test
npm run check
```

Any static host can serve the `dist/` directory. HTTPS is required for service workers outside localhost.

## Architecture and data model

This release deliberately uses buildless ES modules and browser `localStorage`. It is fast on slow connections, easy to audit, and has no runtime service dependency.

- `dist/index.html`: semantic application shell and accessible forms
- `dist/styles.css`: responsive design system and layouts
- `dist/app.js`: view controller, browser persistence, and user workflows
- `dist/model.js`: pure date, inventory, quantity, and export domain functions
- `dist/sw.js`: offline application-shell cache
- `tests/`: domain tests using Node's built-in test runner

The local data document contains `profile`, `items`, `shopping`, and `activity`. Inventory batches are separate records even when their names match, allowing different quantities and dates. Quantities are rounded to three decimal places during arithmetic; incompatible units are never converted.

For a multi-user release, the model should move behind a versioned HTTP API with PostgreSQL tables for users, households, memberships, invitations, storage locations, products, inventory batches, activity events, shopping lists/items, recipes/ingredients, meal plans, notification preferences, and waste/donation records. Every household-owned table should carry a `household_id`, enforced by server authorization and database row-level security. Date-only label dates should remain SQL `date`; event timestamps should use UTC `timestamptz` alongside user time zones.

## Privacy, security, and offline limits

All data stays in the current browser profile. There is no authentication, cloud synchronization, analytics, OCR, AI, barcode lookup, email, or push provider. Clearing site data, using private browsing, or losing the device can permanently remove the data; export JSON regularly if it matters. Anyone with access to the same browser profile can access the household.

After one online visit, the application shell, inventory, and shopping list work offline. Changes update the same device immediately. There is no cross-device queue, conflict resolution, background synchronization, or encrypted local vault. The app does not pretend those capabilities exist.

Deploy with HTTPS, a restrictive Content Security Policy, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and suitable frame protections at the hosting layer. A future authenticated service must add secure cookies, CSRF protection, server-side validation/authorization, rate limiting, audit logs without sensitive payloads, backups, deletion jobs, and tested household isolation.

## MVP acceptance criteria

| Requirement | Result |
|---|---|
| Enter app and create a household/local mode | Implemented |
| Add, edit, search, and remove food | Implemented |
| Quantity, location, and optional date | Implemented |
| Entered vs estimated dates | Implemented and labeled |
| Use-soon view | Implemented |
| Mark consumed or discarded | Implemented |
| Manage a shopping list | Implemented |
| Mobile and desktop layouts | Implemented |
| Core domain tests | Implemented |
| Developer setup documentation | Implemented |

## Roadmap

Stage 2: accounts, server-enforced household roles, invitations, shared lists, recipes, meal planning, confirmed deductions, leftovers, and notification preferences.

Stage 3: optional barcode/OCR providers, offline mutation queues and conflict UX, waste analytics, CSV import, and full data portability.

Stage 4: consent-based community sharing, Urdu/RTL localization, extension interfaces, and native mobile clients.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).

## License

MIT. See [LICENSE](LICENSE). The interface uses Google Fonts when online and falls back to system/Georgia fonts offline; no third-party food or recipe data is bundled.
