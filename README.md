# Math3D - Interactive 3D Mathematics

Math3D is an interactive educational platform designed to visualize complex mathematical concepts using 3D graphics. Built with **React**, **TypeScript**, and **React Three Fiber**, it offers an immersive way to explore Linear Algebra, Calculus, Probability, and Machine Learning.

## Features

- **Interactive 3D Visualizations**: Rotate, zoom, and interact with mathematical objects.
- **Topic-Based Organization**: Structured curriculum covering key mathematical fields.
- **Responsive Design**: Accessible on desktop and mobile devices.
- **Performance Optimized**: Uses WebGL for high-performance rendering.
- **Visual ML Labs**: Manipulate actual fits, state updates, gates, attention mixtures, and optimization trajectories.
- **Lesson Guides**: Brief meanings, usage steps, observations, and caveats for every lesson; deeper explanations are optional.

## Getting Started

### Prerequisites

- Node.js 24 (recommended; `.nvmrc`), or Node.js 22.12+
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd math3d
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.

## Machine learning curriculum

The ML module has **52 lessons**, divided into Algorithms and Core Concepts, with one canonical URL per lesson. Browse `/ml`, `/ml?section=algorithms`, or `/ml?section=concepts`. Search lesson names, descriptions, families, and common abbreviations such as HMM, SVR, and GQA. Search and section filters are stored in the URL; family links jump to the relevant group.

The expanded curriculum adds **38 labs** and upgrades the existing feedforward network to compute and train a small XOR network:

| Family | New labs | Examples |
| --- | ---: | --- |
| Regression | 4 | Prediction planes, assumptions, QR/SVD and iterative solvers, feature maps and ridge |
| Trees and ensembles | 5 | CART, bagging/random forests, boosting/AdaBoost, XGBoost, LightGBM |
| Support vectors | 3 | Linear margins, exact finite feature lift/RBF, epsilon-SVR |
| Sequence models | 4 | HMM filtering/Viterbi/EM, RNN, LSTM, GRU |
| Transformers | 10 | Q/K/V, blocks, architecture, positions, caches/GQA/MLA, sparse/linear attention, experts, image patches, tiled attention, segment memory |
| State-space models | 5 | Fixed SSM, Mamba, Mamba-2, Mamba-3, attention/state-space hybrids |
| Shared concepts | 7 | Embeddings, softmax, normalization/residuals, temporal gradients, losses, conditioning, validation |

`src/data/mlCurriculum.ts` and `src/data/mlVisualLessons.ts` define families, **16 learning paths**, prerequisites, related lessons, and the new lesson guides. A scene's Learn panel provides previous/next navigation and links to its concepts and prerequisites. Path context is retained only when the destination belongs to the selected path. Every topic page exposes relevant learning paths and distinct static lesson previews. Existing mathematical lessons link back to models that use them.

Try `/ml/linear-regression`, `/ml/regression-solvers`, `/ml/decision-trees`, `/ml/lstm`, `/ml/attention`, or `/ml/mamba3` after starting the development server. New labs open with a large visualization, visible controls, a short observation, and calculated measurements. Play reveals precomputed steps only when requested. The optional Explain panel contains equations, assumptions, applications, and model-specific limits.

The visual coordinates represent stated numerical quantities. Examples include input/response coordinates for regression, actual hidden/cell vectors for recurrence, query/key or value coordinates for attention, and real/imaginary coordinates for complex state. Time, tree depth, and categorical layout axes are identified separately. Shared scenes preserve angles and relative lengths by default, use instanced points and demand rendering, fit the camera to the viewport, and offer an SVG view when WebGL is unavailable.

The numerical engines in `src/utils/ml-*.ts` compute the plotted quantities rather than substituting decorative animation. They include QR/SVD and real iterative regression updates; bounded dual SVM/SVR optimization; trained CART and ensemble updates; normalized HMM inference and Baum–Welch; recurrent gates and checked backpropagation; attention projections, softmax, residual/normalization/feed-forward blocks, real cache storage, and online tiled accumulation; and selective state-space recurrences with structured duality. Controls alter those calculations, and tests check numerical invariants and independent reference cases.

These are small teaching engines with synthetic observations or explicit demonstration weights. They isolate algorithm mechanisms; they are not complete XGBoost/LightGBM libraries, pretrained language or vision models, production Mamba blocks, GPU FlashAttention kernels, or hardware speed benchmarks. Cache/state bytes count the retained float32 mixer entries, not total model memory. A feature-space or state-space visualization does not establish causal meaning, learned semantics, or generalization. Each lesson explains its particular assumptions and boundaries.

The Bias–Variance and Signal-to-Noise labs use seeded polynomial-regression experiments with a stable Legendre-basis QR solver and a fixed small ridge penalty. Bias–Variance measures a finite ensemble of independent fits and explains the distinction between its grid decomposition and sampled test MSE. SNR uses centered signal variance over the specified input distribution and handles zero signal and zero noise explicitly. Both include accessible charts, textual measurements, and keyboard-accessible controls.

## Using a lesson

The new ML labs keep controls beside the visualization; older lessons place controls in the scene panel. All lessons open with the plot visible. Older lessons show a compact title and meaning above it. Use Guide & controls to open the drawer; on desktop the plot reserves space beside it. The Guide tab explains how to use the scene and what to look for. Explain gives more detail, and Learn links related lessons. Guides remain available while a scene loads or if it fails to start.

