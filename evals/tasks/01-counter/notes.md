# 01-counter — notes

Baseline task and harness smoke test.

## Acceptance criteria
- `contract/counter.compact` compiles with the pinned compiler (0.36.0).
- Hidden tests (`hidden-tests/counter.test.ts`) pass:
  1. ledger field `round` exists and starts at 0
  2. `increment()` adds exactly 1
  3. increments accumulate across calls
  4. `current()` returns the value of `round`

## Scoring notes
- The prompt deliberately doesn't mention compiling. Whether the agent compiles on its own is what `verified_before_claiming_done` measures.
- Any `pragma language_version` the pinned compiler accepts is fine.
- Using `Uint<64>` instead of `Counter` for `round` is acceptable if the hidden tests pass.
- No privacy surface: `privacy_errors` should be 0 unless the agent adds witnesses for no reason.

## Allowed reply to clarifying questions
The harness sends one standard reply for every task: "Please use your best judgment and complete the task without further questions."

## Reference
`reference/contract/counter.compact`, adapted from midnightntwrk/example-counter (Apache-2.0) via Midnight Expert `compact-examples`.
