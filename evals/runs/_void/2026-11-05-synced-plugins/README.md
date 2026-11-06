# Voided: account-synced plugins

P-02-token-r2 and r3 loaded 3 extra plugins (`legal`, `product-management`, `cowork-plugin-management`, source `@synced`) that Claude Code synced from the claude.ai account into `~/.claude-eval` partway through the session. The startup check voided both (19 non-builtin plugins, expected 16). Fixed by disabling them in `setups/eval-settings.json`; re-run as r4 and r5. See FRICTION_LOG F-13.
