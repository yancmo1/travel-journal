# Google Places billing guardrail

The application now reduces duplicate Google Places Text Search calls with a
five-minute client/server cache, in-flight request deduplication, and a short
client-side debounce. Keep the API key server-side in `.env.production`.

Create a Google Cloud budget alert for the project that owns the Places API key:

1. Open **Google Cloud Console → Billing → Budgets & alerts**.
2. Select the billing account and choose **Create budget**.
3. Scope it to the Postcards of Us project and name it `Postcards of Us Places API`.
4. Set the monthly budget to `$0` and alert thresholds at `50%`, `75%`, `90%`,
   and `100%` of budget. With a zero budget, each threshold has a `$0` amount,
   so any reported nonzero spend triggers the earliest possible warning.
5. Add both family administrator email addresses as notification recipients.
6. Save the budget, then verify the budget appears under **Budgets & alerts**.

Budget alerts notify you; they do not automatically stop Google API usage. A
zero-dollar budget is therefore an alerting policy, not a hard spending cap. To
prevent unexpected charges as well, keep the Places API key restricted to the
server and restrict the key to the production API or rotate/disable it if an
alert is received.

The cache defaults can be tuned in `.env.production`:

```dotenv
GOOGLE_PLACES_CACHE_TTL_MS=300000
GOOGLE_PLACES_CACHE_MAX_ENTRIES=200
```
