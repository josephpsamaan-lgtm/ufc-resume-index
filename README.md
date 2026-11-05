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

## Security

Never place a Supabase service-role key or provider secret in frontend code. Do not enable anonymous write access. Configure Supabase Auth and an explicit admin authorization policy before enabling administrative writes.

## Current limitation

No live data provider, complete historical dataset, production authentication, or deployed public ranking is connected yet. A ranking should not be presented as fully audited until its fight-level inputs and evidence have been reviewed.
