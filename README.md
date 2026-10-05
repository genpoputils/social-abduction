# GENPOPUTILS PLAY — MIDNIGHT VILLAGE

> **Trust no one.**

A 100% browser-based top-down 2D multiplayer social-deduction game set in an isolated research settlement.

Players navigate an illustrated 2D world, complete critical facility repair objectives, identify hidden impostors, report fallen crew members, deliberate in emergency council meetings, and vote out suspects.

Target hosting: **GitHub Pages** (`play.genpoputils.com`)  
Infrastructure cost: **$0/month** (Zero backend runtime, zero WebSocket server, zero database, zero user accounts).

---

## 1. Product & Architecture Overview

Midnight Village is architected around a **pure client-side, host-authoritative peer-to-peer model**:

- **Angular 19 (Standalone)**: Application shell, character suit selection, room chamber lobby, task mini-game modals, emergency council meeting & voting overlays, victory statistics, and routing.
- **Phaser 3 Engine**: Top-down 2D canvas rendering, 2400x1800 research settlement map with 10 distinct rooms, arcade physics with wall collisions, illustrated player sprites with walking animations, direction facing, dead bodies, and ghost noclip movement.
- **WebRTC DataChannels**: Direct peer-to-peer communication for 20Hz movement synchronization, task completions, sabotages, kills, body reports, and council chat.
- **Web Audio API**: Procedurally synthesized sound effects (emergency sirens, council gavels, task chimes, victory fanfare) without external audio asset downloads.

```
                         HOST BROWSER
             (Authoritative MidnightVillageGame)
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
          Player B     Player C     Player D
             │            │            │
             └────────── WebRTC ───────┘
```

---

## 2. The 2D Settlement Map

The game takes place in the **Midnight Research Settlement**, featuring 10 interconnected zones:

1. **Central Square**: Main spawn area and Emergency Meeting table with illuminated emergency siren.
2. **Laboratory**: Chemical centrifuge and microscope wiring tasks.
3. **Power Station**: Auxiliary circuit breakers and power conduit repair.
4. **Observatory**: Telescope alignment and signal oscilloscope sync.
5. **Greenhouse**: Hydroponic planter beds and irrigation valve calibration.
6. **Communications**: Radar antenna array and telemetry frequency tuning.
7. **Medical Center**: Biological scanner pods and vitals monitoring.
8. **Storage**: Heavy titanium fuel containers and cargo purge valves.
9. **Workshop**: Robotic calibration rig and pneumatic gear assemblies.
10. **Dormitories**: Crew bunks, lockers, and privacy partitions.

---

## 3. Character Archetypes

Players can select from 8 distinct settlement suits:

- 🔶 **Engineer** (Amber Hazard Suit)
- 🟣 **Scientist** (Radiation Violet Gear)
- 🔷 **Medic** (Clinical Cyan Coat)
- 🟢 **Botanist** (Emerald Hydroponic Suit)
- 🔴 **Mechanic** (Crimson Heavy Overhaul)
- 🔵 **Researcher** (Cobalt Telemetry Gear)
- 🩵 **Scout** (Teal Perimeter Surveyor)
- 🔘 **Security Officer** (Charcoal Tactical Armor)

---

## 4. Game Rules & Loop

```
LOBBY ➔ EXPEDITION LAUNCH ➔ ROAMING & TASKS ➔ ELIMINATION / SABOTAGE
  ▲                                                      │
  │                                                      ▼
  │                                           DEAD BODY REPORT / SIREN
  │                                                      │
  │                                                      ▼
  └─────── RETURN TO ROAMING ◄─── EJECTION ◄─── COUNCIL VOTING
```

### Roles:
- **Villagers (Crew)**: Complete all assigned tasks across the 10 settlement rooms. Complete 100% of tasks or eject all Impostors to win. Ejected/killed villagers become ghosts who can pass through walls and finish remaining tasks.
- **Impostors**: Secretly eliminate isolated crew members (with kill cooldown and proximity requirements). Trigger environmental sabotages (Power Grid Darkness, 45s Reactor Meltdown, Communications Jam). Win on parity or if Reactor Meltdown expires.

### Controls:
- **WASD / Arrow Keys**: Move character (or click/touch floor)
- **[E] / [USE]**: Interact with Task or Central Emergency Siren
- **[R] / [REPORT]**: Report fallen crew member when nearby
- **[Q] / [KILL]**: Impostor eliminate nearby villager (when cooldown is ready)
- **[TAB] / [SABOTAGE]**: Open Impostor Sabotage Map

---

## 5. Development & Testing

### Prerequisites
- Node.js 20+
- npm 10+

### Start Local Development Server
```bash
npm install
npm start
```
Open [http://localhost:4200](http://localhost:4200) (or configured port, e.g. [http://localhost:4300](http://localhost:4300)).

### Run Unit Tests
```bash
npm test -- --watch=false --browsers=ChromeHeadless
```
Executes comprehensive Karma unit tests validating role distribution, task completion, kill proximity, emergency meetings, voting ties, ejections, and win conditions.

### Test with Simulated Crew Bots
1. Click **CREATE GAME** ➔ **Launch Chamber**.
2. In the Settlement Chamber, click **⚡ Fill to 5 Crew**.
3. Click **START EXPEDITION**.
4. Play through the complete 2D gameplay loop immediately!

### Multi-Tab Testing (BroadcastChannel WebRTC)
Opening a second browser tab on the same machine automatically detects the active host room and enables instant one-click **Quick Join** over local WebRTC DataChannels.

---

## 6. Static GitHub Pages Deployment

The static bundle is deployed automatically using GitHub Actions upon pushing to `main`:

```bash
npm run build
```

Production output is compiled directly to `dist/midnight-village/browser` and includes:
- `index.html`
- `404.html` (SPA fallback for client routing)
- `CNAME` (`play.genpoputils.com`)

The GitHub Actions workflow is defined in `.github/workflows/deploy.yml`.
