# Devil Radar Connect — Track 2

**Opt-in peer mock interviews coordinated by two independent personal agents through Discord.**

Each student opts into a **mock interview or study session** and provides topic, difficulty, preferred/minimum session duration, and a one-day availability window. Student A's agent proposes a session; Student B's agent independently evaluates it and may counter. Both agents verify the final choice against their own student's constraints, then Discord requests **separate explicit approvals** from each student. Only two approvals confirm the session.

## 1. Run without Discord first

Requires Node.js 20+.

```bash
npm install
npm test
npm run demo
```

The demo prints a 60-minute request, a 45-minute counterproposal, and pending/confirmed status after each approval.

## 2. Create a Discord bot

1. Go to https://discord.com/developers/applications and create an application.
2. Open **Bot**, create/reset the token, and copy it securely. Never commit it.
3. Under **Installation** (or OAuth2 URL Generator), grant the `bot` and `applications.commands` scopes. The bot only needs **Send Messages**, **View Channels**, and **Use Slash Commands**. Add the bot to a test server where both students are members.
4. Enable Discord **Developer Mode** in Settings > Advanced. Right-click your server and **Copy Server ID**.
5. Copy the application ID from General Information.
6. `cp .env.example .env`, then fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`.
7. `npm run register` then `npm start`.

## 3. Demo with two Discord accounts

Both students run `/connect join` with `kind=interview` using **the same future date**, topic `Java`, and difficulty `medium`:

- Student A: start `14:00`, end `17:00`, preferred `60`, minimum `45`.
- Student B: start `16:00`, end `19:00`, preferred `45`, minimum `45`.

Student A runs `/connect find`. The agents propose 60 minutes at 4 PM Arizona time, counter with 45 minutes, then accept. Both students get separate approval buttons. If DMs are blocked, use `/connect pending` in the server (ephemeral response). Student A approves: still **pending**. Student B approves: **confirmed**. `/connect leave` opts out.

## Design and security

- Distinct agent instances evaluate their students' own constraints. A coordinator validates the agreement and tracks human approvals.
- Discord identity is taken from authenticated interactions, never typed IDs.
- No Gmail, Canvas, grade, or personal contact data is accessed or shared.
- No unapproved calendar creation, external invitation, or direct message to an unknown third party occurs. Matching is limited to opted-in users.
- Time windows use Arizona time (`America/Phoenix`, UTC−7). In this hackathon version only one-day windows are supported.
- Profiles, matches, and approvals are persisted locally in `.data/matches.json` with atomic writes and reload on restart. Never commit this file; it contains student identifiers and availability. It is not a hosted multi-instance database.
- Negotiation is intentionally deterministic to guarantee a reproducible, auditable demonstration; **no LLM API is used or claimed**. Personal agents are independent constraint-handling modules with a documented message exchange.

## Agent protocol

`MATCH_REQUEST` → optional `COUNTER_PROPOSAL` → `PROPOSAL_ACCEPTED` → two distinct Discord user approvals → `CONFIRMED`.

Failure cases: incompatible topics, no overlapping time, insufficient duration, unauthorized approval, opt-out, or decline. Each fails closed.

## Limitations

This is a working Discord prototype, not a production marketplace: local file persistence only (not shared cloud storage), no verified calendar integrations, no automatic call links, and no arbitrary LLM negotiation. Slash commands are server-scoped for quick registration. Study sessions are supported by `kind=study` in `/connect join`; they only match others seeking study sessions with the same topic and difficulty. No automated call link or calendar event is created.

## Hackathon demonstration and submission

- **Live test:** two Discord accounts opted in, negotiated 60 → 45 minutes, independently approved, and the bot confirmed the session.
- **Agent information exchange:** session type, topic, difficulty, suggested start, and preferred duration. Gmail, Canvas, and course records are never read.
- **Human-in-the-loop:** neither personal agent can confirm a session without the two authenticated students clicking Approve.
- **Reproduce:** `npm install && npm test && npm run demo`; for Discord create `.env`, run `npm run register`, then `npm start` and follow the two-user demo above.
- **What is AI here?** The prototype uses independent rules-based personal agents for deterministic negotiation, not LLMs. It intentionally demonstrates verifiable agent-to-agent coordination rather than claiming unconstrained LLM autonomy.