Focus a 3D canvas to rotate with arrow keys and zoom with +/−. Pause motion stops automatic animation and playback while keeping manual camera changes and Step available. The browser's reduced-motion preference pauses motion by default; explicit choices are saved locally. Formulas, UI fonts, and mathematical fonts are served with the app, without external CDN requests. A failed decorative homepage scene leaves topic navigation available, and failed speculative lesson imports can retry on a subsequent visit.

A shared semantic palette and plot keys explain the stage without opening the scene panel. The legacy upgrades include learning-rate regimes, secants approaching tangents, signed-area accumulation, two integration estimates, seeded Monte Carlo error traces, correlated Gaussian sampling, editable 3D boundaries, live subspace decomposition, and eigen-direction alignment maps. Bayes, gradient descent, eigenvalues and bias–variance offer skippable predictions with computed answers. All routes remain stable. The [visual-intuition validation report](docs/validation/visual-intuition.md) records the release checks, limitations and before/after screenshots.

Full 3D views require WebGL2. Of the 75 lessons, 67 retain native or SVG graphics when WebGL2 is unavailable. The remaining 8 older lessons retain their guide and controls with a rendering notice; use a browser with hardware acceleration to view their geometry.

Trees open in input space. A threshold wall is clipped to the current node's region, a white outline shows the query's active region, and the linked diagram follows the same computed path. Choose two features on a floor or three real features in a cube; x₃ is a feature, not prediction height. The separate prediction view plots output height, with a declared fixed-x₃ slice for three-feature models. Ensemble views distinguish one selected tree's correction/region from the aggregate prediction.

3D lessons default to Light graphics (one pixel per device-independent pixel, without shadows). Select Detailed in Guide for sharper rendering and scene shadows; the preference is saved on this browser. Static scenes render when their controls or camera change. Vector labels use HTML, avoiding external font downloads that the site's content security policy blocks.

Bayes' theorem opens with a 3D email population. All emails, Highlight flags, and Only flagged animate selection into an enlarged conditional group; compact sliders and presets update its spam/ordinary mix. A single instanced mesh keeps the tile cost bounded, and partial tiles preserve fractional expected counts. The beginner walkthrough, false alarms, formula, and glossary remain in the optional Explain panel. Evidence is calculated from both flagging rates, and no flags gives an undefined conditional probability. Devices without WebGL2 receive an SVG probability-area view.

The classification lab starts with an example and identifies each model's output and decision rule. Logistic regression estimates a class probability, least squares fits a raw score to binary targets, and the perceptron learns a signed margin. Ordinary linear regression predicts a continuous number; the lab uses its least-squares method as a classifier. Its SVG plot supports mouse and keyboard point placement.

## Validation

Install the locked dependencies with `npm ci`, then run:

```bash
npm run lint
npm run check:palette
npm test
npm run build
```

Vitest discovers both `.test.ts` and `.test.tsx` files recursively, including numerical, DOM accessibility, and Three.js animation tests. DOM tests do not replace a visual browser check of WebGL scenes on desktop and mobile.

The variational-inference scene is a conceptual illustration. Its unnormalized shapes and illustrative values do not represent a numerical optimizer or calculated ELBO/KL estimates.

## Project Structure

```
src/
├── components/       # UI components (Sidebar, Layout, etc.)
│   └── 3d/           # Shared 3D components (Arrow, Axis, Label)
├── data/             # Topic definitions and static data
├── scenes/           # 3D visualization scenes grouped by topic
│   ├── linear-algebra/
│   ├── calculus/
│   ├── probability/
│   └── ml/
├── utils/            # Numerical engines and shared mathematical utilities
├── App.tsx           # Main application entry point
└── index.css         # Global styles and themes
```

## Technologies

- **Vite**: Fast build tool and dev server.
- **React**: UI library.
- **React Three Fiber (R3F)**: React renderer for Three.js.
- **Three.js**: 3D graphics library.
- **TypeScript**: Static typing for safer code.
- **CSS**: Custom styles and theme variables in `src/index.css`.

## Contributing

Please refer to `AGENTS.md` for coding standards and architectural guidelines.

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## Static hosting

Build with Node.js 24 and `npm ci && npm run build`. Deploy the contents of `dist` at the domain root, including generated `THIRD-PARTY-NOTICES.txt` with the bundled library and font notices. `npm run preview` is a local inspection server, not a production hosting service.

Netlify reads `netlify.toml` for the build, publish directory, and SPA fallback. The build emits `dist/_headers` from `deployment/security.ts`. Vercel reads `vercel.json`; select Node.js 24 in its project settings. Both configurations preserve real asset files and exclude missing `/assets/*` files from the lesson rewrite, so a deleted chunk produces an asset error rather than HTML served as JavaScript. HTML revalidates; hashed assets can be cached for a year.

The production policy permits scripts, fonts, and connections only from this site. Inline styles are required by React Three Fiber and the layout. HTTP headers also restrict framing, disable unused camera/microphone/location permissions, and set HTTPS and content-type protections. Development alone permits Vite's injected refresh script and WebSocket connection. If you deliberately embed the app in another site, change the framing policy before deployment.

The GitHub Validate workflow runs locked installation, lint, tests, production build, and a production dependency audit on pull requests and pushes to `main`. Before publishing, verify `/ml/decision-trees` on a direct load and refresh, check a missing asset returns 404, and inspect the deployed response headers. Provider configuration is prepared in this repository; creating these files does not publish a site or select an account.
