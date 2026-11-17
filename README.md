# neon-swarm

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ozekimasaki/neon-swarm/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ozekimasaki/neon-swarm/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**NEON SWARM** — an original neon arena-survival game. One ship, a closing swarm, and
150 seconds on the clock. Move with WASD / arrow keys, aim with the mouse (your cannon
auto-fires), dash through the pack with Space, and scoop up the shards your kills drop.
Every level lets you pick one of three upgrades — split cannons, orbit blades, nano
plating and more — so each run builds a different ship. Survive all 150 seconds to win;
if your hull hits zero, your score is how long you held the line.

Everything is made in code: the vector art, the particles, and the synthesized WebAudio
sound effects. No assets, no libraries, no network — the whole game is static files
under `game/` and plays offline in a desktop browser.

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080
# or open game/index.html through any static file server
node main.ts             # hands the entry in: writes /output with dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=p1qgasbe&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
