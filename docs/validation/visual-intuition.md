# Visual-intuition implementation validation

The required P0–P6 product work in `plan.md` is implemented. All ten assessed lesson families now score 6/6 on the plan’s intuition rubric. This is a browser review of the specified teaching criteria, not a formal accessibility certification.

The implementation adds visible plot keys and semantic colors; editable descent, derivative, accumulation, integration, sampling, boundary and subspace experiments; an unsolved eigen-direction map; four computed prediction prompts; nine legacy lab migrations; five learning paths; and ten static preview motifs. Lesson routes remain stable.

## Release checks

Validation uses Node 24. The final production build passes TypeScript and Vite. The complete suite passes **455 tests in 86 files**; lint and the palette check pass. The production dependency audit reports **zero vulnerabilities**. Every product commit is additionally checked from a clean Git archive with the installed locked dependencies; results are in the [commit report](visual-intuition-commits.json).

The shared renderer still produces Vite’s advisory chunk-size warning. Tests use a software GPU for WebGL and a separate browser with WebGL disabled; they do not establish frame rates on physical devices.

## Browser checks

The baseline comprised 52 cases on the release base `a5b3c9d`. The combined implementation was tested over **300 cases**: all 75 lesson routes, desktop 1440×1000 and mobile 390×900, with WebGL on and off. There were no runtime, console, network or load failures, horizontal overflows, or unnamed visible controls. All 252 available first-range changes updated the page.

In total, 496 functional cases passed. Post-fix checks covered the 52 baseline cases again, 88 owned parameter/mode combinations, computed prediction and keyboard interactions, reduced motion and manual playback, both graphics qualities, and non-ML learning-path navigation. A final four-case production pass verified the changed subspace camera. Details are in the [browser report](visual-intuition-browser.json), with the initial all-route cases in the [route report](visual-intuition-routes.json).

| Assessed family | Before / 6 | After / 6 |
|---|---:|---:|
| Regression | 5 | 6 |
| Bayes | 4.5 | 6 |
| Matrix transformations | 4 | 6 |
| Vector operations | 2.5 | 6 |
| Eigenvalues | 3 | 6 |
| Riemann versus Lebesgue | 1 | 6 |
| Monte Carlo | 0.5 | 6 |
| Gradient descent | 0 | 6 |
| Derivatives | 0 | 6 |
| Integrals | 0 | 6 |

Mobile plot keys intentionally show a compact summary with object names; their meanings open through a keyboard-accessible disclosure, as requested by P1.2.

## Programme targets

The [metrics report](visual-intuition-metrics.json) records the counting method and corrects the plan’s original source-inferred counts. Non-test TypeScript scene files have **197 hex literals** and **241 inline style objects**, below the targets of 400 and 250. Shared 3D source has **zero color literals** outside the palette. Scenes have **34 challenge props** and **four prediction adopters**. All five formerly dead lessons now have interactive levers.

There are **16 learning paths**. Of 75 lessons, **67 retain graphics without WebGL2**. The eight guide-only alternatives are fundamental subspaces, Banach–Tarski, partial derivatives, Riemann integral, variational inference, measure theory for ML, Lagrange constraints, and Gaussian mixture. Each keeps its guide, controls and rendering notice; the plan permits up to ten.

The palette [validation output](palette-validation.json) has no failures. Semantic marker/line contrast is at least 4.52:1 on the assessed dark backgrounds. The smallest pairwise simulated color-vision distance is 11.08 (CIELAB ΔE76; threshold 10). Text and shapes also carry meanings; basis glyphs are explicitly identified by coordinate letters.

## Before and after

Each gallery pairs the exact release-base view on the left with the implementation on the right. Split 1 contains regression, Bayes, matrix transformations, vectors and eigenvalues. Split 2 contains Riemann/Lebesgue, Monte Carlo, descent, derivatives and accumulation.

| Renderer | Desktop | Mobile |
|---|---|---|
| WebGL | [1](visual-intuition-before-after-webgl-desktop-1.jpg), [2](visual-intuition-before-after-webgl-desktop-2.jpg) | [1](visual-intuition-before-after-webgl-mobile-1.jpg), [2](visual-intuition-before-after-webgl-mobile-2.jpg) |
| Native / SVG | [1](visual-intuition-before-after-no-webgl-desktop-1.jpg), [2](visual-intuition-before-after-no-webgl-desktop-2.jpg) | [1](visual-intuition-before-after-no-webgl-mobile-1.jpg), [2](visual-intuition-before-after-no-webgl-mobile-2.jpg) |

Additional paired galleries:

| Changes | Desktop | Mobile |
|---|---|---|
| Extra lever pilots, WebGL | [Gallery](visual-intuition-pairs-extra-pilots-webgl-desktop.jpg) | [Gallery](visual-intuition-pairs-extra-pilots-webgl-mobile.jpg) |
| Extra lever pilots, native / SVG | [Gallery](visual-intuition-pairs-extra-pilots-no-webgl-desktop.jpg) | [Gallery](visual-intuition-pairs-extra-pilots-no-webgl-mobile.jpg) |
| Nine legacy migrations | [Gallery](visual-intuition-pairs-legacy-desktop.jpg) | [Gallery](visual-intuition-pairs-legacy-mobile.jpg) |
| Four topic pages | [Gallery](visual-intuition-pairs-topics-desktop.jpg) | [Gallery](visual-intuition-pairs-topics-mobile.jpg) |
| Static card previews | [Gallery](visual-intuition-pairs-topic-previews-desktop.jpg) | [Gallery](visual-intuition-pairs-topic-previews-mobile.jpg) |

## Scope and review

The optional anisotropic bowl and exact cubic eigenpair solver are deferred stretch items. The direction map is sampled, and the guide states that limitation. Existing legacy numerical helpers retain their behavior; their lab controls, plots and readouts use the same computations.

The [review series](visual-intuition-review.md) lists the scoped branches, bases and commits. Source and evidence are committed and published as [24 scoped PRs](visual-intuition-review.md), with paired screenshots attached. Their GitHub validation status is visible in each PR. `STATUS.md` remains untouched and untracked.
