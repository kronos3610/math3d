# Plan: make Math3D a visual, intuitive explanation tool

Status: product implementation and local release checks complete; PR publication pending approval · Branch base: `feat/public-beta-readiness` · Written against commit `a5b3c9d`

## 0. How to read this document

- §1–3 explain the goal, how success is measured, and the starting point.
- §4 is the work, in phases. Every task lists **files**, **steps**, **acceptance**, and **tests**.
- §5 is the order and size of the work; §6 risks; §7 decisions that need an owner; §8 things noticed but out of scope.
- Appendix A holds the evidence (file:line) behind every claim so the plan can be audited.

Sizes: **S** ≤ ½ day · **M** 1–2 days · **L** 3–5 days. These are rough relative sizes, not commitments.

---

## 1. Goal

> Someone who has never seen the topic should be able to open a lesson, move one thing, and *see* the idea — before reading any text.

Concretely, every lesson should (a) show its idea on the stage without opening a panel, (b) let the learner change the one quantity the lesson is about, (c) tie the picture to a live number, and (d) use the same colour for the same meaning across lessons.

### 1.1 The Intuition Rubric

A lesson is scored 0/1/½ on each line. This is the yardstick for every phase below.

| # | Criterion | Passing looks like |
|---|-----------|--------------------|
| R1 | **Key on stage** | Colours/objects are explained on the canvas or beside it at first paint (not inside a closed drawer). |
| R2 | **The lever** | The quantity the lesson is *about* is directly manipulable (slider, drag, toggle), not only play/pause. |
| R3 | **Picture ↔ number** | A readout or insight line updates with the lever and matches what is drawn. |
| R4 | **Consistent grammar** | Colours come from the shared palette; axes/units are labelled; same meaning ⇒ same colour. |
| R5 | **An aha moment** | A challenge, prediction prompt, or reveal creates the "oh!" — the answer is not pre-solved. |
| R6 | **Degrades well** | Meaningful output without WebGL2 (SVG/native) and full keyboard operation. |

### 1.2 Confirmed baseline scorecard (before implementation)

✓ = met · ~ = partly · ✗ = not met. Scores below were corrected by a desktop/390 px browser pass with WebGL on and off. Axis-only keys and drawer-only readouts earn half credit. Appendix B retains the original source-inferred notes.

| Lesson | R1 | R2 | R3 | R4 | R5 | R6 | Note |
|---|---|---|---|---|---|---|---|
| `ml/regression-*` (RegressionLab) | ~ | ✓ | ✓ | ~ | ✓ | ✓ | Controls/readouts/challenge work. Axis names are visible, but no always-visible observed/fit/residual key; axis hues collide with role colors. Fit geometry occupies a small region on portrait. |
| `probability/bayes-theorem` | ✓ | ✓ | ✓ | ~ | ✗ | ✓ | Population colors, natural-frequency counts and levers visible on both renderers; initial flagged view already reveals answer and has no prediction step. |
| `linear-algebra/matrix-transformations` | ~ | ✓ | ✓ | ~ | ~ | ~ | Live determinant/output and controls visible. Mobile 3D labels are clipped at left; SVG labels collide with the computed-matrix overlay; always-visible semantic key missing. |
| `linear-algebra/vector-operations` | ~ | ✓ | ~ | ~ | ✗ | ✗ | A/B/A+B identify arrows, but meanings and readouts are in the drawer; input/output role colors inconsistent. No graphical fallback. |
| `linear-algebra/eigenvalues` | ~ | ✓ | ~ | ✗ | ✗ | ✓ | x/Ax labels and axes visible; numerical relationship is hidden in drawer. Initial vectors are not aligned; Reset pre-solves with identity. SVG is meaningful. |
| `calculus/riemann-vs-lebesgue` | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | Refinement lever works in drawer, but no first-paint semantic key or displayed sums; no graphical fallback. |
| `probability/monte-carlo` | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | Dark sphere/cube have no first-paint key; statistics are hidden, no budget/restart lever, only one run. No graphical fallback. |
| `calculus/gradient-descent-calc` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Fixed start/rate and no loss/step metrics. Portrait bowl extends far outside the stage. No graphical fallback. |
| `calculus/derivatives` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Surface/tangent with no curve, point lever or slope readout; no semantic key or graphical fallback. |
| `calculus/integrals` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Animated bars lack a curve, total, lever and semantic key; no graphical fallback. |

### 1.3 Success metrics (tracked, not all gating)

| Metric | Baseline | Target after P5 |
|---|---|---|
| Lessons scoring ≥ 5/6 on the rubric (✓ = 1, ~ = ½; of the 10 assessed) | 1 (RegressionLab; browser-confirmed) | 10 |
| Lessons with **zero** interactive state | 5 (`derivatives`, `integrals`, `fundamental-subspaces-lite`, `decision-boundaries`, `distributions`) | 0 |
| Lessons using the shared always-visible key (`SceneAxisKey`) | 3 (full R1 audit happens in P0) | all non-VisualLab lessons |
| Hex literals in non-test `src/scenes` (3–8 hex digits) | 1046 | < 400 (palette tokens replace them as scenes are touched) |
| Hex literals in non-test `src/components/3d` | 29 | 0 outside `palette.ts` |
| Inline `style={{…}}` objects in scenes | 723 (722 in non-`VisualLab` scenes) | < 250 |
| Lessons without a non-WebGL fallback | 26 of 75 (README) | ≤ 10 |
| `challenge=` / predict prompts in scenes | 14 `challenge=` matches, 0 predict prompts | ≥ 25 combined |

