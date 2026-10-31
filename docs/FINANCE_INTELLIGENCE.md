# Finance Intelligence

Finance Intelligence captures likely payment notifications from a user-enabled Android Notification Listener and turns them into a transaction ledger.

## Setup

1. Set `EXPO_PUBLIC_API_URL` to the deployed FastAPI base URL, including `/api/v1` (for example, `https://your-api.example.com/api/v1`) in the environment used for the native Android build.
2. Run `backend/supabase/migrations/202610310001_finance_transactions.sql` in the Supabase SQL editor as the database owner. The migration creates the transaction table, enables RLS, and denies direct anon/authenticated API-role access. FastAPI accesses the database using its server-side `DATABASE_URL`.
3. Generate a fresh Android native build and install it. This feature cannot be delivered by an Expo Go session or an OTA JavaScript update because it adds a native NotificationListenerService and React Native module.
4. Open Magnet → Finance → Enable automatic payment tracking. Android opens Notification access settings. The user must explicitly enable Magnet.
5. Make a small test payment or use a supported payment notification. Pull down to refresh Finance.

## Initial supported notification sources

The native listener allowlists Google Pay, PhonePe, Paytm, BHIM, selected Indian bank apps, CRED, and MobiKwik package IDs. This list is deliberately restrictive: unrelated notifications are ignored. Bank apps can change package IDs or notification formats, so the list and parser need device-level validation.

## What is captured

Only notifications from the server- and client-side allowlisted packages that contain a payment cue and an amount are forwarded. The backend rejects timestamps older than 45 days or more than five minutes in the future. Inserts use an atomic unique-fingerprint conflict check, so concurrent duplicate callbacks do not create duplicate rows. The backend parses amount, merchant, category, transaction direction, source app, and timestamp. Raw notification text is not stored in the transaction table. Monthly queries use the device's timezone offset.

## Limitations

- Android only. iOS does not expose a general notification-listener API to third-party apps.
- Notifications can be absent, delayed, duplicated, edited, or ambiguous. This is an estimate of spending, not a bank statement or verified account balance.
- The first parser is rule-based. Review and correct categories/merchant names; transfers between the user's own accounts may be misclassified as income or expense.
- Initial category mapping is keyword-based, not an LLM decision.
- The Android native listener sends to the configured API URL. If the environment variable was not present at native build time, notifications will not sync; rebuild after setting it.
- Do not add OTP capture, notification-content logging, or broad notification forwarding.
- The app is currently in personal single-user mode and its existing get_current_user dependency is a fixed local profile, not real authentication. The allowlist is input validation, not caller authentication: a public endpoint can still be spoofed by a caller that forges an allowed package name. Keep the backend private or behind an authenticated gateway until proper device/user authentication and per-user data isolation are implemented.

## API

- `POST /api/v1/finance/ingest-notification`
- `GET /api/v1/finance/summary`
- `GET /api/v1/finance/transactions`
- `PATCH /api/v1/finance/transactions/{id}`
- `DELETE /api/v1/finance/transactions/{id}`
- `POST /api/v1/finance/ask`
