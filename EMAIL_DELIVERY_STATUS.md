# Postcards of Us email delivery status

**Last checked:** 2026-08-05
**Configured sender:** `Postcards of Us <postcards@mail.postcardsofus.com>`
**Provider:** Resend

## Application status

- Invitation and password-recovery email code exists, with bounded retries and
  stable Resend idempotency keys.
- Email verification now has resend and one-time verification endpoints.
- The historical Sites project has a configured but non-exportable
  `RESEND_API_KEY` secret. The direct Worker cannot inherit that secret.
- The refreshed local ShepsWork hub key was validated with a controlled send
  from `postcards@shepswork.com` and Resend returned HTTP 200.
- `mail.postcardsofus.com` is now verified in Resend and is the new transactional
  sending domain for the application. A post-cutover controlled send remains
  the final delivery check.
- `RESEND_API_KEY` is now configured in both the staging and production direct
  Workers. Its value is never stored in this repository.

## DNS observations

The current public DNS records for `shepswork.com` show:

- Root SPF: `v=spf1 include:_spf.mx.cloudflare.net ~all`
- `resend._domainkey.shepswork.com` has a DKIM public key.
- `_dmarc.shepswork.com` has no TXT record.
- `send.shepswork.com` has a separate Amazon SES SPF record.

The DKIM record is present, but the active Resend domain status still needs to
be confirmed in Resend. The root SPF and `send` subdomain SPF should not be
changed or combined by guesswork; use the exact records shown for the domain
configured in Resend. Add DMARC in monitoring mode first, then tighten the
policy after a real message passes SPF/DKIM alignment.

## Staging validation sequence

1. Confirm `mail.postcardsofus.com` remains verified in Resend.
2. Add `RESEND_API_KEY` to both the staging and production Worker secrets.
3. Confirm `postcards@mail.postcardsofus.com` is accepted by Resend.
4. Invite a controlled staging address and verify receipt.
5. Exercise password reset, changed-password notification, and email
   verification; inspect the received headers for `spf=pass`, `dkim=pass`, and
   `dmarc=pass`.
6. Rotate the staging key if it was shared during testing, then add the
   production key separately.

Do not place API keys, reset tokens, verification tokens, or message contents
in this file or in Worker logs.
