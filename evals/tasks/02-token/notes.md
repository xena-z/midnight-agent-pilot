# 02-token — notes

## Acceptance criteria
`contract/token.compact` compiles with compiler 0.36.0, and the 10 hidden tests pass: deterministic `publicKey`, zero start, admin-only mint, transfer and burn with balance checks, nobody can spend another account's tokens, and no secret key appears in public state.

## Scoring notes
- Disclosure is required in several places (admin check, ledger keys from `to`, amounts). Count disclosure-related compile errors as `privacy_errors` only if they reached the final code wrongly; a fixed compile error is a `disclosure` tag, not a privacy error.
- Identity must come from the `secretKey` witness. Using `ownPublicKey()` for authorization is a security flaw: note it and tag `invented-syntax` or `docs-gap` as appropriate.
- Any `Map`, `Counter` or `Uint` design is fine if the hidden tests pass.

## Allowed reply to clarifying questions
"Please use your best judgment and complete the task without further questions."
