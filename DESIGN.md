# RunUp / Vitalis — AI Fitness Platform: Product & Architecture Blueprint

> **Status:** Living design doc. Phase 1 (web app, on-device intelligence) is partially shipped in `index.html`.
> **Strategy:** Web-first → PWA → native Android. On-device rules engine now; pluggable AI provider later.
> **Author note:** This blueprint maps the full vision onto a phased plan that respects the existing live web app.

---

## 0. How to read this document

The original brief asks for a native Android app. We are deliberately sequencing:

| Phase | Surface | Intelligence | Timeline |
|-------|---------|--------------|----------|
| **P1 (now)** | Web app (`index.html`) on Netlify | On-device JS rules engine | Shipping |
| **P2** | Web app + PWA (offline, installable) | Rules + lightweight TF.js models | Weeks |
| **P3** | Backend (serverless) + accounts | Optional cloud LLM coach (pluggable) | Months |
| **P4** | Native Android (Kotlin/Compose) | Full ML pipeline + Firebase | Quarter+ |

Sections 1–10 are surface-agnostic (product). Sections 11–17 describe the **native Android target architecture**. Sections 18–25 are cross-cutting. Each section flags **[P1 now]** vs **[P4 target]**.

---

## 1. Product Vision

**One line:** A personal trainer, health analyst, and AI coach in your pocket — turning passive Google Fit data into daily decisions.

**Differentiator:** We never just *display* numbers. Every screen answers a question the user is actually asking: *Am I improving? Should I rest? Am I ready for a 10K?* The product's core asset is the **insight layer** — the translation of raw signals into "why" and "what next."

**North-star metric:** Weekly Active Coached Days (a day where the user opened the app, saw an insight, and acted on a recommendation). Not DAU — *coached* days.

**Positioning:** Between Google Fit (data, no judgment) and a human coach (judgment, no scale). We are judgment at scale.

---

## 2. Functional Requirements

**Data ingestion**
- FR-1 Connect Google Fit via OAuth; pull steps, distance, calories, heart points, HR, resting HR, sleep, weight, height, workouts. *(P1: steps/cal/heart points; sleep + resting HR = P2.)*
- FR-2 Sync on launch, on manual refresh, and on a background schedule. *(P1: launch + manual. Background = P2 PWA / P4 WorkManager.)*
- FR-3 Midnight rollover recomputes the day. *(P1 ✓)*

**Intelligence**
- FR-4 Health Score (0–100) with per-component explanation. *(P1 ✓)*
- FR-5 Recovery Score (0–100) with per-deduction explanation. *(P1 ✓)*
- FR-6 Smart Insights with causal "why" text. *(P1 ✓)*
- FR-7 Pattern detection (plateau, overtraining, inactive streaks, improving endurance). *(P1 ✓)*
- FR-8 Race-time predictor (5K/10K/Half/Full, current + projected). *(P1 ✓)*
- FR-9 Adaptive 8-week plan that adjusts when workouts are skipped. *(P1: static plan ✓; adaptive = P2.)*
- FR-10 Rule-based chatbot answering from the user's own data. *(P1 ✓)*
- FR-11 **Dietitian** — calorie/macro targets from activity, meal guidance, hydration. *(Next P1 feature.)*

**Engagement**
- FR-12 XP, levels, badges, streaks. *(P1 ✓)*
- FR-13 Achievements tied to real milestones. *(P1 ✓)*
- FR-14 Challenges (personal/social/leaderboards). *(P3 — needs backend.)*
- FR-15 Smart notifications. *(P2 PWA push / P4 native.)*

**Account & data**
- FR-16 Sign in, sign out, profile. *(P1: Google OAuth ✓; accounts = P3.)*
- FR-17 Data export + account deletion (GDPR). *(P3.)*

---

## 3. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| **Performance** | First insight visible < 2s after sync; UI interactions < 100ms. |
| **Offline** | App usable with last-synced data; degrades gracefully (P2 PWA). |
| **Privacy** | Health data stays on-device by default; cloud only with explicit opt-in. |
| **Reliability** | Sync failures never corrupt stored history; idempotent recompute. *(P1 design ✓ — `recalcAllDaysFromFit`.)* |
| **Accessibility** | WCAG AA contrast, screen-reader labels, dynamic type. |
| **Security** | No secrets in client; tokens in `sessionStorage` (P1) → encrypted store (P4). |
| **Cost** | $0 marginal cost at P1 (static hosting, no backend). |

