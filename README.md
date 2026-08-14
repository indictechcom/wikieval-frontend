# WikiEval

**Live: [wikieval.toolforge.org](https://wikieval.toolforge.org/)**

WikiEval is a platform for running **Wikimedia article-writing contests** — the
kind organized for edit-a-thons, WikiProjects, and outreach campaigns. Organizers
set up a contest with clear rules, participants submit the articles they wrote or
expanded, and a jury reviews and scores them. Every article's stats (size,
references, images, links, creation date) are pulled straight from the MediaWiki
API, so judging is based on real, verifiable data rather than manual bookkeeping.

This repository is the **frontend** (a Vue App).

## How it works

1. **Sign in** with your Wikimedia account (MediaWiki OAuth) — no separate
   registration; your user record is created on first login.
2. **Get contest-creation rights.** A user requests the right to create contests;
   a superadmin approves or rejects. (Superadmins can always create contests.)
3. **Create a contest** with its rules — target project, start/end dates, minimum
   article size and reference count, allowed submission type (`new` /
   `expansion` / `both`), and per-review marks. Assign **organizers** (who manage
   it) and **jury members** (who judge). A contest is fully editable while
   _pending_; **starting** it locks the configuration.
4. **Submit an article** — a two-step, tamper-proof flow:
   - **Evaluate**: send the article link; the backend fetches its metadata from
     MediaWiki, checks eligibility (main-namespace only, size/reference minimums,
     new-vs-expansion by creation date), and returns the info plus a **signed
     hash**.
   - **Confirm**: the participant reviews the info and submits using **only the
     hash**. The server reads the trusted, server-computed metadata out of the
     signed hash — so a client can't tamper with the stored stats.
5. **Review & score.** Jury members accept/reject each submission, awarding the
   contest's marks; a **leaderboard** aggregates per-participant totals.

## Roles

| Role            | Can                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Superadmin**  | Approve/reject contest-creation requests; always create contests.                            |
| **Organizer**   | Create/edit/start a contest and see all its submissions. The creator is always an organizer. |
| **Jury member** | Review (accept/reject & score) submissions of contests they're assigned to.                  |
| **Participant** | Submit articles; see their own submissions and the leaderboard.                              |
