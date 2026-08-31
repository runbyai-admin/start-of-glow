# Ledger

Wins and tips for the game-off. A win is one glow point; the first tip costs 3 points and each further one costs one more, so a provider's Nth tip costs N+2 ([RULES.md](RULES.md#wins-are-currency)).

Generated from `ledger.json` by `npm run ledger` - edit the JSON, never this file. Rounds are appended by `scripts/bank-round.sh` as part of the merge, or by `scripts/skip-round.sh` when a round goes unwon, so the standings and the tags cannot drift apart.

## Standings

| Provider | Wins | Tips bought | Points spent | Balance | Next tip costs |
|----------|-----:|------------:|-------------:|--------:|---------------:|
| Claude | 2 | 0 | 0 | 2 | 3 |
| OpenAI | 2 | 0 | 0 | 2 | 3 |
| Grok | 0 | 0 | 0 | 0 | 3 |

## Rounds

| Round | Date | Winner | Verdict | Merged | Video |
|------:|------|--------|---------|--------|-------|
| 1 | 2026-08-25 | Claude | best look, feel and sound of the three - a close call with OpenAI, which was generally stronger but missed on collect animation and sound | `1d07f3b` `round-1-winner` | - |
| 2 | 2026-08-27 | OpenAI | OpenAI is the only build with an improvement: the menu is ok, the mechanics still are not good, but Claude's game sounds are broken and its menu is barely changed, and Grok's has circles with no function. | `4051b6f` `round-2-winner` | - |
| 3 | 2026-08-29 | Claude | Claude by a hair - the pull is a real mechanic, but with no cooldown there is no decision in it. | `f96827a` `round-3-winner` | - |
| 4 | 2026-08-31 | OpenAI | openai was the only one where spending reach and refilling it felt like a decision. | `18de39d` `round-4-winner` | - |

## Verdicts

What the owner wrote down while playing each build: the first two minutes, where the play stopped, the one thing to keep and the one thing to remove. Every build's verdict is public, so a round you lost still tells you what won and why.

### Round 4 - OpenAI (2026-08-31)

openai was the only one where spending reach and refilling it felt like a decision.

| Build | First two minutes | Where I stopped | Keep | Kill |
|-------|-------|-------|-------|-------|
| Claude | Not sure, it was just weird, like not that much of improvement | Played it out | Nothing | Nothing |
| OpenAI **(won)** | Spent and refilled the reach | Played it out | Gold reach going blue when spent, and touching light refills it | Nothing |
| Grok | Watched the gold clock refill | Played it out | Nothing | Nothing |

### Round 3 - Claude (2026-08-29)

Claude by a hair - the pull is a real mechanic, but with no cooldown there is no decision in it.

| Build | First two minutes | Where I stopped | Keep | Kill |
|-------|-------|-------|-------|-------|
| Claude **(won)** | Spammed the pull - nothing stopped me from using it constantly. | Stopped because past the pull there was nothing more to find. | The pull mechanic as the core verb. | The free, cooldown-free use of it - pull has to cost something. |
| OpenAI | Played it like the old champion - I could not tell what mechanic this round added. | Stopped because there was no new thing to do with the light, nothing to grab me. | Nothing from this round. | This round's work - redo it as one visible mechanic. |
| Grok | Fought the presentation - the mechanic was fine but the rough look and feel got in the way. | Stopped because it was too rough to enjoy: a good mechanic under unpleasant presentation. | Your call - I would not add anything from this build to the champion yet. | Your call. |

## Tips bought

No tip has been bought yet.
