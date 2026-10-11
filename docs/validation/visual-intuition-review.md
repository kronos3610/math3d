# Visual-intuition review series

Publication destination: **https://github.com/kronos3610/math3d** (the existing public repository; current GitHub access is ADMIN). The first branch targets the existing release line; each subsequent branch targets its predecessor. None of these new review branches or PRs has been published.

The product work is committed in 23 scoped stages; the final branch adds README/plan status and validation evidence. `STATUS.md` is excluded. The publication payload consists only of these branches and their PR descriptions, with no merge or deployment.

| Order | Branch | Base | Commit | Change |
|---|---|---|---|---|
| 1 | `feat/intuition-baseline` | `feat/public-beta-readiness` | `6b891280` | Confirm the visual-intuition baseline |
| 2 | `feat/intuition-grammar` | `feat/intuition-baseline` | `1fc6d88f` | Unify plot keys, semantic colours and shared scene geometry |
| 3 | `feat/intuition-descent` | `feat/intuition-grammar` | `e9adb584` | Expose gradient-descent learning rates and starting points |
| 4 | `feat/intuition-integration-slices` | `feat/intuition-descent` | `51c7053b` | Show Riemann and Lebesgue estimates beside their slices |
| 5 | `feat/intuition-monte-carlo` | `feat/intuition-integration-slices` | `97cd803f` | Make Monte Carlo reproducible and show error convergence |
| 6 | `feat/intuition-derivatives` | `feat/intuition-monte-carlo` | `46631e0b` | Link surface slices, secants and tangent slopes |
| 7 | `feat/intuition-accumulation` | `feat/intuition-derivatives` | `cf31c42b` | Connect signed-area accumulation with its slope |
| 8 | `feat/intuition-eigenvalues` | `feat/intuition-accumulation` | `cb9e7ee2` | Let learners find eigen-directions with an alignment map |
| 9 | `feat/intuition-distributions` | `feat/intuition-eigenvalues` | `ba61532d` | Manipulate Gaussian spread, correlation and seeded samples |
| 10 | `feat/intuition-boundaries` | `feat/intuition-distributions` | `b6209565` | Move 3D decision boundaries and count their mistakes |
| 11 | `feat/intuition-subspace-input` | `feat/intuition-boundaries` | `358aed16` | Drive input vectors through orthogonal subspace components |
| 12 | `feat/intuition-predict` | `feat/intuition-subspace-input` | `20164b20` | Reveal computed Bayes and bias-variance results after a prediction |
| 13 | `feat/intuition-sigma-algebra` | `feat/intuition-predict` | `30840885` | Expose sigma-algebra atoms and closure operations |
| 14 | `feat/intuition-lebesgue-measure` | `feat/intuition-sigma-algebra` | `74cbed73` | Expose measure-covering controls and live estimates |
| 15 | `feat/intuition-linear-discriminants` | `feat/intuition-lebesgue-measure` | `b56845d7` | Keep discriminant controls and query points visible |
| 16 | `feat/intuition-lp-regularization` | `feat/intuition-linear-discriminants` | `ac6d511f` | Show the live regularization budget and feasible region |
| 17 | `feat/intuition-lagrange-multipliers` | `feat/intuition-lp-regularization` | `277ccd6e` | Link constrained positions to objective and multiplier |
| 18 | `feat/intuition-log-likelihood` | `feat/intuition-lagrange-multipliers` | `cb97e1cd` | Show Gaussian likelihood and log scores beside their controls |
| 19 | `feat/intuition-probability-likelihood` | `feat/intuition-log-likelihood` | `91fdc6a2` | Separate the varied axes for probability and likelihood |
| 20 | `feat/intuition-jacobian-hessian` | `feat/intuition-probability-likelihood` | `fb4436e8` | Link the surface point to its gradient and Hessian |
| 21 | `feat/intuition-taylor-remainder` | `feat/intuition-jacobian-hessian` | `cc8448df` | Expose Taylor approximation controls and live remainder |
| 22 | `feat/intuition-paths` | `feat/intuition-taylor-remainder` | `3269aed0` | Surface learning paths on every topic page |
| 23 | `feat/intuition-previews` | `feat/intuition-paths` | `68541e93` | Give lesson cards ten distinct static visual previews |
| 24 | `feat/visual-intuition-plan` | `feat/intuition-previews` | `release evidence` | Record the visual-intuition release checks and before/after evidence |

All product commits have independent lint, full-test, palette (where available) and build checks. See the [commit report](visual-intuition-commits.json), [release report](visual-intuition.md), and [paired screenshots](visual-intuition-pairs.json). Prepared individual PR bodies are retained locally in `/tmp/math3d-plan-pr-bodies/`.

Automatic approval review rejected the attempt to push the 23 product branches, citing potentially private source/history and insufficient destination-specific authorization. The repository was then verified to be public with ADMIN access; the added tracked lines contain no matches for common private-key, GitHub-token, AWS-key or live API-key patterns. Publication remains pending; no alternative push has been attempted.
