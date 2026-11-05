# Historical UFC fight database import

## First source candidates

The initial historical baseline is the Item Response Warehouse table `ufc_1993_2026`:
- Coverage described by the publisher: 1993–2026, 11,323 fights, 4,115 fighters.
- License displayed by the publisher: CC0 1.0.
- Listed fields: `agent_a`, `agent_b`, `date`, `finish_round`, `homefield`, `method`, `title_fight`, `weight_class`, `winner`.
- Known limitation: draws are retained; no-contests are dropped. This baseline is not complete until no-contests and other edge cases are reconciled.

A supplemental dataset by N. Bair covers 2013-02-16 through 2026-10-10 and reports 6,743 fights. It is published under CC BY 4.0 and must be attributed. Its documentation says rankings begin in February 2013 and notes possible one-day event-date differences. It can be used as a cross-check and a source of richer statistics, not as a substitute for the earlier historical baseline.

## Run an import preview

Download the CSV from the source publisher and run:

```bash
node scripts/import-ufc-fights.mjs --file ./data/ufc_1993_2026.csv --schema irw
```

For the Bair dataset:

```bash
node scripts/import-ufc-fights.mjs --file ./data/ufc_all_fights_wide.csv --schema bair
```

The default is a dry run. It reports invalid rows, duplicate canonical keys, unknown outcomes, and missing methods. It does not write to Supabase. The importer canonicalizes corner order, preserves the original row, and uses a deterministic bout key so repeated imports do not create duplicate bouts.

## Stage records into Supabase

First apply `supabase/schema.sql` to create the base tables, then apply `supabase/migrations/0002_canonical_fight_database.sql` to add canonical events, bouts, source records, and review queues. Set the database URL and service-role key in your local environment (never commit either secret), then run:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-ufc-fights.mjs --file ./data/ufc_1993_2026.csv --schema irw --commit
```

Imported records are staged with `record_status = needs_review`. They are not publicly visible and are not considered verified. Each source row is retained in `fight_source_records`; conflicts are sent to `fight_data_review_queue`.

## Source schemas

- `irw`: Item Response Warehouse CC0 table.
- `bair`: N. Bair CC BY 4.0 wide CSV schema.

## Required validation before publication

1. Compare total bout counts by year and event against independent sources.
2. Reconcile no-contests, overturned results, draws, cancelled bouts, and events with multiple same-day bouts.
3. Confirm the two fighter identities for every bout; ambiguous name matches must be reviewed.
4. Compare method, round, and result when multiple sources cover the same bout.
5. Preserve source URL, license, retrieval date, raw row, and any disagreement.
6. Keep unknown historical rankings/form as unknown. Do not infer them from present-day rankings.
7. Only an administrator can move a record to verified and approve scores for publication.

## Important restrictions

- Do not crawl Tapology or UFC.com without written permission or an authorized feed.
- The UFCStats website's relationship to the UFC terms needs legal/contractual confirmation before direct automated crawling. A public third-party dataset is not proof that its original collection method was authorized.
- The GPL-3.0 license on the Greco1899 scraper repository covers its code; it does not establish a license for the underlying UFCStats data.
- Never place service-role credentials in browser code or GitHub.
