# UFC Résumé Index

An independent public ranking project built around the UFC Strength-of-Schedule and Résumé Difficulty Ranking System, Version 2.5.

## Project status

Early development. The repository is being used to build the public leaderboard, private administrator workflow, data model, and deterministic scoring engine. The 30 published-in-document calibration values are reference values only; they are not a completed historical fight-by-fight audit.

## Methodology baseline

The V2.5 document defines a 100-point model:
- Average individual fight score: up to 75 points
  - Opponent quality: 34
  - Opponent form: 11
  - Outcome quality: 18
  - Finish timing: 7
  - Context: 5
- Career-level score: up to 25 points
  - Quality of wins: 10
  - Championship résumé: 6
  - Consistency: 6
  - Quality of losses: 3

Final score = average individual fight score + career-level score.

The implementation must preserve the paper's Hindsight Lock, repeat-opponent treatment, cross-era/division principles, and anti-double-counting rules. It must not silently invent missing inputs or revise the methodology to force a desired ranking.

## Data policy

Tapology is identified in the methodology as a reference for fight-history facts, but automated collection must not be implemented unless permitted by Tapology's terms or written authorization is obtained. The application must use a licensed/authorized provider or manually imported, properly sourced data. Historical rankings and championship status require independent evidence as described in V2.5.

## Planned architecture

- Public frontend hosted from this GitHub repository.
- Supabase for database and authentication.
- Server-side ingestion from an authorized source.
- Deterministic, versioned scoring calculations with audit records.
- Admin-only review queue; calculated changes remain pending until explicitly approved.
- Only approved ranking snapshots are publicly visible.


## Data-source plan (requested)

The preferred research workflow is:
- **Tapology (preferred reference for fight history):** UFC bout lists, fighter/opponent identities, results, wins/losses, methods, dates, rounds, and finish details.
- **ESPN (supporting statistics):** per-fight statistics where ESPN publishes them, including total/significant strikes, takedowns, control time, knockdowns, and submission attempts.
- **Independent historical references:** rankings at the date of each bout, title status, championship history, and documented pre-fight context.

### Important access and methodology constraints

Tapology's current Terms of Use expressly prohibit bots and data scraping of the Site or any part of it. They also restrict unauthorized copying and use of Site contents. Therefore, this project must **not** automatically crawl Tapology unless Tapology grants written permission or provides an authorized feed/export/API license. Tapology remains the preferred reference to verify against, not an approved automated ingestion endpoint at this time. See [Tapology Terms of Use](https://www.tapology.com/terms_of_use).

ESPN publishes UFC FightCenter pages with bout outcomes and statistics for at least some events (for example, [UFC 268](https://www.espn.com/mma/fightcenter/_/id/600010313/league/ufc) and [UFC 266](https://www.espn.com/mma/fightcenter/_/id/600006401/league/ufc)). Coverage and historical completeness must be tested before treating ESPN as a complete database. ESPN's publicly discussed endpoints are undocumented/unofficial; do not assume they are a supported API or that automated reuse is licensed. Use an authorized feed or permitted exports, retain source URLs and retrieval timestamps, and review ESPN's applicable terms before automation.

**V2.5 scoring guardrail:** fight statistics such as strikes and takedowns may be displayed as supporting profile information, but they must not be added to the V2.5 score unless the written methodology explicitly assigns them points. The ranking is based on the defined opponent-quality/form, outcome, career-level, and context criteria.

### Required import and audit behavior

Every imported bout must retain:
- stable source identifier where available, source name, source URL, retrieval timestamp, and raw source payload;
- event date/name, both fighter identities, UFC promotion scope, result, method, finish round/time, and title-fight flag when verified;
- normalized values alongside the original source labels (never discard the original);
- verification state and conflict notes when sources disagree.

Imports must be idempotent, deduplicate the same bout across sources, preserve corrected historical results, and place changed or uncertain records into an admin review queue. Missing information must remain null/unknown rather than being guessed. Historical opponent rank/form must be reconstructed as of the date of the bout (Hindsight Lock), not based on current rankings.

### Build order

1. Establish an authorized historical fight-data source or obtain written permission from Tapology.
2. Import and reconcile the complete UFC event/bout history; verify fighter identity matching and edge cases (draws, NCs, overturned results, renamed fighters, cancelled bouts).
3. Attach ESPN statistics where available, with explicit coverage gaps.
4. Build the historical rankings/championship evidence dataset.
5. Complete V2.5 fight-by-fight and career-level scoring, audit every input, and run calibration tests.
6. Add authenticated admin review/approval and publish only approved ranking snapshots.
7. Enable scheduled incremental updates only after the provider's terms and technical access are confirmed.

## Security

Never place a Supabase service-role key or provider secret in frontend code. Do not enable anonymous write access. Configure Supabase Auth and an explicit admin authorization policy before enabling administrative writes.

## Current limitation

No live data provider, complete historical dataset, production authentication, or deployed public ranking is connected yet. A ranking should not be presented as fully audited until its fight-level inputs and evidence have been reviewed.
