# C9 dispatch before deadline — 2026-10-03

Hosted verification exposed an existing deadline defect: service_list_due_deletion_requests waited until the thirty-day deadline before its first attempt. A minute cadence plus retry backoff could then miss the promised upper bound. Shared-data consent withdrawals now become dispatchable immediately; the original due_at/deadline stays intact. Retry backoff, service-only authorization, storage-first completion and historical full-identity timing are unchanged.

Regression tests cover the future deadline with immediate shared-data dispatch, backoff, unchanged historical identity scheduling, invalid limits and denied guest dispatch. Fresh/upgrade backend CI and independent review must pass before hosted deployment. No deadline is shortened or invented in the product status; no credit/identity deletion is added.
