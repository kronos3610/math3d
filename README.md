# Math3D - Interactive 3D Mathematics

Math3D is an interactive educational platform designed to visualize complex mathematical concepts using 3D graphics. Built with **React**, **TypeScript**, and **React Three Fiber**, it offers an immersive way to explore Linear Algebra, Calculus, Probability, and Machine Learning.

## Features

- **Interactive 3D Visualizations**: Rotate, zoom, and interact with mathematical objects.
- **Topic-Based Organization**: Structured curriculum covering key mathematical fields.
- **Responsive Design**: Accessible on desktop and mobile devices.
- **Performance Optimized**: Uses WebGL for high-performance rendering.
- **Lesson Guides**: Brief meanings, usage steps, observations, and caveats for every lesson.

## Getting Started

### Prerequisites

- Node.js 20.19+, 22.12+, or 24+ (supported even-numbered releases)
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd math3d
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.

## Machine learning curriculum

The ML module has Algorithms and Core Concepts sections, with one canonical URL per lesson. Browse `/ml`, `/ml?section=algorithms`, or `/ml?section=concepts`.

`src/data/mlCurriculum.ts` defines families, learning paths, prerequisites, and related lessons. Four paths connect classification, generalization, mixture estimation, and neural-network optimization to existing math lessons. A scene's Learn panel provides previous/next navigation and links back to its concepts and prerequisites. Path context is retained only when the destination belongs to the selected path.

The Bias–Variance and Signal-to-Noise labs use seeded polynomial-regression experiments with a stable Legendre-basis QR solver and a fixed small ridge penalty. Bias–Variance measures a finite ensemble of independent fits and explains the distinction between its grid decomposition and sampled test MSE. SNR uses centered signal variance over the specified input distribution and handles zero signal and zero noise explicitly. Both include accessible charts, textual measurements, and keyboard-accessible controls.

## Using a lesson

Open the scene panel for controls and a brief introduction. The Guide tab explains what the scene means, how to use it, and what to look for. The Explain tab gives more detail, and Learn links related lessons. Guides are also available while a scene loads or if it fails to start.

3D lessons default to Light graphics (one pixel per device-independent pixel, without shadows). Select Detailed in Guide for sharper rendering and scene shadows; the preference is saved on this browser. Static scenes render when their controls or camera change. Vector labels use HTML, avoiding external font downloads that the site's content security policy blocks.

Bayes' theorem uses a beginner walkthrough of a fictional spam filter. It follows 1,000 emails into the flagged group, explains false alarms and the changing denominator, then connects the counts to prior, likelihood, evidence, and posterior. Sliders and presets update the worked example; evidence is calculated from the catch rate and false alarm rate. No flags gives an undefined conditional probability. This lesson uses HTML and SVG without requiring WebGL.

The classification lab starts with an example and identifies each model's output and decision rule. Logistic regression estimates a class probability, least squares fits a raw score to binary targets, and the perceptron learns a signed margin. Ordinary linear regression predicts a continuous number; the lab uses its least-squares method as a classifier. Its SVG plot supports mouse and keyboard point placement.

## Validation

Install the locked dependencies with `npm ci`, then run:

```bash
npm run lint
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

## License

This project is licensed under the MIT License.
