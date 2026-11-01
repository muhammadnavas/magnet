# Finance Intelligence

Finance Intelligence captures likely payment notifications from a user-enabled Android Notification Listener and turns them into a transaction ledger.

## Setup

1. Set `EXPO_PUBLIC_API_URL` to the deployed FastAPI base URL, including `/api/v1` (for example, `https://your-api.example.com/api/v1`) in the environment used for the native Android build.
2. Run `backend/supabase/migrations/202610310001_finance_transactions.sql` and then `backend/supabase/migrations/202610310002_finance_spending_alerts.sql` in the Supabase SQL editor as the database owner. These create the transaction, spending-limit, push-device and alert-event tables, enable RLS, and deny direct anon/authenticated API-role access. FastAPI accesses the database using its server-side `DATABASE_URL`.
3. Generate a fresh Android native build and install it. This feature cannot be delivered by an Expo Go session or an OTA JavaScript update because it adds a native NotificationListenerService and React Native module.
4. Open Magnet → Finance → Enable automatic payment tracking. Android opens Notification access settings. The user must explicitly enable Magnet.
5. Make a small test payment or use a supported payment notification. Pull down to refresh Finance.

## Initial supported notification sources

The native listener allowlists Google Pay, PhonePe, Paytm, BHIM, selected Indian bank apps, CRED, and MobiKwik package IDs. This list is deliberately restrictive: unrelated notifications are ignored. Bank apps can change package IDs or notification formats, so the list and parser need device-level validation.

## Notification privacy and safety

The Android listener is protected by Android's `BIND_NOTIFICATION_LISTENER_SERVICE` permission and is enabled only after the user explicitly grants Notification Access in Settings. It inspects notifications only from the explicit payment-app package allowlist, skips ongoing notifications, and forwards only messages matching a payment cue plus an amount. Notifications containing OTPs, one-time passwords, verification/security/login codes, passcodes, CVVs, or UPI PIN references are rejected on-device and again by the backend. Notification text is sent to the configured backend over HTTPS; it is parsed for a transaction and is not stored as raw notification text. The Finance screen discloses this behavior and the user can revoke access in Android Settings.

Only notifications from the server- and client-side allowlisted packages that contain a payment cue and an amount are forwarded. The backend rejects timestamps older than 45 days or more than five minutes in the future. Inserts use an atomic unique-fingerprint conflict check, so concurrent duplicate callbacks do not create duplicate rows. The backend parses amount, merchant, category, transaction direction, source app, and timestamp. Raw notification text is not stored in the transaction table. Monthly queries use the device's timezone offset.

## Limitations

- Android only. iOS does not expose a general notification-listener API to third-party apps.
- Notifications can be absent, delayed, duplicated, edited, or ambiguous. This is an estimate of spending, not a bank statement or verified account balance.
- The first parser is rule-based. Review and correct categories/merchant names; transfers between the user's own accounts may be misclassified as income or expense.
- Initial category mapping is keyword-based, not an LLM decision.
- The Android native listener sends to the configured API URL. If the environment variable was not present at native build time, notifications will not sync; rebuild after setting it.
- Do not add OTP capture, notification-content logging, or broad notification forwarding.
- The app is currently in personal single-user mode and its existing get_current_user dependency is a fixed local profile, not real authentication. The allowlist is input validation, not caller authentication: a public endpoint can still be spoofed by a caller that forges an allowed package name. Keep the backend private or behind an authenticated gateway until proper device/user authentication and per-user data isolation are implemented.

## Backend spending-threshold alerts

1. Apply `backend/supabase/migrations/202610310002_finance_spending_alerts.sql` after the transaction migration.
2. In Finance, enable push notifications. The app requests OS notification permission, creates the Android `finance-alerts` channel, obtains an Expo push token, and registers it with the backend.
3. Create a monthly overall limit or a category-specific monthly limit. Leave category blank for the overall limit.
4. After a newly ingested expense is stored, the backend sums current-month expenses in the limit's timezone and checks 50%, 80%, and 100%.
5. A unique database constraint on limit + month + threshold prevents duplicate threshold alerts. The backend sends notifications through Expo Push API; tokens rejected as `DeviceNotRegistered` are disabled.

Limits are evaluated on successful new notification ingestion, not by a background scheduler. If a transaction arrives late, the threshold may be reached and notified at ingestion time. This uses the same notification-derived transaction ledger and is not a bank-authoritative balance. Android push delivery requires a valid Expo/EAS project configuration and a compatible installed native app. Push delivery and physical-device behavior still need testing.

## API

- `POST /api/v1/finance/ingest-notification`
- `GET /api/v1/finance/summary`
- `GET /api/v1/finance/transactions`
- `PATCH /api/v1/finance/transactions/{id}`
- `DELETE /api/v1/finance/transactions/{id}`
- `POST /api/v1/finance/ask`


## Play Protect distribution note

These least-privilege filters and the in-app disclosure improve privacy, but they cannot guarantee that Google Play Protect will stop warning about or blocking a sideloaded APK. Play Protect decisions are made by Google using app reputation, signing, distribution, and behavior signals. Do not disable Play Protect or attempt to bypass its checks. For broader distribution, use a verified, consistently signed release and Google Play internal testing, and follow Google's policy and review process for notification-listener access.
