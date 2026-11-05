# 07-fix-it — notes

Starter = 02-token reference with three seeded bugs, each taken from a real failure in this pilot:
1. `const from = …` — `from` is a reserved word (all four 02-token runs hit this; F-11).
2. Missing `as Uint<64>` on `balanceAt(recipient) + value` (a setup R run hit this type error).
3. `totalSupply` declared without `export` (setup C on 06-consent; F-12).

Bugs 1–2 are compile errors; bug 3 compiles but fails the hidden tests (the field isn't in the generated `ledger()`).

## Acceptance criteria
Compiles with compiler 0.36.0, and the 10 hidden tests (same as 02-token) pass.

## Allowed reply to clarifying questions
"Please use your best judgment and complete the task without further questions."