The final reproducible count in [the metrics report](docs/validation/visual-intuition-metrics.json) corrects the original literal and prop counts; Appendix A keeps the historical source notes.

---

## 2. Principles (apply to every task)

1. **Picture before panel.** What a colour means must be visible without opening the drawer.
2. **One lesson, one idea, one lever.** Extra controls are secondary and collapsed.
3. **Numbers follow the picture.** Every lever change updates a readout that matches the drawing.
4. **Same colour, same meaning**, and colour is never the only channel (always a label or shape too).
5. **Reveal, don't recite.** Let the learner make a guess or find the answer; never start in the solved state.
6. **Keep the honest limits.** The `limitations` text in `lessonGuides.ts` is a strength — update it, never delete it.
7. **Don't change the math to change the picture.** Numerical tests stay green; new numerical code gets its own tests.
8. **Stable URLs.** Lesson ids/routes do not change (guides, paths, tests and README depend on them).

---

## 3. Baseline and constraints

Measured on this branch before any change:

| Check | Result |
|---|---|
| `npm run lint` | clean (~9 s) |
| `npx vitest run` | 71 files / 395 tests pass (~11 s) |
| `npm run build` | passed on Node 24; advisory renderer chunk-size warning |
| Visual check in a browser | 52 baseline browser cases: 10 assessed families plus 3 other pilots, desktop/390 px, WebGL2 on/off; scorecard corrected by eye |

Project rules this plan must respect (`AGENTS.md`): functional components + hooks; strict TS, no `any`; CSS variables for theming; shared 3D utilities in `src/components/3d/`; constants in `src/data/`; `aria-label` on canvases; keyboard accessibility; instanced meshes for repeated geometry; minimal work in `useFrame`. Workflow: branch → implement → `npm run lint` + `npm run build` (+ tests) → a11y check → PR.

Existing building blocks to **reuse, not reinvent**:

| Need | Already exists |
|---|---|
| Lab chrome (stage + metrics + live insight + challenge) | `components/layout/VisualLab.tsx` (`LabRange`, `LabSelect`, `LabPlayback`) |
| 3D scene from data, with SVG fallback and equal-scale axes | `components/3d/SpatialScene.tsx` |
| An always-visible key | `components/3d/SceneAxisKey.tsx` (+ `.scene-axis-key` CSS); used by 3 scenes |
| Semantic ML colours | `--lab-truth`, `--lab-fit`, `--lab-variation`, `--lab-noise` (`index.css:1048`) |
| Seeded randomness | `seededRandom`, `sampleNormal` in `utils/regression.ts` |
| 2D SVG chart pattern | `ExperimentLayout` + `.lab-chart` (used by `BiasVariance`, `SignalToNoise`) |
| Learning-path data + in-scene Next/Prev | `learningPaths`, `getPathNavigation`, `lessonUrl` in `data/mlCurriculum.ts`; Learn tab in `SceneContainer` |

---

## 4. Work

### Dependency overview

```
P0 baseline ─► P1 grammar (palette, key) ─┬─► P2 levers ─┬─► P4 predict→reveal
                                          ├─► P3 eigen ──┘
                                          └─► P5 shared HeightField + migrate
P6 paths/previews (data first; UI after P2/P3 settle)         P7 gates run on every PR
```

---

### P0 — Baseline and rubric (S)

- [x] Run `npm run build`; record result in the first PR description.
- [x] Do a 15-minute manual pass on the 10 assessed lessons (desktop + a 390 px-wide viewport, WebGL2 on and off via `webgl-diagnostic.html` / a disabled-GPU browser profile). Confirm or correct the §1.2 scorecard — it was derived from source, not from rendering.
- [x] Commit the confirmed scorecard (this file is the home; update §1.2 in place).

**Acceptance:** scorecard confirmed by eye; build status known. No product code changes.

---

### P1 — Visual grammar: one palette, one key (M)

**Why.** Today the same colour means different things lesson to lesson, and inside `SpatialScene` itself the Z axis and the default data points are both `#60a5fa`, while the X axis (`#fb7185`) equals `RegressionLab`'s residual arrow. A learner cannot build a "colour ⇒ meaning" habit.

#### 1.1 Palette module + CSS tokens (S)

**Files:** new `src/data/palette.ts`; edit `src/index.css` (`:root` block near `:1048`).

**Steps**
1. Define roles (starting values — validated in 1.4). The key design choice is that **axis lines are not in the semantic palette at all**: they are neutral and identified by letters, because any RGB/XYZ assignment collides with a semantic role (X≈error, Y≈focus, Z≈data — all three collide today).

   | Role | Token | Start value | Meaning | Collides today with |
   |---|---|---|---|---|
   | data / given | `--viz-data` | `#60a5fa` | observations, input vectors | `SpatialScene` Z axis (`:11`) |
   | truth / target / optimum | `--lab-truth` (keep) | `#64d9c6` | the thing being estimated | `SpatialScene` `COLORS.line` `#2dd4bf` (same family; unify) |
   | focus / current / selected | `--viz-focus` | `#fbbf24` | the thing tracked or being changed | `SpatialScene` Y axis |
   | variation / ensemble | `--lab-variation` (keep) | `#a5b4fc` | spread across fits | — |
   | error / residual / noise | `--lab-noise` (keep) | `#fb7185` | what the model gets wrong | `SpatialScene` X axis |
   | output / transformed | `--viz-output` | `#a78bfa` | A·x, transformed cube | `VectorOperations` input A is also violet |
   | axis lines | `--viz-axis-line` | neutral slate, ~40 % opacity | the drawn x/y/z lines; named by end labels `x` `y` `z` | — |
   | basis / coordinate glyphs | `--viz-basis-1/2/3` | `#f87171` / `#34d399` / `#60a5fa` | **only** e₁ e₂ e₃ and weight coordinates β₁..β₃ | `--viz-data` vs basis-3 if both appear in one scene — the validator decides (1.4) |

