# Voided: setups A, B, R, tasks 01–05, run 1 (2026-11-05)

The per-run access policy allowed the pinned Midnight Expert clone in every setup, and Claude Code lists
additional working directories in the agent's instructions. So agents in setups that must have no Midnight
Expert (A, B, R) were told where it was and could read it. Three of these 15 runs did:
A-05-sealed-vote (4 tool calls), B-02-token (4), B-05-sealed-vote (2).

All 15 runs are void because all were exposed, not only the three that looked. They were re-run with the
clone allowed only in setup C, and with a contamination check that voids any A/B/R run touching it.
Setup C runs were not affected and were kept. See FRICTION_LOG F-10.
