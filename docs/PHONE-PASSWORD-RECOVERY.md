# Phone-first password recovery

Recovery starts with the verified mobile number and a purpose-bound three-minute RESET SMS. No device ID is entered. After valid proof, a single account proceeds directly to the new password fields; multiple accounts show friendly names with IDs for disambiguation. Only the selected account password changes and its browser sessions are revoked. Other accounts and desktop credentials are preserved.

Account names are never disclosed before SMS verification. Challenges bind the original account generation, verified mobile and credential hash (or exact account set). Password, phone, generation or account-set changes invalidate stale proof. Codes retain five-attempt limits, expiry, one-time consumption, proof of work, cooldowns and generic request receipts. Legacy username-bound recovery remains compatible. Recovering the old phone number still requires support.

Tests cover phone-only and legacy recovery, named selection, wrong codes, unrelated targets, stale credentials, replay, session revocation/isolation and a 390px browser flow. Production was not changed by these local tests.