2. Export the same values from `palette.ts` as a typed `const` (Three.js materials need hex strings, they cannot read CSS variables).
3. Keep existing `--lab-*`, `--bayes-*`, `--linear-class-*` tokens working (aliases) so nothing regresses.

**Acceptance:** `palette.ts` and `index.css` agree (test in 1.4); no visual change yet.

#### 1.2 `SceneKey` and the `legend` slot (M)

**Why.** `SceneAxisKey` already solves "always-visible key" but only for 3 scenes and only for axes. Legacy scenes keep their key in the closed drawer (`Derivatives.tsx:89-94`).

**Files:** edit `components/3d/SceneAxisKey.tsx`; edit `components/layout/SceneContainer.tsx`; edit `index.css` (`.scene-axis-key` at `:1799`).

**Steps**
1. Generalise `SceneAxisKey` → `SceneKey` with the same markup/class, entries `{ label, meaning, color, shape? }`, and an `aria-label` prop (default `"Plot axis meanings"` so `CalculusGuidance.test.tsx` keeps passing; new callers use `"Plot key"`). Re-export `SceneAxisKey` as a thin wrapper.
2. Add `legend?: readonly KeyEntry[]` to `SceneContainerProps`; render `SceneKey` inside `.scene-content` (it is `position:absolute`, `pointer-events:none`, so it cannot block orbiting).
3. Colour is never the only channel: each entry shows a shape (dot / line / square) in addition to hue, plus its text label.
4. Mobile (≤ 768 px): collapse to one line with a "Key" disclosure (`<details>`), so it does not eat canvas height that `.scene-brief` already takes (74 px top padding).
5. Pilot on `Derivatives`, `Integrals`, `GradientDescent`, `MonteCarlo`, `RiemannVsLebesgue` (text already exists in their drawers — move it, don't rewrite it).

**Acceptance:** each pilot lesson shows its key at first paint with the drawer closed; keyboard/AT users reach it as a labelled list; no overlap with `.scene-nav` at 390 px.

**Tests:** extend `SceneContainer.test.tsx` — `legend` renders without opening the panel; the existing "brief before controls" test (`:72`) still passes.

#### 1.3 Fix the known collisions (S)

- `SpatialScene.tsx:11`: `COLORS` ← import from `palette.ts`. Axis lines become neutral (`--viz-axis-line`) with `x`/`y`/`z` end labels (the file already uses drei `Html` for labels; mirror them as `<text>` in `SpatialFallback`). The coloured X/Y/Z text in `.spatial-axis-key` (`:198`) becomes neutral.
- Replace the three per-scene X/Y/Z literal sets (`PartialDerivatives` `CONF`, `JacobianHessian:233`, `LagrangeConstraints:287`) with `--viz-basis-*` where the glyph is a basis/weight coordinate, and with neutral axis styling where it is only an axis.
- `Eigenvalues.tsx:222`: slider labels drop their hue (letters X/Y/Z suffice) — the sliders are controls, not data.
- `VectorOperations`: input A uses `--viz-data`, output/sum uses `--viz-output`.

**Acceptance:** no scene shows two different colours for the same coordinate, and no axis line shares a hue with a data/error/focus role; `grep` for the old literals in the touched files returns nothing.

#### 1.4 Drift guards (S)

**Files:** new `src/data/palette.test.ts`.

1. **Parity:** parse `src/index.css`, assert every `--viz-*` value equals `palette.ts`.
2. **No stray literals in the shared layer:** read `src/components/3d/*.tsx|ts` (non-test) and fail on a `#rrggbb` literal outside `palette.ts`.
3. **Contrast / distinguishability (script, not a unit test):** check each role vs `#0b0f19` and `#050508` (≥ 3:1 for lines/markers) and pairwise ΔE under deuteranopia/protanopia/tritanopia simulation. Use the `dataviz` skill's validator if available. If two roles fail, change the *palette*, not the threshold.

**Acceptance:** tests green; script output attached to the PR.

---

### P2 — Give each "dead" lesson its lever (L, one PR per lesson)

Each task below is a self-contained PR. Definition of done for every one is in §5.3.

#### 2.1 Gradient descent (calculus) — learning rate and start point (M) **do first**

**Why.** The learning rate *is* the lesson, and it is fixed at 0.1 (`optimization.ts:22`, start `[3,2]` at `GradientDescent.tsx:14`). `RegressionLab` already has a learning-rate slider (`:138`), so the pattern exists.

**Files:** `scenes/calculus/GradientDescent.tsx`, `utils/optimization.ts` (+ test), `components/3d/DescentTrajectory.tsx`, `data/lessonGuides.ts`.

**Steps**
1. **Math:** for the loss ½(x²+y²) each step multiplies by (1−η). So: η<1 monotone, η=1 lands on the minimum in one step, 1<η<2 oscillates and converges, η>2 diverges. Expose η ∈ [0.02, 2.4] so all four regimes are reachable.
2. Add an options-style `gradientDescentTrace(gradient, start, {learningRate, maxSteps, bound})` returning `{ path, status: 'converged' | 'diverged' | 'max-steps' }`. Stop when the iterate leaves the plotted domain (|coordinate| > 6) so a diverging run stays finite. Keep `gradientDescentPath` unchanged (used by `GradientDescentML`).
3. Controls (use `VisualLab`/`LabRange`): **Learning rate η**, **Start x**, **Start y**, Replay, Pause. Presets: "Too small", "Just right (η=1)", "Overshoots", "Diverges".
4. Readouts (metrics): step k, position, loss, ‖∇f‖, status. Insight line states the regime in words ("each step multiplies the distance by 0.9").
5. `DescentTrajectory`: reset `elapsed` when `path` identity changes (today it only resets via `key`); key the component on `[η, start]`.
6. Optional **2.1b**: "Bowl shape" κ — loss ½(x²+κy²) — to show zig-zag/ill-conditioning (links to the ML *conditioning* lesson).
7. Update the guide: remove "starting point and step size are fixed" from `limitations`; add the four regimes to `observe`.

**Acceptance:** all four regimes are reachable and read correctly; diverging runs render without NaN/Infinity geometry; lesson shows its key (1.2) and metrics at first paint.

**Tests:** extend `utils/optimization.test.ts` — η=1 reaches 0 in one step; η=1.5 oscillates (sign flips) and converges; η=2.2 reports `diverged` with all-finite coordinates; η<1 loss strictly decreases. DOM test: slider labelled "Learning rate", readout changes.

#### 2.2 Integrals → accumulation (M)

**Why.** `Integrals.tsx` animates bar heights in time (`:14-24`); there is no curve and no total, and `topics.ts:102` promises "volume computation" that isn't there. `RiemannIntegral` already owns "n partitions → limit", so this lesson needs a *different* idea.

**Idea:** the accumulation function A(x)=∫ₐˣ f — and that its slope is f (fundamental theorem), which also closes the loop with the Derivatives lesson.

**Files:** `scenes/calculus/Integrals.tsx` (keep route id `integrals`), new pure helper in `scenes/calculus/legacyCalculusMath.ts` (or `riemannUtils.ts`), `data/topics.ts` (description), `data/lessonGuides.ts`.

**Steps**
1. Function: f(x)=sin x on [0, 2π] (sign change ⇒ signed area; closed form A(x)=1−cos x gives an exact check).
2. Top plot: f(x) with the area from 0 to x shaded (positive vs negative in two tints). Bottom plot: A(x) traced up to x, with a tangent whose slope equals f(x).
3. Controls: **x** slider; secondary **bars n** (shows the sum approximating the shaded area; default off).
4. Readouts: `A(x)` (numeric), `A(x)` exact, `f(x)`, `A′(x)` (finite difference). The last two being equal is the aha.
5. Render as SVG inside `ExperimentLayout`/`.lab-chart` (the idea is 2D). This also removes a lesson from the "no non-WebGL fallback" list.
6. Update `topics.ts` description and the guide (`meaning`, `observe`, `limitations`).

**Acceptance:** dragging x moves the shaded region, A(x) and the tangent together; A′(x) equals f(x) to 3 d.p.

**Tests:** pure test of `accumulate(f, a, x, n)` vs `1−cos x` (tolerance 1e-3 at n=400); DOM test that the x slider updates both readouts; `lessonGuides.test.ts` still passes.

#### 2.3 Monte Carlo — restart, budget, and error vs n (M)

**Why.** One run, stops at 500 (`MonteCarlo.tsx:21`), no history — the learner cannot see *convergence*, which is the whole idea. Also uses `secureRandom`, so nothing is reproducible.

**Files:** `scenes/probability/MonteCarlo.tsx`, reuse `seededRandom` from `utils/regression.ts`, guide.

**Steps**
1. Seeded generator with a visible seed; **Run again** (new seed) and **Restart** (same seed).
2. **Sample budget** select: 100 / 500 / 2 000 / 10 000. The instanced mesh `args` count is fixed at creation ⇒ `key` the mesh on the budget.
3. Add an error-vs-n plot (log–log): |π̂ − π| vs n sampled every k points (≤ 200 plotted points), with a 1/√n reference line. Insight: "100× more samples ⇒ about 10× smaller error".
4. Keep the existing readouts and "π = 6 × inside/total" derivation.
5. Throttle `setStats` (currently every sample at 12 Hz is fine; at 10 000 samples draw in batches per frame).

**Acceptance:** the error plot visibly tracks the 1/√n envelope; same seed reproduces the same π̂.

**Tests:** seeded run is deterministic; budget change rebuilds the mesh; error history length bounded.

#### 2.4 Derivatives — show what the tangent is tangent *to* (M)

**Why.** The pink line floats near a surface with no curve beneath it. `Derivatives` also duplicates `PartialDerivatives`' content with less control.

**Recommended option (A):** keep the surface and the existing `DerivativeSurface` export, add a *slice* and a *secant*.

**Files:** `scenes/calculus/Derivatives.tsx`, `Derivatives.test.tsx` (keep passing), guide.

**Steps**
1. Controls: **Point x**, **Slice y**, **Secant step h**, toggle **Trace automatically** (today's orbit).
2. Draw the vertical slice plane y = const and the 1-D curve it cuts from the surface — the tangent now touches a visible curve.
3. Draw the secant through (x, f) and (x+h, f); readouts: secant slope, tangent slope ∂z/∂x, their difference. Shrinking h shows the secant → tangent.
4. `DerivativeSurface` gains an optional `point?: {x, y}`; with no prop it keeps today's time-based orbit so the existing finite-difference test passes unchanged.
5. Give the lesson a distinct role in the guide: "slope of one slice; use Partial Derivatives for both directions and the gradient".

**Acceptance:** with h → 0 the readout difference → 0; default state is user-controlled, auto-trace is opt-in.

**Tests:** keep the existing `Derivatives.test.tsx`; add a test that the secant slope converges to the analytic slope as h halves.

#### 2.5 Distributions — σ, ρ, N, resample (S–M)

**Why.** `Distributions.tsx` uses module-scope `Math.random()` (non-deterministic, untestable) and has no control.

**Steps**
1. Controls: **σₓ**, **σ_y** ∈ [0.6, 1.8], **ρ** ∈ (−0.9, 0.9), **N** ∈ {50, 100, 500}, **Resample** (seeded via `sampleNormal`).
2. Keep the honest `4π × density` height scale; narrower ⇒ taller, so "wider ⇒ lower peak because total volume stays 1" becomes visible.
3. Readouts: sample mean/std; fraction inside the 1σ ellipse vs theory 1 − e^(−½) ≈ 39.3 %.
4. Fix the guide text that currently describes a fixed standard Gaussian.

**Tests:** seeded sample reproducible; empirical fraction within ±8 pts of 39.3 % at N=500 over several seeds.

#### 2.6 Riemann vs Lebesgue — show the two estimates (S) **high value, low cost**

**Why.** The lesson never displays the totals (`RiemannVsLebesgue.tsx` computes boxes only), yet "same answer, sliced differently" is the idea.

**Steps**
1. Compute and show: Riemann Σ, Lebesgue Σ, a fine-grid reference, and each error — as metrics beside the stage.
2. Note in `insight` that the layer sum is a *lower* sum over a fixed 40×40 floor grid (existing limitation text), so it under-estimates until height layers are thin.
3. Move its key out of the drawer (1.2).
4. Note the `if (h < 0.1) continue` cell skip at `:87` — either document it or remove it so Riemann Σ is not silently biased.

**Tests:** pure test that Riemann Σ and Lebesgue Σ both approach the reference as refinement rises (smooth function).

#### 2.7 Decision boundaries — move the plane, count the mistakes (M)

**Why.** Everything is fixed and the points are randomised at module scope; the existing test pins the plane normal (`DecisionBoundaries.test.tsx`).

**Steps**
1. Controls: plane **tilt**, **turn**, **offset**; **Dataset** (separable blobs / overlapping / XOR-like); **Boundary** (plane / sphere).
2. Readouts: accuracy, number misclassified; ring the misclassified points.
3. Seed the data. The XOR-like set + plane shows *why* a plane is not enough; the sphere shows a curved boundary.
4. Keep the exported `DecisionPlane` default behaviour so the existing test remains valid.

**Tests:** accuracy readout matches a direct count; seeded data stable.

#### 2.8 Fundamental subspaces (Lite) — drive the input vector (S)

**Steps:** add three sliders for x; show live row-space and null-space components, their dot product (≈ 0) and that the sum equals x. Guide currently hard-codes `[3, 3, 3]`; make it the default, not the only case.
**Tests:** decomposition sums to x and is orthogonal for random x.

---

### P3 — Eigenvalues: let the learner *find* it (M)

**Why.** Reset sets the identity and x = (1,1,1) (`Eigenvalues.tsx:124-126`), so the header immediately says "Approximate eigenvector found" (`:166`); a 3-slider blind search follows; Auto-Find hands over the answer.

> **Correction to my earlier summary.** I suggested the image of a unit sphere makes eigen-directions "stand out as the ellipsoid's axes". That is only true for symmetric matrices — the ellipsoid's axes are *singular* vectors in general. The design below uses an alignment map, which is correct for any matrix.

**Files:** `scenes/linear-algebra/Eigenvalues.tsx`, `legacyLinearMath.ts`, `LegacyLinearScenes.test.tsx`, guide.

**Steps**
1. **Alignment map.** Sample ~300 unit vectors (Fibonacci sphere, deterministic). For each u compute Au and `|cos∠(u, Au)|` (reuse `assessEigenvector` so the definition — including λ = 0 — matches). Colour each sample from dim (not aligned) to bright (aligned). Eigen-directions appear as glowing spots (or a glowing great circle for a repeated eigenvalue, e.g. a shear). Render with `SpatialScene` `points` (instanced).
2. **Probe.** Keep the x / Ax pair; add a readout of `|Ax|/|x|` and the signed ratio ("Ax = −1.5·x").
3. **Reset.** Restore the *starting example* (diag(2, 1.5, 0.5), x = (1,1,1)), which is not an eigenvector. Add a separate **Identity** preset for the λ = 1 case. Rename `IDENTITY` (`:13`) → `START_MATRIX`.
4. **Reveal on request.** Rename Auto-Find to "Reveal dominant eigenvector" and say in the label that power iteration finds only the dominant one.
5. **Stretch (3b):** exact real eigenpairs for 3×3 (cubic + null-space) with tests against known matrices, to draw the exact eigen-lines.

**Acceptance:** at first paint no eigenvector is claimed; dragging x toward a glowing region turns the probe gold; rotation about Z shows only the Z-axis poles; shear shows a ring.

**Tests**
- Update the existing test (`LegacyLinearScenes.test.tsx:16-23`): it currently *asserts* the pre-solved Reset — change it to assert Reset restores the non-eigenvector start and the Identity preset gives λ = 1.00. Keep the zero-input and matrix-entry-editing tests unchanged.
- New pure tests: alignment is 1 for known eigenvectors (diag, symmetric), 0-residual for the shear's eigenplane, and < 1 elsewhere.

---

### P4 — Predict → reveal (M) *(after P2.1 and P3)*

**Why.** The strongest intuition-builder is committing to a guess first. A grep for predict/quiz/guess prompts in scenes, data and components returned nothing.

**Files:** new `components/layout/PredictPrompt.tsx` (+ test); adopt in 4 lessons.

**Design**
- Props: `question`, `options[]`, `correct` (index or computed), `explain(state)`; renders a radio group, **Lock in**, then feedback in an `aria-live` region and a "Skip" affordance. Ephemeral state by default; "don't ask again" may persist locally using the same try/catch pattern as `useGraphicsQuality`.
- Answers are **computed from the scene state**, not hard-coded text, so presets/sliders cannot make the explanation lie.

**First four adopters**

| Lesson | Prompt | Reveal |
|---|---|---|
| Bayes | "Of the flagged emails, about what share are spam?" (options built around the computed posterior) | Switch to *Only flagged* and show 90 of 180 |
| Gradient descent | "With η = 1.5, will it converge smoothly, oscillate then converge, or diverge?" | Run it |
| Eigenvalues | "How many real eigen-directions does a 90° rotation about Z have?" | Alignment map |
| Bias–variance | "Raise the degree 1 → 9: what happens to test error?" | Run it, show the U-shape |

**Acceptance:** fully keyboard operable; screen reader announces the result; skipping never blocks the lab.

**Tests:** select → lock → feedback; correctness derived from state; focus management.

---

### P5 — Shared `HeightField` and lab chrome for legacy scenes (L, incremental)

**Why.** `PlaneGeometry` height-field code is copy-pasted in 12 scenes (`Derivatives`, `GradientDescent`, `JacobianHessian`, `PartialDerivatives`, `RiemannVsLebesgue`, `DecisionBoundaries`, `GradientDescentML`, `LagrangeMultipliers`, `Distributions`, `LogLikelihood`, `ProbabilityVsLikelihood`, `VariationalInference`). Each also hand-rolls panel styling (up to 66 inline style objects).

#### 5.1 `HeightField` (M)

**Files:** new `components/3d/HeightField.tsx`.

- Props: `f(x, y)`, `extent`, `resolution`, `color`, `wireframe`, `opacity`; builds geometry once (`useMemo`), disposes it, and outputs **y-up** world coordinates directly (removes the `rotation=[-π/2,0,0]` group trick that causes the z-up/y-up confusion in tangent code).
- Migrate **one** scene first (`GradientDescent`, already in P2.1) and compare screenshots before touching the rest.

**Tests:** `@react-three/test-renderer` (pattern in `Derivatives.test.tsx`): vertex heights equal `f` at sampled points; geometry disposed on unmount.

#### 5.2 Migrate legacy scenes to lab chrome (L, ongoing)

Order by pain (inline-style count): `SigmaAlgebra` (66), `LebesgueMeasure` (44), `LinearDiscriminants` (44), `LpRegularization` (39), `LagrangeMultipliers` (38), `LogLikelihood` (32), `ProbabilityVsLikelihood` (28), `JacobianHessian`/`TaylorRemainder` (25).

Per scene: move controls to `LabRange`/`LabSelect`/`.lab-button`; add `metrics` + live `insight` + `challenge`; use `SpatialScene` where the data is points/paths/vectors/surfaces (SVG fallback comes free); add `legend`.
**Guardrail:** *no change to numerical code in the same PR*; existing numerical tests must pass untouched.

**Acceptance (programme level):** lessons without a non-WebGL fallback ≤ 10; inline style objects < 250.

---

### P6 — Navigation and previews (M)

**Why.** Learning paths exist but are only *surfaced* on the ML topic page (`TopicPage.tsx:144-167`); linear algebra, calculus and probability show a plain grid. Every card thumbnail is the same generic decoration (`SubtopicCardPreview` receives only `color`).

#### 6.1 Paths for the non-ML topics (S–M)

1. Extract the "Learning paths" block from `MLCurriculum` into `components/LearningPaths.tsx`, filtered by lessons that belong to a topic; render it on every `TopicPage`.
2. Add paths (data only, in `mlCurriculum.ts` — or split to `data/learningPaths.ts` if it grows):

   | Path id | Sequence |
   |---|---|
   | `la-foundations` | simple-test → vector-operations → matrix-transformations → eigenvalues → fundamental-subspaces |
   | `calculus-core` | derivatives → partial-derivatives → jacobian-hessian → gradient-descent-calc |
   | `calculus-accumulation` | integrals → riemann-integral → taylor-remainder |
   | `measure-theory` | riemann-integral → riemann-vs-lebesgue → sigma-algebra → lebesgue-measure → banach-tarski |
   | `probability-core` | distributions → monte-carlo → bayes-theorem → probability-vs-likelihood → log-likelihood → variational-inference |

3. Existing tests (`mlCurriculum.test.ts`, `LessonConnections.test.tsx`, `TopicPage.test.tsx`) assert path shape — extend rather than loosen.

**Acceptance:** each non-ML topic page lists its paths; "Start path" opens lesson 1 with `?path=`; Next/Prev works in-scene.

#### 6.2 Meaningful card previews (M, optional)

Add `preview?: 'surface' | 'vectors' | 'bars' | 'bell' | 'scatter' | 'tree' | 'network' | …` to `Subtopic`; draw ~10 inline-SVG motifs in `SubtopicCardPreview`; fall back to today's art when absent. Respect `prefers-reduced-motion`.

**Acceptance:** two lessons in the same topic no longer share an identical thumbnail.

---

### P7 — Release gates (every PR)

- [x] `npm run lint` clean · `npm test` green · `npm run build` green.
- [x] Manual check, desktop **and** 390 px: first paint shows key + lever + readout without opening the drawer.
- [x] WebGL2 off: lesson still meaningful (SVG fallback) or shows the guide; no blank stage.
- [x] Keyboard only: reach every control, operate sliders with arrow keys, `Esc` closes the drawer, focus is visible.
- [x] Reduced motion + "Pause motion": nothing auto-plays; manual control still works.
- [x] Light vs Detailed graphics both fine.
- [x] Guide updated (`meaning`, `steps`, `observe`, `limitations`) and `lessonGuides.test.ts` passes (2–3 steps each; each step > 15 chars).
- [ ] Screenshot before/after attached to the PR. Paired galleries are committed locally; remote PR publication is pending approval.

---

## 5. Order, sizing, and PR breakdown

### 5.1 Suggested sequence

| # | PR | Phase | Size | Why here |
|---|---|---|---|---|
| 1 | Baseline + confirmed scorecard | P0 | S | Know where we start |
| 2 | Palette module + tokens + parity test | 1.1, 1.4 | S | Everything else consumes it |
| 3 | `SceneKey` + `legend` slot + pilot scenes | 1.2 | M | Biggest R1 win, touches all legacy scenes |
| 4 | Fix collisions (`SpatialScene`, per-scene X/Y/Z) | 1.3 | S | Cheap, visible |
| 5 | Gradient descent lever | 2.1 | M | Highest teaching value per effort |
| 6 | Riemann vs Lebesgue totals | 2.6 | S | Highest value per line of code |
| 7 | Monte Carlo | 2.3 | M | |
| 8 | Derivatives slice + secant | 2.4 | M | |
| 9 | Integrals → accumulation | 2.2 | M | Pairs with 8 (FTC) |
| 10 | Eigenvalues rework | P3 | M | |
| 11 | Distributions / Subspaces Lite / Decision boundaries | 2.5, 2.8, 2.7 | M | |
| 12 | `PredictPrompt` + 4 adopters | P4 | M | Needs levers from 5 and 10 |
| 13 | `HeightField` + first migrations | P5 | L | |
| 14 | Paths on all topic pages | 6.1 | S–M | After lesson set stabilises |
| 15 | Card previews | 6.2 | M | Optional |

Rough total: about 4–6 weeks of one developer's focused time for PRs 1–15, front-loaded for visible results (PRs 3–6 give most of the perceived improvement). The wider legacy-scene migration (5.2) is open-ended and sized separately, one scene per PR.

### 5.2 Branching

New branch per PR from the integration branch (D6); keep PRs to one lesson or one shared piece. Do **not** commit `STATUS.md` (orchestrator metadata, untracked).

### 5.3 Definition of done for a lesson

A lesson PR is done when: rubric R1–R6 all ✓ (or ~ with a written reason), P7 gates pass, a numerical test covers any new computation, the guide is updated, the lesson id/route is unchanged.

---

## 6. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Palette changes alter lessons that look fine today | M | Alias old tokens; migrate shared layer first, scenes only when touched; before/after screenshots |
| Key overlay covers the canvas on phones | M | Collapse to a disclosure ≤ 768 px; `pointer-events:none`; test at 390 px |
| Existing tests encode behaviour I'm calling a flaw (Eigenvalues Reset) | H (known) | Change those tests deliberately in the same PR and say so in the description |
| Non-determinism (`Math.random`, `secureRandom`) hampers tests | M | Seed everything via `seededRandom`; reproducible by seed in UI |
| Scope creep inside lessons (new features, new math) | H | One lever per lesson; stretch items are labelled and separable |
| WebGL-only regressions invisible to jsdom | M | Manual visual gate in P7; keep `@react-three/test-renderer` tests for geometry |
| Prediction prompts feel like friction | M | Always skippable; remember dismissal; start with 4 lessons and observe |
| `learningPaths` data growing in `mlCurriculum.ts` | L | Split to `data/learningPaths.ts` in 6.1 if it exceeds ~300 lines |

---

## 7. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Axis colouring: coloured axis *lines* (today) vs neutral lines with `x`/`y`/`z` end labels, keeping RGB only for basis vectors e₁ e₂ e₃ and weight coordinates | **Neutral lines + end labels; RGB only on basis/weight glyphs**, always paired with a letter. Today's axis hues collide with three semantic roles (X≈error, Y≈focus, Z≈data). Trade-off: loses the "RGB = XYZ" orientation hint on the axis lines themselves. |
| D2 | `integrals`: repurpose as accumulation (2.2) vs keep bars and add n + total | **Repurpose** — `riemann-integral` already covers partitions; keep the route id. |
| D3 | `derivatives`: keep surface + slice/secant (A) vs replace with a 1-D lesson (B) | **A** — keeps the exported component and its finite-difference test. |
| D4 | `fundamental-subspaces-lite` and `decision-boundaries`: improve vs fold into sibling lessons | **Improve** (2.7/2.8) — cheaper than breaking routes/guides. |
| D5 | Predict prompts: persist "don't ask again"? | Yes, locally, same pattern as graphics/motion prefs. |
| D6 | Base branch for the work: `feat/public-beta-readiness` or `main`? | Whichever is the release line — confirm before PR 2. |
| D7 | Card previews (6.2): in scope? | Optional; decide after PR 14. |

---

## 8. Noticed, out of scope

- `agents.md` (lowercase) is an unrelated "root cause analysis" note that differs from `AGENTS.md`; on case-insensitive filesystems they collide. Rename or remove.
- `STATUS.md` is untracked orchestrator metadata; keep out of commits.
- `Math.random()` at module scope in `Distributions` and `DecisionBoundaries` makes their output differ on every load (addressed in 2.5/2.7).
- `README.md` should be updated at the end of P2/P6 (feature list, lesson counts, fallback counts).

---

## 9. Implementation record

P0–P6 are implemented on `feat/visual-intuition-plan`. The work has 23 scoped review branches, including one per legacy migration, followed by a release-evidence branch. All lesson URLs remain stable.

| Measure | Before | Implemented | Target |
|---|---:|---:|---:|
| Assessed families scoring at least 5/6 | 1/10 | 10/10 (all 6/6) | 10/10 |
| Dead lessons without an interactive lever | 5 | 0 | 0 |
| Scene hex literals (non-test, 3–8 digits) | 1046 | 197 | < 400 |
| Shared 3D hex literals outside the palette | 29 | 0 | 0 |
| Inline scene style objects | 723 | 241 | < 250 |
| Challenges / prediction adopters | 14 / 0 | 34 / 4 | ≥ 25 combined |
| Graphic lessons without WebGL2 | 49/75 | 67/75 | ≥ 65/75 |
| Learning paths | 11 | 16 | 5 added |

Resolved decisions: D1 neutral named axes; D2 signed accumulation; D3 surface plus slice/secant; D4 improve both existing routes; D5 local prediction dismissal; D6 use the existing release branch `feat/public-beta-readiness`; D7 include ten static preview motifs. The output role is `#8b5cf6` after the proposed lighter violet failed color-vision distinguishability. The palette script reports no failures.

The optional anisotropic-bowl control (2.1b) and exact cubic eigenpair solver (3b) remain stretch work. The eigen alignment map is sampled and does not claim exact eigen-lines. Eight older lessons retain a guide and controls without a graphical non-WebGL fallback, meeting the plan’s ≤ 10 limit.

Validation and screenshot evidence live in [docs/validation/visual-intuition.md](docs/validation/visual-intuition.md). `STATUS.md` remains untracked and untouched.

---

## Appendix A — Original source evidence (commit `a5b3c9d`)

| Claim | Where |
|---|---|
| Panel closed by default; key lives in drawer | `components/layout/SceneContainer.tsx:83`; `scenes/calculus/Derivatives.tsx:89-94` |
| Brief header only when `controls && lesson && guide` | `SceneContainer.tsx:107-110` |
| `VisualLegend` used in one scene | `grep VisualLegend` → `VectorOperations.tsx` only |
| `SceneAxisKey` used in 3 scenes, each with its own X/Y/Z colours | `PartialDerivatives.tsx:238` (`#f43f5e/#10b981/#3b82f6`), `JacobianHessian.tsx:233` (`#f87171/#34d399/#60a5fa`), `LagrangeConstraints.tsx:287` (`#ef4444/#22c55e/#3b82f6`) |
| `SpatialScene` Z axis = default point colour; X axis = residual colour | `components/3d/SpatialScene.tsx:11`; `scenes/ml/RegressionLab.tsx` (`label: 'Residual'`, `#fb7185`) |
| Eigenvalues slider colours ≠ drawn axis colours | `Eigenvalues.tsx:222` (red/green/blue) vs `SpatialScene.tsx:11` (red/amber/blue) |
| Basis arrows green vs Y axis amber | `MatrixTransformations.tsx:10` vs `SpatialScene.tsx:11` |
| Eigenvalues Reset pre-solves | `Eigenvalues.tsx:124-126`, header `:166`; test `LegacyLinearScenes.test.tsx:15-22` |
| `IDENTITY` constant is diag(2, 1.5, 0.5) | `Eigenvalues.tsx:13` |
| GD learning rate/start fixed | `optimization.ts:22`, `GradientDescent.tsx:14`, guide `limitations` |
| Integrals animates in time, no total | `Integrals.tsx:14-24`; `topics.ts:102` |
| Monte Carlo stops at 500, uses `secureRandom` | `MonteCarlo.tsx:21,25-27` |
| Riemann vs Lebesgue shows no totals; skips cells < 0.1 | `RiemannVsLebesgue.tsx:87`, controls `:194-430` |
| Learning paths surfaced only on ML page | `TopicPage.tsx:144-167`, `:205-211` |
| Card thumbnail gets only `color` | `TopicPage.tsx:36` |
| 26 of 75 lessons lack non-WebGL graphics | `README.md` ("Using a lesson") |
| Seeded RNG available | `utils/regression.ts` (`seededRandom`, `sampleNormal`) |
| Baseline counts | 45 scene files; 723 inline `style={{`; 1029 hex literals in scenes; 32 in `components/3d`; 71 test files / 395 tests |

## Appendix B — Pattern-inferred lessons (not read in full)

From `grep` of state/inputs/inline-style counts. Verify in P0 before acting.

| Lesson | Signals | Likely gap |
|---|---|---|
| `calculus/sigma-algebra` | 714 lines, 66 inline styles, 3 state hooks | Heavy; migration candidate (P5.2) |
| `calculus/lebesgue-measure` | 414 lines, 44 inline styles | Same |
| `ml/linear-discriminants` | 491 lines, 44 inline styles (2D SVG already) | Chrome migration only |
| `ml/gradient-descent-ml` | 97 lines, 3 state, 0 inputs | Same lever gap as 2.1 — share the work |
| `ml/measure-theory-ml`, `linear-algebra/banach-tarski` | 0 inputs, buttons only | Conceptual; lower priority |
| `probability/variational-inference` | 486 lines, README calls it a "conceptual illustration" | Keep the disclaimer prominent |