---

## 4. User Personas

1. **Couch-to-10K Casey (primary).** Sedentary, intimidated by running, motivated by streaks and "you're improving" feedback. Needs encouragement and safety (don't get injured).
2. **Returning-runner Raj.** Ran before, rebuilding. Wants race predictions and recovery guidance to avoid re-injury.
3. **Data-curious Dana.** Loves charts and "why." Will read every insight. Power user who tests the chatbot.
4. **Accountability Aisha.** Driven by social/competition. Maps to P3 challenges.

---

## 5. User Journey (primary persona)

```
Discover → Connect Google Fit → First sync ("here's where you are")
   → Daily loop: open → see Coach message + scores → act → log activity
   → Weekly: review trend, plan adjusts, milestone badge
   → Race week: taper guidance → 10K finish → celebrate → next goal
```

Critical moment: **the first insight after first sync.** If it feels generic, we lose Casey. It must reference *her* numbers.

---

## 6. Feature List (consolidated)

Today • Coach (scores, insights, patterns, race predictor, chatbot) • **Dietitian (next)** • Rewards (XP/levels/badges/streak) • Journey (milestones) • Plan (8-week) • Stats (trends, predictions, account). **Backlog:** challenges, social, notifications, wearable integrations, nutrition logging, recovery from sleep/HRV.

---

## 7. Screen-by-Screen UI Spec (current web app)

| Screen | Purpose | Key components |
|--------|---------|----------------|
| Auth | OAuth connect | Client-ID input, setup guide |
| Today | Daily status | Hero ring, goals card, stat grid, steps chart, coaching tips |
| Coach | Intelligence | AI message, Health/Recovery rings + breakdown, insights, patterns, race predictor, chatbot |
| Rewards | Motivation | Level card, streak, badges, points log |
| Journey | Progress | Milestone timeline, weekly chart |
| Plan | Training | 8-week accordion, today marker |
| Stats | Analysis | 7-day charts, race prediction, profile, sign-out |

Design language: Inter + JetBrains Mono, blue/green/red/amber semantic palette, soft shadows, 12px radius, mobile-max-width 480px. *(Already implemented as CSS variables in `index.html`.)*

---

## 8. Wireframe Suggestions

- **Dietitian (next build):** calorie ring (consumed vs target-from-activity) → macro split bars (protein/carb/fat) → hydration tracker → meal-timing tips card → "what to eat today" suggestions keyed to training load. All computed on-device from Fit calories + plan phase + weight.
- **Notifications (P2):** inactivity nudge, goal-proximity ("650 steps to go"), recovery recommendation, weather-for-running.

---

## 9. Data Model (logical — surface-agnostic)

```
User { id, name, email, photo, heightCm, weightKg, startDate, goalRace }
DailyMetrics { date, steps, distanceKm, calories, heartPoints, restingHr, sleepMin, weightKg }
Goal { date, metric, target, achieved, xpEarned }
Score { date, health, recovery, components[] }
Insight { date, type, severity, title, body }
Plan { week, day, type, distance, completed }
Achievement { id, earnedAt }
PointsLogEntry { date, desc, pts }
ChatMessage { ts, role, text }      // P3 if persisted
NutritionTarget { date, kcal, proteinG, carbG, fatG, waterMl }   // dietitian
```

*P1 storage:* `localStorage` key `runup_v3` (history map, pts log, totals, streak). *P4 target:* Room DB (section 10).

---

## 10. Database Schema (P4 — native Android, Room)

```kotlin
@Entity data class UserEntity(@PrimaryKey val id: String, val name: String, ...)
@Entity data class DailyMetricsEntity(@PrimaryKey val date: LocalDate, val steps: Int, ...)
@Entity data class ScoreEntity(@PrimaryKey val date: LocalDate, val health: Int, val recovery: Int, val componentsJson: String)
@Entity data class InsightEntity(@PrimaryKey(autoGenerate=true) val id: Long, val date: LocalDate, val type: String, ...)
@Entity data class PlanDayEntity(...)  @Entity data class AchievementEntity(...)
@Entity data class NutritionTargetEntity(...)  @Entity data class ChatMessageEntity(...)
```
DAOs expose `Flow<List<…>>` for reactive UI. Offline-first: Room is source of truth; Google Fit sync writes into Room; UI observes Room.

---

## 11. API Design

**P1/P2 (client-only):** Google Fit REST (`fitness/v1/users/me/dataset:aggregate`) — already used. No backend.

**P3 (backend, when accounts/social arrive):** thin serverless API (Netlify Functions / Cloud Functions).
```
POST /sync           # store synced metrics server-side (opt-in)
GET  /insights       # server-computed insights (if moved off-device)
POST /coach/chat     # proxy to LLM (key stays server-side) — see §13
GET  /challenges     POST /challenges/:id/join     GET /leaderboard/:id
POST /export         DELETE /account
```
Auth: Firebase Auth ID token → verified in function.

---

## 12. Clean Architecture Folder Structure (P4 — Android target)

```
app/
 ├─ di/                         # Hilt modules
 ├─ data/
 │   ├─ local/ (Room: db, dao, entity)
 │   ├─ remote/ (GoogleFit, Firebase)
 │   ├─ repository/ (impls)
 │   └─ mapper/
 ├─ domain/
 │   ├─ model/                  # pure Kotlin models
 │   ├─ repository/             # interfaces
 │   └─ usecase/ (ComputeHealthScore, ComputeRecovery, PredictRace, GenerateInsights, ComputeNutritionTargets, ...)
 ├─ presentation/
 │   ├─ today/ coach/ dietitian/ rewards/ journey/ plan/ stats/   # each: Screen + ViewModel + UiState
 │   ├─ navigation/
 │   └─ theme/
 └─ core/ (util, result, dispatchers)
```
Pattern: **MVVM + Clean** — `Screen (Compose) → ViewModel (StateFlow) → UseCase → Repository → DataSource`. Unidirectional data flow.

**The win:** the on-device intelligence we write today (scores, insights, race predictor) is **pure functions** — they port directly into `domain/usecase` Kotlin with no logic change. The web `computeIntelligence()` is the spec for `GenerateInsightsUseCase`.

---

## 13. AI Architecture (pluggable provider)

**Principle:** the coach intelligence is an interface, not a vendor.

```
interface CoachEngine {
  fun message(state: CoachState): String
  fun answer(question: String, state: CoachState): String
}
```
- **P1 implementation:** `RulesCoachEngine` — deterministic, on-device, $0, private. *(Shipped.)*
- **P3 optional:** `LlmCoachEngine` — calls Claude **through a serverless proxy** (the Anthropic API key must NEVER be in client code; it lives as a Netlify/Cloud Function env var). Rules engine computes the scores/targets; the LLM only does conversational phrasing and open-ended Q&A grounded in those numbers. This keeps cost bounded, privacy controllable, and the app functional offline (fall back to rules).

Decision recorded: **on-device rules now**; cloud LLM is an opt-in enhancement, never a hard dependency.

---

## 14. Machine Learning Pipeline (P2 → P4)

| Model | Input | Output | Tech |
|-------|-------|--------|------|
| Race-pace prediction | 7–28d steps/HP/distance trend | finish time | Linear/GBM → TF.js (P2), TFLite (P4) |
| Recovery prediction | load, sleep, resting HR | readiness 0–100 | Heuristic now → small regressor |
| Anomaly detection | resting HR / HR series | flag | z-score now → isolation forest |
| Weight/calorie projection | weight + intake history | trajectory | linear regression |
| Fitness age / VO2 est. | pace, HR, age | years | published formulas first |

**Pipeline:** collect (Fit) → feature-store (Room/local) → train offline (notebook) → export TFLite → ship in-app → infer on-device → feedback loop. Start with **heuristics** (already do), graduate to learned models only where they beat the heuristic on held-out data.

---

## 15. Notification Engine (P2 PWA / P4 native)

Rules → triggers → channel. Examples: inactivity (90 min no steps during waking hours), goal-proximity (≥85% of step goal after 6pm), recovery ("light day recommended"), weather-for-running (P3, needs weather API). Native: WorkManager + `NotificationCompat` channels; PWA: Web Push + service worker. Quiet hours + frequency caps to avoid nagging.

## 16. Recommendation Engine

Context (today's scores + plan phase + recent patterns) → ranked recommendations with rationale. Already embodied by `renderTips` + coach message + insights. Generalize to a scored list: each candidate recommendation has `{relevance, rationale, action}`; show top N.

## 17. Analytics Engine

Daily/weekly/monthly/quarterly/yearly rollups; heatmaps (calendar of activity), trend charts, comparisons (this week vs last), personal records, milestones. *(P1: 7-day charts ✓.)* Heatmap + monthly compare = P2 (needs >7d history → requires either longer Fit pulls or stored history).

---

## 18. Scalability Plan

- **P1:** static CDN (Netlify) — effectively infinite scale, $0.
- **P3:** serverless functions auto-scale; Firestore/Cloud SQL for accounts; cache leaderboards.
- **Data growth:** keep heavy history on-device; server stores only what social/sync needs.
- **Cost control:** LLM calls rate-limited per user, cached, and behind opt-in premium (§24).

## 19. Security Plan

| Area | P1 | P4 |
|------|-----|-----|
| Token storage | `sessionStorage` | EncryptedSharedPreferences / Keystore |
| Secrets | none in client | API keys server-side only |
| Transport | HTTPS (Netlify) | HTTPS + cert pinning |
| Local data | localStorage (per-origin) | SQLCipher-encrypted Room |
| Permissions | OAuth scopes minimal | runtime perms, least privilege |
| Privacy | data on-device | GDPR: export + delete, consent screen |

**Hard rule:** the Anthropic/LLM key is never shipped to a client. If/when we add the LLM coach, it goes through a serverless proxy (§13).

## 20. Testing Strategy

- **Unit:** intelligence functions (scores, recovery, race prediction, nutrition targets) — pure, fully testable. Golden-value tests on known inputs (we already verified Health 87 / Recovery 85 / 10K 1:36:30 on mock data).
- **Integration:** Fit API parsing (`processAll`, `extractSum`), midnight rollover, storage recompute idempotency.
- **UI:** Compose UI tests (P4) / Playwright (P2 web).
- **Contract:** mock Fit responses fixture set.
- Coverage target: 80% on `domain/usecase`.

## 21. CI/CD Pipeline

- **P1/P2 web:** GitHub → Netlify auto-deploy on push to `main` (already live). Add: lint (HTMLHint/ESLint), Lighthouse budget check, Playwright smoke.
- **P4 Android:** GitHub Actions → `./gradlew test lint assembleRelease` → Firebase App Distribution (beta) → Play Console (staged rollout). Crashlytics gating.

## 22. Deployment Strategy

Web: Netlify, instant rollback, preview deploys per PR. Android: staged rollout 5%→20%→100% with Crashlytics watch; feature flags (Firebase Remote Config) to dark-launch.

## 23. Future Roadmap

P2: PWA/offline, sleep+resting HR, adaptive plan, monthly analytics, notifications.
P3: accounts, social challenges, leaderboards, optional LLM coach, nutrition logging.
P4: native Android, TFLite models, wearable (Wear OS), Health Connect API.
P5: multi-sport, marathon plans, coach marketplace.

## 24. Premium Roadmap (monetization)

**Free:** core tracking, rules-based coach, 8-week 10K plan, basic insights, scores.
**Premium ($/mo):** unlimited LLM coaching, advanced predictions (VO2/fitness age), full marathon/half plans, nutrition suggestions, recovery analysis, report export, wearable integrations, advanced analytics/heatmaps.
Billing: Play Billing (Android) / Stripe (web). Gate at the use-case layer so the same engine serves both tiers.

## 25. Per-Module Implementation Plan (near-term, web)

| Module | State | Next step |
|--------|-------|-----------|
| Today | ✓ | minor polish |
| Coach scores/insights/patterns | ✓ | add sleep+resting HR inputs (P2) |
| Race predictor (unified) | ✓ | calibrate `fitFactor` with real data |
| Chatbot (rules) | ✓ | expand intents; add nutrition intents |
| **Dietitian** | **not started** | build on-device: TDEE from weight+activity, macro split by plan phase, hydration, meal-timing tips, "what to eat today"; wire into Coach tab + chatbot |
| Plan | static | make adaptive to skipped days (P2) |
| Storage | localStorage | add export/import (P3) |
| PWA | none | manifest + service worker (P2) |

---

## Immediate recommendation

Ship the **Dietitian** next — it's the feature you actually asked for, it's fully doable on-device (no backend, no API key), and it slots into the Coach tab you already have. Everything else above is sequenced behind it.
