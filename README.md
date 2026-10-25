# Devil Radar Connect

**Find a study partner or coding-interview partner without endless scheduling messages.**

Devil Radar Connect is a Discord bot that matches students who opt in to the **same study subject or interview topic**, finds overlapping availability, lets two independent personal agents negotiate a suitable session length, and asks **both students** to approve. Once confirmed, each receives an optional `.ics` calendar invitation.

> **Current availability:** This is a self-hosted prototype, not yet a publicly hosted bot with a verified one-click install link. To use it in a new Discord server, a server operator must run their own bot instance using the steps below. A running instance is required for commands to respond.

## What can I do with it?

- Request a study session for any course or topic you type (for example, calculus, chemistry, or a course code).
- Request a coding mock interview for any language or interview topic you type (for example, C++, JavaScript, system design).
- Keep **up to 10** matchmaking requests open at once.
- Match with opted-in students with the **same topic (case-insensitive), session type, difficulty**, and overlapping time windows.
- Let agents propose a time and negotiate a feasible duration while respecting both students' minimum durations.
- Review and explicitly **Approve** or **Decline**. A match is confirmed only after **both** users approve.
- Receive a downloadable `.ics` calendar file in Discord DMs. Adding it to a calendar is your choice.

### Using the bot (after a server administrator has installed and started it)

1. In a server with Devil Radar Connect running, type `/connect join`.
2. Choose **Study session** or **Mock interview**; enter your topic, difficulty, date, start/end times, preferred duration, and minimum duration. The date format is `YYYY-MM-DD`; times use **24-hour Arizona time** (`HH:mm`).
3. Repeat `/connect join` for other topics if desired; existing distinct requests remain active.
4. Run `/connect profile` to review your open requests.
5. Run `/connect find`. If a compatible partner exists, the bot sends approval buttons in a DM; if DMs are blocked, use `/connect pending` to access the buttons privately.
6. Each student clicks **Approve**. The first approval keeps the request pending; the second confirms the session and triggers `.ics` attachments in DMs.
7. Run `/connect leave` to opt out of all your active requests and cancel pending proposals.

**Example:** Two students choose a *data structures* mock interview. One is available 2–5 PM and prefers 60 minutes; the other is available 4–7 PM and prefers 45 minutes. Agents propose 4 PM and negotiate 45 minutes. The students independently approve before confirmation.

## Install and run your own Discord bot (server owner/developer)

**Prerequisites:** Node.js 20+, npm, a Discord account, permission to add bots to a test server, and the project source code. On macOS, Windows, or Linux:

```bash
 git clone https://github.com/JayP15/devil-radar-connect.git
 cd devil-radar-connect
 npm install
 npm test
 npm run demo
```

The last two commands validate the matching engine *without Discord*. To connect your own Discord application:

1. Open [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**; choose a name.
2. Open **Bot** and copy/reset its bot token. **Never post it or commit it.**
3. Open **Installation**. For Guild Install use `bot` and `applications.commands` scopes, with permission to **View Channels** and **Send Messages**. Use the generated installation URL to add **your** bot to **your** Discord server. You do not need Message Content intent for this bot.
4. Copy the application's **Application ID** under General Information.
5. In Discord enable **User Settings → Advanced → Developer Mode**, then right-click your server → **Copy Server ID**.
6. Create your local environment file:

```bash
cp .env.example .env
```

Fill in **your own values** in `.env`:

```dotenv
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_server_id
```

7. Register commands and launch the bot:

```bash
npm run register
npm start
```

Keep the terminal running. In your server type `/connect` and confirm `join`, `find`, `pending`, `profile`, and `leave` appear. Commands are registered for the **one guild** specified by `DISCORD_GUILD_ID`. This is not a globally hosted service.

### Troubleshooting

| Symptom | What to check |
| --- | --- |
| `/connect` commands do not appear | The bot was installed into the correct server; `applications.commands` was enabled; `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID` are correct; re-run `npm run register`. |
| Bot appears offline | `npm start` is still running; the token is correct. |
| `Use /join first` | Register at least one request with `/connect join` using the same Discord account. |
| No compatible partner found | Another user must opt in to a **matching type, topic, and difficulty** with overlapping availability. |
| No DM arrives | Enable DMs from server members, or run `/connect pending` to access a private approval prompt. |
| Match disappeared after switching machines | Data is stored locally in `.data/matches.json`, not on a hosted database. |

## How agent-to-agent negotiation works

`MATCH_REQUEST → COUNTER_PROPOSAL (when needed) → PROPOSAL_ACCEPTED → HUMAN APPROVAL A + B → CONFIRMED`

Two independently scoped, **deterministic rule-based agents** evaluate their respective students' duration and time constraints. The coordinator prevents incompatible matches, checks approvals against authenticated Discord users, blocks overlapping bookings, and maintains a visible negotiation trace. **This version does not use an LLM or make claims of autonomous generative reasoning.**

## Privacy, persistence, and limitations

- Participation is opt-in. The bot stores selected matching preferences, Discord user IDs, proposals, and approvals on the machine hosting the bot.
- It does **not** read Gmail, Canvas, grades, student emails, or contact details.
- A separate running bot instance is required per self-hosted deployment; it is not currently a public always-on service.
- Data persists in `.data/matches.json` between restarts. Do not commit that file or `.env` to GitHub. `.gitignore` excludes both.
- Topics are user-entered but matches currently use **case-insensitive exact equality**, not semantic similarity. E.g., `CSE 110` and `intro programming` do not automatically match.
- Availability is currently limited to a **single day** per request and uses Arizona time (`America/Phoenix`, UTC−7).
- The bot does not create video calls or write to calendars. It sends optional `.ics` attachments after both approvals. Discord DMs must be available to receive attachments.
- This is a functional prototype, not yet a production-ready multi-server service; there is no shared hosted database or public uptime commitment.

## Repository and verification

Source: https://github.com/JayP15/devil-radar-connect

Run `npm test` for automated tests, `npx tsc --noEmit` for TypeScript checks, and `npm run demo` to see a complete negotiation without Discord.
