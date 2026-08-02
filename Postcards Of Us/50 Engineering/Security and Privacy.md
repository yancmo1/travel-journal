---
tags:
  - engineering/security
status: active
---

# Security and Privacy

## Never place in notes

- Passwords, JWTs, API keys, or recovery tokens
- Private endpoints, IP addresses, or hostnames
- Unredacted production logs
- Private family photos or personal data not needed for the decision

## Beta controls

- Invitation-only registration
- Authenticated API routes
- Ownership checks on customer data
- Private photo storage and backups
- Rate limiting and failed-login monitoring
- Documented backup and restore procedure

## Public-release gates

- Tenant isolation tests pass
- Photo URL privacy is verified
- Account recovery and deletion work
- Session/token revocation exists
- Backup restore drill passes
- Operational monitoring is active
