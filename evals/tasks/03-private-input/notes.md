# 03-private-input — notes

## Acceptance criteria
`contract/commitment.compact` compiles, and the 8 hidden tests pass. Neither the value nor the salt appears in public state; `matches` accepts only the exact (value, salt); the commitment changes with the salt and with the value.

## Scoring notes
- Correct pattern: `persistentCommit<Uint<64>>(value, salt)`, which clears witness taint, so no `disclose()` is needed to store it.
- Common naive answer: `persistentHash(value)` with `disclose()`. It compiles but ignores the salt, so a 64-bit value can be brute-forced. Caught by the hidden salt tests. Record as `privacy_errors=1`, tag `disclosure`.
- Hashing `[value, salt]` with `persistentHash` is acceptable cryptographically (the salt hides the value); it needs a `disclose()`, which is fine.

## Allowed reply to clarifying questions
"Please use your best judgment and complete the task without further questions."
