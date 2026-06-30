# Security Policy

## Scope

This project handles personal API credentials (Jira, GitHub, Slack, Google, Telegram). A misconfiguration could expose those tokens. Please report any vulnerability that could lead to credential leakage, unauthorized API access, or remote code execution.

---

## Supported versions

Only the latest commit on `main` is actively maintained.

---

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Send a report to **fjbatresv@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- (Optional) a suggested fix

You can expect an acknowledgment within 72 hours and a resolution timeline within 7 days for confirmed issues.

---

## Security best practices for self-hosting

This project is designed to run on a private homelab. To reduce risk:

1. **Never commit `.env`** — it is listed in `.gitignore`. Verify with `git status` before pushing.
2. **Use Cloudflare Tunnel or a VPN** — do not expose port 8090 directly to the internet.
3. **Rotate tokens regularly** — especially `GITHUB_TOKEN` and `SLACK_USER_TOKEN`.
4. **Restrict Google OAuth scopes** — only grant `calendar.readonly`.
5. **SQLite file permissions** — ensure `./data/portal.db` is readable only by the Docker process.
6. **Redis** — the Redis container is not exposed to the host by default. Do not change this without adding authentication.

---

## Known non-issues

- The Telegram bot token is only used for outbound messages (`sendMessage`). It cannot be used to read your messages.
- The Slack User Token (`xoxp-`) is scoped to `search:read` — it cannot post or modify messages.
