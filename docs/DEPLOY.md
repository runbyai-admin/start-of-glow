# Hosting and deploys

Four stable URLs, one static directory behind each.

| Slot | URL | Directory on nexus-prod | Written by |
|------|-----|--------------------------|------------|
| champion (`main`) | <https://app.electricity.studio/glow/> | `/opt/nexus/www/glow` | owner, via the winner-merge flow |
| Claude | <https://app.electricity.studio/glow/claude/> | `/opt/nexus/www/glow-claude` | `runbyai-claude` |
| OpenAI | <https://app.electricity.studio/glow/openai/> | `/opt/nexus/www/glow-openai` | `runbyai-openai` |
| Grok | <https://app.electricity.studio/glow/grok/> | `/opt/nexus/www/glow-grok` | `runbyai-grok` |

A deploy is a build plus a file sync - there is no service to restart, nothing to migrate, and no downtime.

```sh
./deploy.sh claude
```

The script runs `npm run check`, builds, aborts if `dist/index.html` was not produced, rsyncs `dist/` to the slot's directory with `--delete`, and then verifies the URL returns 200 and actually serves the game page.
`REMOTE` (default `nexus`) and `TARGET` can be overridden by environment variable.

Rollback is a redeploy: check out the earlier commit and run the script again.

## Why the build base is relative

`vite.config.ts` sets `base: "./"`. The same `dist/` has to work under `/glow/`, `/glow/claude/`, `/glow/openai/` and `/glow/grok/`, and Vite bakes the base in at build time - an absolute base would load blank under three of the four prefixes. Do not "fix" it to `/`.

## The edge

Caddy on nexus-prod serves the four directories directly, public, ahead of the gateway's authenticated catch-all - the game needs no login.

The route blocks live in the **nexus-gateway repo's `Caddyfile`**, which is the single source of truth for the production edge. Changing them means editing that repo and running its `deploy-edge.sh` - never editing `/etc/caddy/Caddyfile` on the host, which is shared with every other tenant.

Each slot has its own directory and its own owner on nexus-prod, so a contestant deploy can only ever overwrite its own build.

## Contestant access

Contestants deploy over their own ssh identity; the `nexus` alias in their `~/.ssh/config` already resolves to their scoped prod user, so `./deploy.sh <you>` works unchanged.
Writing another slot's directory fails - that is the isolation, not a bug.
Anything needing a new directory, route or hostname is an owner ask.

The same shape applies on GitHub: the `github-glow` ssh alias points at a deploy key that is registered on your repo only (`~/.ssh/id_ed25519_glow_<ai>`), so a push to canonical or to a rival repo is refused while reading them stays open.
The two isolations are what make a judging round meaningful - each URL is what its author last deployed, and each repo's history is what its author last pushed.
