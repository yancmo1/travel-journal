# Postcards of Us email delivery status

**Last checked:** 2026-08-04
**Configured sender:** `Postcards of Us <postcards@shepswork.com>`
**Provider:** Resend

## Application status

- Invitation and password-recovery email code exists, with bounded retries and
  stable Resend idempotency keys.
- Email verification now has resend and one-time verification endpoints.
- Staging and production currently expose only the `JWT_SECRET` Worker secret;
  `RESEND_API_KEY` is not configured, so real delivery validation is blocked.

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

1. Verify `shepswork.com` (or the selected sending subdomain) in Resend.
2. Add `RESEND_API_KEY` to both the staging and production Worker secrets.
3. Confirm the sender address is accepted by Resend.
4. Invite a controlled staging address and verify receipt.
5. Exercise password reset, changed-password notification, and email
   verification; inspect the received headers for `spf=pass`, `dkim=pass`, and
   `dmarc=pass`.
6. Rotate the staging key if it was shared during testing, then add the
   production key separately.

Do not place API keys, reset tokens, verification tokens, or message contents
in this file or in Worker logs.
