/** Short guidance is available before a scene loads, without importing its renderer. */
import { mlVisualLessons } from './mlVisualLessons';
export interface LessonGuide {
    meaning: string;
    steps: readonly string[];
    observe: string;
    limitations?: string;
}

export const lessonGuides: Readonly<Record<string, Readonly<Record<string, LessonGuide>>>> = {
    'linear-algebra': {
        'simple-test': {
            meaning: 'Three coordinates locate a point relative to X, Y, and Z axes. A camera change alters the view without changing these coordinates.',
            steps: ['Select a cube corner and compare its coordinates with the labelled axes.', 'Orbit or use the keyboard camera controls; check that the corner coordinates stay fixed.'],
            observe: 'The cube has side length two, corners (±1, ±1, ±1), and position-vector length √3.',
            limitations: 'This scene explores one fixed cube and coordinate frame. It does not transform the geometry.',
        },
        'vector-operations': {
            meaning: 'Vector addition combines two displacements. The sum is the diagonal of the parallelogram formed by A and B.',
            steps: ['Change the A and B coordinate sliders; arrow keys adjust a focused slider.', 'Try B = −A, then use Reset Vectors.'],
            observe: 'Each coordinate of A + B is the sum of the matching coordinates. Opposite vectors cancel to zero.',
        },
        'matrix-transformations': {
            meaning: 'A matrix maps vectors to vectors. Its columns are the transformed basis vectors; transformed cube corners reveal how it changes space.',
            steps: ['Compare Shear and Rotation presets, then change Scale X/Y/Z, Z rotation degrees, and X shear from Y.', 'Select a cube corner and inspect its output, the computed matrix, and determinant; try Flatten to a plane.'],
            observe: 'The operations apply scaling, then shear, then rotation. The determinant gives signed volume change; zero collapses a dimension.',
            limitations: 'The computed family is A = Rz Hx D. It includes reflections and flattening but does not represent every 3×3 matrix or translations.',
        },
        eigenvalues: {
            meaning: "A nonzero eigenvector stays on its line when a matrix transforms it. Its eigenvalue gives the signed scale; the alignment map helps locate these directions.",
            steps: ["Move Input vector X, Y, and Z toward bright directions and compare x, Ax, their scale ratio, and normalized residual.", "Compare Scale, Shear, and Identity. Choose Rotation, make or skip the prediction, then reveal its map. Reset restores the unsolved starting example."],
            observe: "Scale has three eigen-lines. Shear has the whole y = 0 eigenplane. A 90° Z rotation preserves only the Z line; its two poles represent one line. A negative eigenvalue reverses direction and zero sends a nonzero vector to zero.",
            limitations: "The map samples 306 directions; brightness is absolute angular alignment, so nearby bright points are hints rather than exact eigenvectors. The probe tests the normalized residual at tolerance 10⁻⁶. Reveal dominant eigenvector runs 80 power iterations and can fail for rotations or equal-magnitude eigenvalues. The map is not a plot of singular-vector ellipsoid axes.",
        },
        'fundamental-subspaces': {
            meaning: 'A matrix connects an input domain and an output codomain. Row/null spaces and column/left-null spaces form two orthogonal pairs.',
            steps: ['Choose Domain to inspect the input and its row-space and null-space components.', 'Choose Codomain to inspect the output and column space.'],
            observe: 'The matrix sends null-space directions to zero; its output lies in the column space.',
            limitations: 'This is one fixed matrix example. The dimensions shown are specific to its rank.',
        },
        'fundamental-subspaces-lite': {
            meaning: "Every input splits into perpendicular row-space and null-space components. The matrix detects the row component and erases the null component, so Ax equals A applied to the row part.",
            steps: ["Move the three Input coordinate sliders and compare the changing input, row part, and null part arrows.", "Check that the component dot product and reconstruction error stay zero as the input changes.", "Try to make the row part vanish without setting the input to zero, then reveal a null direction and inspect Ax."],
            observe: "For this rank-two matrix, the null line is along (2,−1,1). Inputs that differ by a vector on this line have the same output; the row and null components remain perpendicular.",
            limitations: "This lab uses one fixed 3×3 rank-two matrix and manipulates its input, with [3,3,3] as the starting example. Finite pieces depict infinite subspaces; equal coordinate scaling preserves angles. The full lesson adds the column and left null spaces in the codomain.",
        },
        'banach-tarski': {
            meaning: 'The Banach–Tarski theorem concerns non-measurable sets that can be rearranged into two balls of the original size.',
            steps: ['Choose Decompose & Double to watch the illustration.', 'Choose Unify Sphere to return to the starting view.'],
            observe: 'The colored pieces are a visual story about rearrangement, helping explain why measurability matters.',
            limitations: 'The displayed pieces are ordinary rendered surfaces, not the theorem’s non-measurable sets. This animation is not a construction or physical duplication.',
        },
    },
    calculus: {
        derivatives: {
            meaning: "A derivative gives the slope of one slice of a surface. A secant through two nearby points approaches the tangent as their separation shrinks.",
            steps: ["Move Point x while holding Slice y fixed and follow the highlighted curve.", "Reduce Secant step h and compare the secant slope, tangent slope and their difference."],
            observe: "The x-direction secant slope approaches ∂f/∂x. The tangent touches the visible fixed-y curve at the chosen point.",
            limitations: "This studies one slice of z = 0.8 sin(x) cos(y). Use Partial Derivatives to compare both input directions. Automatic tracing is optional; the numerical derivative is analytic.",
        },
        'partial-derivatives': {
            meaning: 'A partial derivative measures change along one input axis while holding the other input fixed. Together, the slopes form the gradient.',
            steps: ['Adjust Coordinate X while keeping Y fixed, then adjust Y alone.', 'Compare the derivative readouts and colored tangent arrows; Reset restores the starting point.'],
            observe: 'Positive and negative slopes indicate uphill and downhill directions. The gradient combines both input directions.',
        },
        'jacobian-hessian': {
            meaning: "The Jacobian gives the local slope and the Hessian gives curvature. For f(x,y) = sin(x)cos(y), a gradient arrow and a local quadratic patch show these two roles.",
            steps: ["Move Coordinate X and Coordinate Y; compare the selected surface point with the gradient and Hessian entries.", "Toggle Show Jacobian and Show Hessian to isolate slope and the second-order patch, then Reset to restore the initial point and camera."],
            observe: "The arrow follows the true input-space gradient; the patch uses the full second-order Taylor expression, including mixed derivatives. At (0,0), the Hessian vanishes even though the gradient is nonzero.",
            limitations: "The arrow lies horizontally in the input plane at the point’s height, not tangent to the embedded surface. The quadratic patch covers offsets within ±0.75 and is lifted by 0.05 to separate overlaps. It is a local approximation, not the actual function away from the selected point. World Y is height and world Z carries input y.",
        },
        integrals: {
            meaning: "Integration accumulates signed area. The accumulated function A(x) has slope equal to the height of the original function f(x).",
            steps: ["Move the endpoint x and compare shaded positive and negative contributions under sin(x).", "Watch A(x) and its tangent below; optionally enable midpoint bars to compare a sum with the exact area."],
            observe: "A(x)=1−cos(x) and A′(x)=sin(x). After π, negative contributions reduce the accumulated area; at 2π the signed total returns to zero.",
            limitations: "This example uses sin(x) on [0,2π]. The numerical area is a midpoint approximation and the displayed slope uses a finite difference. It is signed area, not unsigned geometric area or volume.",
        },
        'gradient-descent-calc': {
            meaning: "Gradient descent repeatedly moves opposite the gradient. On a quadratic bowl, the learning rate determines whether updates approach, overshoot or escape.",
            steps: ["Choose a starting point and Learning rate, then use Step or Play to inspect actual updates.", "Compare Just right, Overshoots and Diverges from the same start; make a prediction before revealing the first update."],
            observe: "Each coordinate is multiplied by 1−η: below 1 it approaches smoothly, at 1 it reaches zero, between 1 and 2 it alternates and converges, at 2 it keeps its distance, above 2 it escapes unless already at zero.",
            limitations: "This isotropic convex quadratic has a known minimum. Traces stop before leaving the plotted ±6 domain or after 160 updates. Height is independently scaled; X/Z retain equal input units.",
        },
        'taylor-remainder': {
            meaning: "A Taylor polynomial approximates a function near an expansion point. The remainder is the gap between the exact function and the polynomial at the selected input.",
            steps: ["Change Degree and Center, then move Probe x to compare the exact function, polynomial, and absolute-error readouts.", "Switch Function among sine, exponential, and logarithm; compare local agreement with the error farther from the center."],
            observe: "Function and polynomial agree at the expansion center. Increasing degree often improves a nearby approximation without guaranteeing a better fit everywhere. Ribbon depth shows the displayed gap.",
            limitations: "The exact probe readout is computed before display clipping. Function and polynomial heights are clipped to [−10,10]; ribbon depth is their displayed gap capped at 15. The logarithm is drawn only for x > −1. This is not a formal global Taylor remainder bound.",
        },
        'riemann-integral': {
            meaning: 'Riemann integration partitions the input domain and sums rectangle areas sampled from the function.',
            steps: ['Start with a small Number of Partitions.', 'Increase it and compare the thinner rectangles with the curve.'],
            observe: 'Finer partitions follow the smooth function more closely.',
            limitations: 'The displayed curve is smooth. The text discusses non-integrable functions, but the scene does not simulate those pathological examples.',
        },
        'sigma-algebra': {
            meaning: "A σ-algebra is a collection of measurable sets closed under complements and countable unions. A finite partition shows which events can be distinguished before a measure assigns their sizes.",
            steps: ["Change Granularity Level and Select atom A to see which numbered outcomes belong to the same indivisible event.", "Choose Universe, Complement, or Union under Closure rule and compare the highlighted outcomes with the live counts."],
            observe: "A partition with k atoms has 2ᵏ measurable unions. Complement recovers the remaining outcomes; a union still contains whole atoms. An individual outcome becomes selectable only when the partition resolves it.",
            limitations: "This is a finite universe of 16 outcomes; its diagrams illustrate closure, not countably infinite union behavior or non-measurable sets. B is the next atom after A, wrapping around. A σ-algebra chooses events; a separate measure assigns sizes. No rendered patch demonstrates the Banach–Tarski pieces.",
        },
        'riemann-vs-lebesgue': {
            meaning: "Riemann sums group contributions by input location. Lebesgue integration groups them by function value and the size of the corresponding sets.",
            steps: ["Choose Smooth Hills or Extreme Spikes and compare both estimates with the fine-grid reference.", "Switch the slicing direction, raise Refinement and watch the errors and drawn cells."],
            observe: "Domain columns and height layers estimate the same integral. The layer sum is a lower height sum for the fixed sampled floor grid, while finer domain sampling better resolves narrow spikes.",
            limitations: "Both examples are smooth and integrable. The Lebesgue estimate uses a fixed 40×40 lower-left floor grid; its lower height sum is not a guaranteed lower bound on the continuous integral. The 200×200 midpoint reference is also numerical; coarse sampling can miss peaks. Drawing gaps do not remove mathematical area.",
        },
        'lebesgue-measure': {
            meaning: "Lebesgue measure extends length, area, and volume. Coverings connect irregular shapes to simple boxes and reveal sets of zero volume.",
            steps: ["Choose Building Blocks and change Dimension to compare length, area, and volume from the active side lengths.", "Choose Outer Measure and refine Box Resolution, then choose Null Sets and shrink Cover Thickness while comparing covering volume."],
            observe: "The guaranteed ellipsoid cover approaches the exact solid volume as its nested grid is refined. A square retains area 16 while a slab covering it has volume 16ε, approaching zero as its thickness shrinks.",
            limitations: "A finite grid cover gives an upper bound, not the infimum defining outer measure. The selected cells use an exact intersection test for the stated ellipsoid. The WebGL-free view shows only a central section of the same 3D cover; the metrics sum all cells. A bounded square is pictured; an unbounded plane requires countably many covers.",
        },
    },
    probability: {
        distributions: {
            meaning: "A two-dimensional Gaussian density has adjustable marginal spread and correlation. Its one-sigma ellipse contains about 39.3% of probability, while wider spread lowers the peak at fixed remaining parameters.",
            steps: ["Change Standard deviation σx or σy and compare the surface width, scaled peak, and sample standard deviations.", "Move Correlation ρ and switch to Top view to inspect the tilted one-sigma ellipse and its sample membership.", "Increase Sample count N or Resample, then compare the empirical inside fraction with the 39.3% theoretical value."],
            observe: "At fixed σy and ρ, doubling σx halves the peak. The two-dimensional one-sigma fraction is 1−exp(−1/2), about 39.3%, independent of spread and correlation; it is not the one-dimensional 68% interval rule.",
            limitations: "The density surface is shown over [−4.2,4.2]² with heights equal to 4π times density. Samples have two random input coordinates; displayed surface heights are not a third random variable. Samples outside the surface window remain in statistics and the plot. The full density, including unseen tails, integrates to one. Sample standard deviations use divisor N.",
        },
        'bayes-theorem': {
            meaning: 'A filter flag is a clue, not certainty. Bayes’ theorem tells you how likely an email is spam after you learn the filter flagged it.',
            steps: [
                'Choose Reset example, then All emails to see the starting mix of 100 spam and 900 ordinary emails.',
                'Choose Highlight flags, then Only flagged. Compare the 90 flagged spam emails with all 180 flagged emails.',
                'Move the rate sliders or try Rare spam and No false alarms. Use Explain for the worked counts and formula.',
            ],
            observe: 'A 90% catch rate means catching 90 of 100 spam emails. In the default example, only 90 of the 180 flagged emails are spam, so their chance is 50%, not 90%.',
            limitations: 'These fictional rates give expected counts, so fractions are possible. If no emails are flagged, the chance of spam among flagged emails is undefined.',
        },
        'monte-carlo': {
            meaning: "Uniform samples in a cube estimate the fraction inside a sphere. Multiplying that fraction by six estimates π; the error plot reveals fluctuation and the typical 1/√n scale.",
            steps: ["Increase Samples revealed or press Play, and compare the counted points with the π estimate.", "Choose a larger Sample budget, then Restart same seed to reproduce its prefix or Run again to change the seed.", "Compare the solid actual-error line with the dashed typical-error scale; check whether every added sample improves the estimate."],
            observe: "100 times more independent samples reduces the theoretical standard error about tenfold. A single estimate can move away from π even while its typical uncertainty shrinks.",
            limitations: "Seeded pseudorandom samples are a reproducible simulation, not a proof of π. The dashed curve uses the known sphere probability π/6 to show theoretical standard error, not a guaranteed bound. All samples contribute to statistics; the SVG projection draws at most 1,200 evenly selected points, and errors below 0.0001 are shown at the chart floor.",
        },
        'log-likelihood': {
            meaning: "Log-likelihood scores a model against fixed observations by adding their log-densities. Moving the Gaussian mean or spread changes the contribution of every point.",
            steps: ["Move X-Position and Z-Position while comparing the mean, observations, and exact log-likelihood score.", "Change Spread; compare the dome shape with the number of observations beyond 2.5σ and the total score."],
            observe: "A very narrow dome has a tall peak but can badly penalize distant observations. Every one of the nine observations contributes to the score; red does not mean zero density.",
            limitations: "The dome is a manually controlled data-space Gaussian illustration, not a likelihood-parameter surface or optimizer. Height is rescaled as 15/σ times the Gaussian shape and clipped below at 0.05; it is not calibrated density. Data-floor units are equal and height scales separately. The score uses exact normalized Gaussian log-density for all nine observations.",
        },
        'probability-vs-likelihood': {
            meaning: "Probability varies possible data for a fixed parameter. Likelihood varies the parameter for fixed observed data, using the same model in the other direction.",
            steps: ["Choose Probability under View and inspect the fixed parameter, varied data axis, and peak location.", "Choose Likelihood and compare the perpendicular section with the fixed observation and maximum-likelihood parameter."],
            observe: "The model b = 1.5x plus standard Gaussian noise has its probability peak at b = 1.5 when x = 1. With observed b = 4.5, likelihood peaks at x = 3.",
            limitations: "The surface height is five times Gaussian density for visibility, while the metric reports unscaled density. Only one parameter or one observation is fixed in each preset. Likelihood is not a probability distribution over parameters; its integral over x is 1/1.5 for this model. No posterior or parameter prior is computed.",
        },
        'variational-inference': {
            meaning: 'Variational inference approximates a posterior with a simpler distribution. For fixed evidence, increasing the ELBO reduces the KL gap.',
            steps: ['Use Play or move Illustration progress to compare the approximation with the target shape.', 'Inspect how the ELBO block and KL gap complement the fixed ceiling.'],
            observe: 'The ending approximation still leaves a gap because a single Gaussian cannot reproduce every peak of the target.',
            limitations: 'The shapes are unnormalized and the displayed values are illustrative. Playback does not compute ELBO, KL, or an optimization algorithm.',
        },
    },
    ml: {
        'bias-variance': {
            meaning: "Bias measures systematic prediction error; variance measures how much a fitted model changes across training samples. Both contribute to generalization error.",
            steps: ["Predict the degree-1 to degree-9 test-error change, then reveal the measured comparison.", "Change sample size or noise and resample training sets; compare the decomposition and complete complexity curve."],
            observe: "The decomposition separates squared bias, estimator variance and irreducible noise. Independent test error can rise while training error falls, but a U-shape is not guaranteed in every finite run.",
            limitations: "The shaded band is fit variability, not a confidence interval. Finite repeated fits estimate bias and variance; the tiny stabilizing penalty is part of the estimator.",
        },
        'signal-to-noise': {
            meaning: 'SNR compares signal variance with noise variance. It describes the data-generating process rather than the complexity of the chosen model.',
            steps: ['Change Signal amplitude and Noise standard deviation to compare SNR and observations.', 'Compare the two scale presets, then change Polynomial degree or Training sample size.'],
            observe: 'Model settings leave SNR unchanged. Doubling signal and noise preserves SNR while changing the scale of squared errors.',
            limitations: 'Test error varies with the sampled observations. Zero signal and zero noise make the ratio undefined; positive signal with zero noise gives infinite SNR.',
        },
        'neural-networks': {
            meaning: 'A neural network transforms actual inputs through weighted connections and nonlinear activations into a prediction.',
            steps: ['Change the input coordinates and inspect the hidden/output activations.','The full computation is initially visible; use Reset then Step to reveal layers, or Train 200 steps to fit the tiny XOR task.','Compare actual predictions and training loss with the same four XOR examples.'],
            observe: 'Connection weights and activation values determine the output. Real gradient updates change those weights.',
            limitations: 'The network and XOR task are deliberately small. This lesson computes activations and trains weights; it does not imply performance on unrelated data.',
        },
        'decision-boundaries': {
            meaning: "A decision boundary partitions feature coordinates into predicted classes. Moving a plane or sphere changes predictions while given labels stay fixed, revealing actual misclassification errors.",
            steps: ["Move Plane tilt, Plane turn, or Plane offset and compare the error rings with accuracy and misclassified counts.", "Choose XOR-like quadrants and try to eliminate errors using one plane; inspect which given labels remain on the wrong side.", "Choose Concentric shells, switch Boundary to Sphere, and change Sphere radius to compare a curved separator with a plane."],
            observe: "A plane predicts by a signed linear score; a centered sphere predicts by distance from the origin. A sphere can enclose the inner shell group, but it is not a universal nonlinear solution for XOR or overlapping labels.",
            limitations: "These boundaries are manually chosen on seeded synthetic data; no training or held-out generalization is claimed. The gold plane patch is clipped to [−3,3]³; all original three-feature points contribute to error counts. SVG is an oblique projection of those coordinates and uses the same three-dimensional predictions.",
        },
        'gradient-descent-ml': {
            meaning: "Gradient descent updates model parameters by subtracting a step along the gradient. A non-convex objective can have multiple stationary points.",
            steps: ["Change Learning rate and Start x/y, then Step or Play the actual computed trajectory.", "Compare starts at the same rate; use Optimization step to inspect loss and gradient norm along the path."],
            observe: "The final stationary point depends on the start and step size. A small gradient alone does not prove the lowest possible loss.",
            limitations: "This is an illustrative analytic nonconvex objective, not a trained model. Runs stop before leaving ±6 or after 500 updates. A stationary point need not be a global minimum; height is independently scaled.",
        },
        'measure-theory-ml': {
            meaning: 'Measure and transformations help explain low-dimensional data, changes in probability density, and the non-invertibility of some activations.',
            steps: ['Compare 1. Manifold, 2. Flows, and 3. ReLU.', 'Inspect the data cloud, animated deformation, and flat negative-input part of ReLU.'],
            observe: 'Lower-dimensional structure and transformations affect how probability is represented. ReLU maps many negative inputs to the same output.',
            limitations: 'The noisy manifold cloud and ReLU picture are conceptual. The flow is an actual invertible triangular affine map of a uniform ball, with density proportional to 1/|s₁s₂s₃|. No generative model is trained.',
        },
        'lagrange-constraints': {
            meaning: 'An L2 or L1 budget constrains the weights of a stated diagonal quadratic. The red marker is its computed constrained minimum.',
            steps: ['Begin in Constraint detail and compare the allowed shape with the red computed minimum. Choose Full objective to reveal the entire current loss contour and its center.', 'Switch Ridge/Lasso and change Allowed Budget; compare the original-unit radius/budget, axis scale, weights, loss, and zero coordinates. Fit view recenters after orbiting or panning.'],
            observe: 'L1 can set coordinates to exactly zero. With unequal quadratic curvature, L2 generally shrinks the coordinates unequally. Once the unconstrained minimum is feasible, the minima coincide and the zero-loss contour is a point.',
            limitations: 'This solves one explicitly chosen three-weight quadratic using optimality conditions. The control t is the L2 radius (squared budget t²) or L1 norm, rather than a penalty coefficient. Detail clips the true contour to a stated local window; camera fitting changes zoom, never weight coordinates. The red point glyph is enlarged for visibility in the overview. This is not a fit to observed data.',
        },
        'lp-regularization': {
            meaning: "Lp norms define different weight budgets, from the pointed L1 ball to the round L2 ball and box-like L∞ region.",
            steps: ["Choose Norm p and change Radius / budget to compare the allowed weight shapes.", "Expand Input weight coordinates, including negative values, and compare the input norm with the radial output and its norm."],
            observe: "Changing the norm changes the feasible shape and the common radial scaling factor. An already-feasible input stays unchanged. Radial scaling alone does not create L1 sparsity.",
            limitations: "The highlighted output is radial shrinkage, not nearest-point projection or a general least-squares constrained optimum. L∞ uses the exact maximum norm and a box-shaped boundary. Use Ridge & Lasso Constraints for an actually solved quadratic objective.",
        },
        'linear-models': {
            meaning: 'Linear classifiers learn a straight decision boundary. Logistic regression, least squares on class targets, and the perceptron use different objectives.',
            steps: ['Choose a Learning algorithm and compare the same example data.', 'Select a class and add points by clicking the plot, or use its arrow-key cursor and Enter or Space.'],
            observe: 'Different objectives can produce different boundaries on the same data. Compare the cursor readout as you switch methods.',
            limitations: 'Logistic output is a modeled class probability; least-squares output is a raw regression score that may lie outside [0, 1]. The perceptron score is not a probability.',
        },
        'linear-discriminants': {
            meaning: "A linear discriminant uses a weight vector normal to the boundary and a bias that offsets it. Its sign determines the predicted class.",
            steps: ["Change w Angle, Magnitude, and Bias to reposition the boundary while comparing its live offset.", "Drag the selected point or use arrow keys on the canvas; inspect its score and distance, then try Reset point."],
            observe: "The weight vector is perpendicular to the boundary. Bias is the intercept w₀, and signed distance is (w·x + w₀)/‖w‖; both score and distance change sign at the boundary.",
            limitations: "This is geometric exploration of a chosen rule; no training algorithm fits the weights. Movements stay inside the canvas; coordinates and distances use centered native-canvas pixels. Scores are not calibrated probabilities.",
        },
        'least-squares-multiclass': {
            meaning: 'One-of-K targets fit one linear score per class. The class with the largest score becomes the prediction.',
            steps: ['Choose a class under Add Points; click the chart or focus it and move the arrow-key cursor, then Enter or Space to add observations.', 'Toggle a class in Target View to inspect its 0/1 targets, then use Reset Points.'],
            observe: 'Each line fits its class targets; the highest line determines the colored decision region.',
            limitations: 'Least-squares scores are not calibrated probabilities and need not lie between 0 and 1. The solver uses full-rank normal equations, not a general rank-deficient pseudoinverse.',
        },
        'lagrange-multipliers': {
            meaning: "A constrained optimum balances objective and constraint gradients. On x + y = 4, the minimum of x² + y² occurs when those two gradient directions align.",
            steps: ["Move Position on Path and compare the objective, constraint value, and derivative along the path.", "Toggle Show Floor Gradients and find their alignment before using Snap to Optimal Solution."],
            observe: "The path remains feasible. At (2,2), its objective is 8, its path derivative vanishes, and ∇f = 4∇g. Moving either way raises this convex objective.",
            limitations: "The bowl height is 0.15 times the objective. The floor arrows show normalized directions with equal displayed length, rather than gradient magnitudes. Stationarity is generally necessary; convexity of this particular quadratic makes the stationary point a global constrained minimum.",
        },
        'fisher-lda': {
            meaning: 'Fisher’s discriminant finds a projection with large separation between class means relative to the spread within each class.',
            steps: ['Use Next or the numbered step buttons to follow the derivation.', 'At the classification step, click the scatter plot or focus it and use arrow keys followed by Enter or Space to test a point.'],
            observe: 'The projection accounts for within-class scatter, rather than choosing the mean-difference direction alone.',
            limitations: 'The displayed dataset and projection are fixed examples. The scatter matrix is the sum of within-class squared deviations. Classification adds an equal-prior, common-variance Gaussian assumption to the projection, producing a midpoint threshold; this is not a universal Fisher cutoff.',
        },
        'gaussian-mixture': {
            meaning: 'A Gaussian mixture models overlapping groups. EM alternates estimating soft group assignments and refitting the component distributions.',
            steps: ['Choose 1. E-Step, then 2. M-Step, and compare assignments with the ellipsoids.', 'Try Auto Run or Reset & Regenerate Data for another fit.'],
            observe: 'The E-step updates responsibilities; the M-step updates means, variances, and mixture weights. Higher log-likelihood indicates a better fit to these data.',
            limitations: 'This example fixes three components, diagonal covariances, and a minimum variance of 0.5. Ellipsoids show one standard deviation, not a confidence boundary. E/M updates work without WebGL; animation only interpolates completed parameter updates. EM depends on initialization and need not find a global optimum.',
        },
        ...Object.fromEntries(mlVisualLessons.map(lesson => [lesson.id, lesson.guide])),
    },
};

export function getLessonGuide(topicId: string, subtopicId: string): LessonGuide | undefined {
    if (!Object.hasOwn(lessonGuides, topicId)) return undefined;
    const guides = lessonGuides[topicId];
    return Object.hasOwn(guides, subtopicId) ? guides[subtopicId] : undefined;
}
