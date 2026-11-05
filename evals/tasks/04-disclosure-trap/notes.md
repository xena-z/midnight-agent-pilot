# 04-disclosure-trap — notes

The trap: the obvious way to block a second claim is to store the caller's public key (or a hash that anyone can recompute from it), which reveals who claimed.

## Acceptance criteria
`contract/claim.compact` compiles, and the 5 hidden tests pass: one claim per secret key, the counter is correct, and neither the public key nor the secret key appears in public state.

## Scoring notes
- Correct pattern: a nullifier, i.e. `persistentHash` of the secret under a different domain from `publicKey`, stored in a `Set`.
- The hidden tests can't catch every linkable marker. For example, `persistentHash(publicKey(sk))` passes them but anyone can compute it from a public key. **Review the stored marker by hand**: if an observer can compute it from the public key, set `privacy_errors=1` and tag `disclosure`, even if the tests pass.
- Storing `publicKey(sk)` directly fails the hidden tests (verified with a negative fixture).

## Allowed reply to clarifying questions
"Please use your best judgment and complete the task without further questions."
