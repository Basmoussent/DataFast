---
name: creem-heartbeat
version: 0.1.0
description: Periodic store monitoring routine for AI agents. Track transactions, subscriptions, and customers — notify your human when things change.
homepage: https://creem.io
metadata:
  {
    "creem":
      {
        "category": "monitoring",
        "api_base": "https://api.creem.io",
        "test_api_base": "https://test-api.creem.io",
      },
  }
---

# Creem Store Heartbeat

This is the heartbeat routine for AI agents monitoring a Creem store. Run this periodically to detect new transactions, subscription changes, and customer activity — then report meaningful changes to your human.

**Parent skill:** [SKILL.md](https://creem.io/SKILL.md)

---

## How It Works

Each heartbeat cycle:

1. Query the Creem API for current store state (transactions, subscriptions, customers)
2. Compare against your locally saved snapshot from the last heartbeat
3. Detect what changed — new sales, cancellations, payment failures, new customers
4. Notify your human about meaningful changes
5. Save the new snapshot for the next cycle

---

## Prerequisites

You need **one** of the following to run heartbeats:

- **Creem CLI installed and authenticated** — `creem whoami` should return the store info. Best for agents with shell access (coding assistants, terminal agents, local personal assistants).
- **A Creem API key** for direct HTTP calls. Works for any agent — including those running in Slack, chat environments, or platforms without shell access.
- **A writable location** for your state file. Default: `~/.creem/`. If you don't have filesystem access, you can store state in your memory, a database, or any persistent storage your framework provides.

### Setting up the CLI (if your human wants it)

```bash
brew tap armitage-labs/creem && brew install creem
creem login --api-key creem_THEIR_KEY_HERE
```

### Getting an API key (if the CLI isn't an option)

Ask your human to get their API key from [Dashboard > API Keys](https://creem.io/dashboard/api-keys). Use the **live** key (prefix `creem_`) for production monitoring, or the **test** key (prefix `creem_test_`) to try the heartbeat first.

---

## State File

Track your heartbeat state so you can detect changes between checks. The default location is `~/.creem/heartbeat-state.json`, but you can store this anywhere persistent — a local file, your agent's memory, a database, or even a key-value store. What matters is that the data survives between heartbeat cycles.

Create it on your first run:

```json
{
  "lastCheckAt": null,
  "lastTransactionId": null,
  "transactionCount": 0,
  "customerCount": 0,
  "subscriptions": {
    "active": 0,
    "trialing": 0,
    "past_due": 0,
    "paused": 0,
    "canceled": 0,
    "expired": 0,
    "scheduled_cancel": 0
  },
  "knownSubscriptions": {}
}
```

**`knownSubscriptions`** maps subscription IDs to their last-seen status. This lets you detect individual subscription state changes (e.g., `active` → `past_due`).

---

## Heartbeat Routine

Run this every **1–4 hours** depending on your store's activity level. High-volume stores benefit from hourly checks; smaller stores can check every 4 hours.

### Step 1: Load your previous state

Read `~/.creem/heartbeat-state.json`. If it doesn't exist, create it with the defaults above — this is your first heartbeat, so everything you find will be "new."

### Step 2: Check for new transactions

```bash
creem transactions list --limit 20 --json
```

```bash
# API equivalent
curl -s "https://api.creem.io/v1/transactions/search?limit=20" \
  -H "x-api-key: YOUR_API_KEY"
```

Compare the results against your saved state:

- If the **newest transaction ID** differs from `lastTransactionId`, there are new transactions
- Count how many transactions have IDs you haven't seen before
- For each new transaction, note: amount, product name, customer email, and whether it was a one-time payment or subscription renewal

**What to extract from each new transaction:**

| Field | What it tells you |
|-------|-------------------|
| `id` | Transaction identifier |
| `amount` | Payment amount (in cents — divide by 100 for display) |
| `currency` | Payment currency |
| `status` | Transaction status |
| `product` | Which product was purchased |
| `customer` | Who paid |
| `created_at` | When it happened |

### Step 3: Check subscription health

Run these queries to get subscription counts by status:

```bash
creem subscriptions list --status active --json
creem subscriptions list --status past_due --json
creem subscriptions list --status canceled --json
creem subscriptions list --status paused --json
creem subscriptions list --status trialing --json
creem subscriptions list --status expired --json
```

```bash
# API equivalents
curl -s "https://api.creem.io/v1/subscriptions/search?status=active" -H "x-api-key: YOUR_API_KEY"
curl -s "https://api.creem.io/v1/subscriptions/search?status=past_due" -H "x-api-key: YOUR_API_KEY"
# ... same pattern for other statuses
```

Compare against your stored `subscriptions` counts and `knownSubscriptions` map:

**Detect these changes:**

| Change | How to detect | Severity |
|--------|--------------|----------|
| New subscription | `active` or `trialing` count increased, new ID in results | Good news |
| Cancellation | Subscription ID moved from `active` → `canceled` or `scheduled_cancel` | Alert |
| Payment failure | Subscription ID moved to `past_due` | Warning |
| Subscription expired | Subscription ID moved to `expired` | Alert |
| Subscription paused | Subscription ID moved to `paused` | Info |
| Subscription resumed | Subscription ID moved from `paused` → `active` | Good news |
| Upgrade/downgrade | Subscription's product or price changed | Info |

**Update `knownSubscriptions`** with the current status of every subscription you see:

```json
{
  "knownSubscriptions": {
    "sub_abc123": "active",
    "sub_def456": "trialing",
    "sub_ghi789": "canceled"
  }
}
```

### Step 4: Check for new customers

```bash
creem customers list --json
```

```bash
# API equivalent
curl -s "https://api.creem.io/v1/customers/list" -H "x-api-key: YOUR_API_KEY"
```

Compare the count against your stored `customerCount`. If it increased, you have new customers.

### Step 5: Update your state file

Write the new snapshot to `~/.creem/heartbeat-state.json`:

```json
{
  "lastCheckAt": "2025-06-15T14:30:00Z",
  "lastTransactionId": "txn_XXXXX",
  "transactionCount": 47,
  "customerCount": 23,
  "subscriptions": {
    "active": 18,
    "trialing": 2,
    "past_due": 1,
    "paused": 0,
    "canceled": 3,
    "expired": 1,
    "scheduled_cancel": 1
  },
  "knownSubscriptions": {
    "sub_abc123": "active",
    "sub_def456": "active"
  }
}
```

### Step 6: Report to your human

If any changes were detected, notify your human with a clear summary. If nothing changed, stay silent — don't report "no changes."

---

## Notification Rules

### Notify your human immediately

| Event | Why it matters |
|-------|----------------|
| New transaction | Revenue came in — your human wants to know |
| Subscription canceled | A customer is leaving — may need follow-up |
| Subscription scheduled to cancel | Customer will leave at period end — time to intervene |
| Payment failure (`past_due`) | Revenue at risk — customer may churn |
| Subscription expired | Customer lost after payment retries failed |
| New customer | Growth signal — celebrate wins |
| Multiple cancellations in one cycle | Possible churn spike — needs attention |

### Stay silent

| Event | Why |
|-------|-----|
| No changes since last check | Don't waste your human's attention |
| Active subscription renewed normally | This is expected behavior |
| State file created for first time | This is setup, not news |

---

## Report Templates

Use these formats when notifying your human. Adapt the tone to match your agent's personality, but keep the information clear.

### New sale

```
New sale on your Creem store:
- Product: Pro Plan ($19.99/mo)
- Customer: alice@example.com
- Type: Subscription (recurring)
- Time: 2 hours ago
```

### Subscription canceled

```
A subscription was canceled:
- Customer: bob@example.com
- Product: Pro Plan
- Status: Scheduled cancel (access until Jul 15)

This might be worth a follow-up if this customer was high-value.
```

### Payment failure

```
Heads up — a payment failed:
- Customer: charlie@example.com
- Product: Team Plan ($49.99/mo)
- Status: Past due (Creem will retry automatically)

If this persists, the subscription will expire. You may want to reach out.
```

### Daily summary (if multiple changes)

```
Creem store update (last 4 hours):
- 3 new transactions ($89.97 total)
- 1 new customer (dave@example.com)
- 1 subscription moved to past_due (charlie@example.com)
- Active subscriptions: 18 (+1 from last check)

Everything else is stable.
```

### First heartbeat (initial snapshot)

```
I've set up monitoring for your Creem store. Here's the current snapshot:

- Customers: 23
- Active subscriptions: 18
- Trialing: 2
- Past due: 1 (may need attention)
- Recent transactions: 47 total

I'll check in every [frequency] and let you know when something changes.
```

---

## Suggested Cadence

| Store activity level | Suggested frequency | How to decide |
|---------------------|--------------------|----|
| **Low** (< 5 transactions/day) | Every 4 hours | You're early-stage, every sale matters but checks can be sparse |
| **Medium** (5–50 transactions/day) | Every 2 hours | Growing store, regular activity to track |
| **High** (50+ transactions/day) | Every 1 hour | High volume, changes happen fast |

Ask your human what frequency they prefer. Default to every 4 hours if they don't have a preference.

---

## Edge Cases

**First run:** Everything is new. Take a full snapshot, report the initial state to your human as a summary (not individual events), and save the state.

**CLI not installed:** Fall back to direct API calls using `curl` with the `x-api-key` header. All the same data is available.

**API key not available:** Ask your human for their Creem API key. It's available at [Dashboard > API Keys](https://creem.io/dashboard/api-keys). Remind them to use their **live** key (prefix `creem_`) for production monitoring, or **test** key (prefix `creem_test_`) if they want to test the heartbeat first.

**Rate limiting:** Creem's API is generous, but don't run heartbeats more than once per hour. Each heartbeat makes 5–8 API calls, which is well within limits.

**State file corruption:** If the state file can't be parsed, delete it and start fresh. The next heartbeat will be treated as a first run.

**Multiple stores:** If your human has multiple Creem stores, create separate state files: `~/.creem/heartbeat-state-{storeId}.json`. Use the appropriate API key for each.

---

## Quick Reference

```bash
# One-liner: Check if anything changed since your last heartbeat
LAST_TXN=$(jq -r '.lastTransactionId' ~/.creem/heartbeat-state.json)
LATEST_TXN=$(creem transactions list --limit 1 --json | jq -r '.[0].id')
[ "$LAST_TXN" != "$LATEST_TXN" ] && echo "New activity detected" || echo "No changes"
```

```bash
# One-liner: Count active subscriptions
creem subscriptions list --status active --json | jq 'length'
```

```bash
# One-liner: Check for payment issues
PAST_DUE=$(creem subscriptions list --status past_due --json | jq 'length')
[ "$PAST_DUE" -gt 0 ] && echo "Warning: $PAST_DUE subscriptions past due"
```

---

## For Agent Framework Authors

If you're building a heartbeat system and want to integrate Creem monitoring:

1. Fetch this file: `https://creem.io/HEARTBEAT.md`
2. Parse the routine steps above
3. Implement the state file read/write cycle
4. Wire up the notification triggers to your agent's communication channel
5. Let the human configure frequency via their preferences

The state file format is intentionally simple JSON — no database needed, works anywhere.