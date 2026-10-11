# Visual-intuition review series

The completed implementation is published to the existing public [kronos3610/math3d](https://github.com/kronos3610/math3d) repository as PRs **#35–#58**. The first branch targets the existing release line; each subsequent branch targets its predecessor. Review and merge in the order below. No PRs have been merged and no deployment has been performed.

The product work comprises 23 scoped stages; the final branch adds README/plan status and validation evidence. `STATUS.md` is excluded.

| Order | PR | Branch | Base | Product commit | Change |
|---|---|---|---|---|---|
| 1 | [#35](https://github.com/kronos3610/math3d/pull/35) | `feat/intuition-baseline` | `feat/public-beta-readiness` | `6b891280` | Confirm the visual-intuition baseline |
| 2 | [#36](https://github.com/kronos3610/math3d/pull/36) | `feat/intuition-grammar` | `feat/intuition-baseline` | `1fc6d88f` | Unify plot keys, semantic colours and shared scene geometry |
| 3 | [#37](https://github.com/kronos3610/math3d/pull/37) | `feat/intuition-descent` | `feat/intuition-grammar` | `e9adb584` | Expose gradient-descent learning rates and starting points |
| 4 | [#38](https://github.com/kronos3610/math3d/pull/38) | `feat/intuition-integration-slices` | `feat/intuition-descent` | `51c7053b` | Show Riemann and Lebesgue estimates beside their slices |
| 5 | [#39](https://github.com/kronos3610/math3d/pull/39) | `feat/intuition-monte-carlo` | `feat/intuition-integration-slices` | `97cd803f` | Make Monte Carlo reproducible and show error convergence |
| 6 | [#40](https://github.com/kronos3610/math3d/pull/40) | `feat/intuition-derivatives` | `feat/intuition-monte-carlo` | `46631e0b` | Link surface slices, secants and tangent slopes |
| 7 | [#41](https://github.com/kronos3610/math3d/pull/41) | `feat/intuition-accumulation` | `feat/intuition-derivatives` | `cf31c42b` | Connect signed-area accumulation with its slope |
| 8 | [#42](https://github.com/kronos3610/math3d/pull/42) | `feat/intuition-eigenvalues` | `feat/intuition-accumulation` | `cb9e7ee2` | Let learners find eigen-directions with an alignment map |
| 9 | [#43](https://github.com/kronos3610/math3d/pull/43) | `feat/intuition-distributions` | `feat/intuition-eigenvalues` | `ba61532d` | Manipulate Gaussian spread, correlation and seeded samples |
| 10 | [#44](https://github.com/kronos3610/math3d/pull/44) | `feat/intuition-boundaries` | `feat/intuition-distributions` | `b6209565` | Move 3D decision boundaries and count their mistakes |
| 11 | [#45](https://github.com/kronos3610/math3d/pull/45) | `feat/intuition-subspace-input` | `feat/intuition-boundaries` | `358aed16` | Drive input vectors through orthogonal subspace components |
| 12 | [#46](https://github.com/kronos3610/math3d/pull/46) | `feat/intuition-predict` | `feat/intuition-subspace-input` | `20164b20` | Reveal computed Bayes and bias-variance results after a prediction |
| 13 | [#47](https://github.com/kronos3610/math3d/pull/47) | `feat/intuition-sigma-algebra` | `feat/intuition-predict` | `30840885` | Expose sigma-algebra atoms and closure operations |
| 14 | [#48](https://github.com/kronos3610/math3d/pull/48) | `feat/intuition-lebesgue-measure` | `feat/intuition-sigma-algebra` | `74cbed73` | Expose measure-covering controls and live estimates |
| 15 | [#49](https://github.com/kronos3610/math3d/pull/49) | `feat/intuition-linear-discriminants` | `feat/intuition-lebesgue-measure` | `b56845d7` | Keep discriminant controls and query points visible |
| 16 | [#50](https://github.com/kronos3610/math3d/pull/50) | `feat/intuition-lp-regularization` | `feat/intuition-linear-discriminants` | `ac6d511f` | Show the live regularization budget and feasible region |
| 17 | [#51](https://github.com/kronos3610/math3d/pull/51) | `feat/intuition-lagrange-multipliers` | `feat/intuition-lp-regularization` | `277ccd6e` | Link constrained positions to objective and multiplier |
| 18 | [#52](https://github.com/kronos3610/math3d/pull/52) | `feat/intuition-log-likelihood` | `feat/intuition-lagrange-multipliers` | `cb97e1cd` | Show Gaussian likelihood and log scores beside their controls |
| 19 | [#53](https://github.com/kronos3610/math3d/pull/53) | `feat/intuition-probability-likelihood` | `feat/intuition-log-likelihood` | `91fdc6a2` | Separate the varied axes for probability and likelihood |
| 20 | [#54](https://github.com/kronos3610/math3d/pull/54) | `feat/intuition-jacobian-hessian` | `feat/intuition-probability-likelihood` | `fb4436e8` | Link the surface point to its gradient and Hessian |
| 21 | [#55](https://github.com/kronos3610/math3d/pull/55) | `feat/intuition-taylor-remainder` | `feat/intuition-jacobian-hessian` | `cc8448df` | Expose Taylor approximation controls and live remainder |
| 22 | [#56](https://github.com/kronos3610/math3d/pull/56) | `feat/intuition-paths` | `feat/intuition-taylor-remainder` | `3269aed0` | Surface learning paths on every topic page |
| 23 | [#57](https://github.com/kronos3610/math3d/pull/57) | `feat/intuition-previews` | `feat/intuition-paths` | `68541e93` | Give lesson cards ten distinct static visual previews |
| 24 | [#58](https://github.com/kronos3610/math3d/pull/58) | `feat/visual-intuition-plan` | `feat/intuition-previews` | `release evidence` | Record the visual-intuition release checks and before/after evidence |

All 23 product commits independently pass lint, full tests and build; palette validation also passes from its introduction in stage 2. The final suite has 455 tests across 86 files. See the [commit report](visual-intuition-commits.json), [release report](visual-intuition.md), and [paired screenshots](visual-intuition-pairs.json). Each PR body links its relevant before/after galleries.
