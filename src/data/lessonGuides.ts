/** Short guidance is available before a scene loads, without importing its renderer. */
export interface LessonGuide {
    meaning: string;
    steps: readonly string[];
    observe: string;
    limitations?: string;
}

export const lessonGuides: Readonly<Record<string, Readonly<Record<string, LessonGuide>>>> = {
    'linear-algebra': {
        'simple-test': {
            meaning: 'A rotating cube checks that your device can display an interactive 3D scene.',
            steps: ['Look for the pink cube.', 'Drag to change the view; scroll or pinch to zoom.'],
            observe: 'The cube should keep rotating as you move the camera.',
            limitations: 'This is a graphics check rather than a mathematical lesson.',
        },
        'vector-operations': {
            meaning: 'Vector addition combines two displacements. The sum is the diagonal of the parallelogram formed by A and B.',
            steps: ['Change the A and B coordinate sliders; arrow keys adjust a focused slider.', 'Try B = −A, then use Reset Vectors.'],
            observe: 'Each coordinate of A + B is the sum of the matching coordinates. Opposite vectors cancel to zero.',
        },
        'matrix-transformations': {
            meaning: 'A linear transformation changes the size and orientation of an object while preserving straight lines.',
            steps: ['Watch the colored cube change shape automatically.', 'Drag to compare it with the gray original wireframe.'],
            observe: 'Scaling stretches the axes, while rotation changes orientation.',
            limitations: 'This animation demonstrates scaling and rotation. It does not provide an editable matrix or a separate shear transformation.',
        },
        'eigenvalues': {
            meaning: 'An eigenvector is a nonzero direction that a matrix only scales or reverses. Its scaling factor is the eigenvalue.',
            steps: ['Choose Scale, Shear, Rotation, or Random, or edit the matrix entries.', 'Adjust the input-vector sliders or try Auto-Find Eigenvector.'],
            observe: 'An eigenvector makes the input and output parallel. Negative eigenvalues reverse the direction.',
            limitations: 'Auto-Find uses a finite numerical iteration that may not converge for every matrix. It does not enumerate all eigenvectors.',
        },
        'fundamental-subspaces': {
            meaning: 'A matrix connects an input domain and an output codomain. Row/null spaces and column/left-null spaces form two orthogonal pairs.',
            steps: ['Choose Domain to inspect the input and its row-space and null-space components.', 'Choose Codomain to inspect the output and column space.'],
            observe: 'The matrix sends null-space directions to zero; its output lies in the column space.',
            limitations: 'This is one fixed matrix example. The dimensions shown are specific to its rank.',
        },
        'fundamental-subspaces-lite': {
            meaning: 'The input vector splits into an orthogonal row-space component and a null-space component.',
            steps: ['Compare the yellow input with the green and red component arrows.', 'Rotate the scene to see their directions and compare the displayed coordinates.'],
            observe: 'The two components add to [3, 3, 3], and their dot product is zero.',
            limitations: 'This smaller scene shows only the input decomposition. Use the full lesson for the codomain and all four subspaces.',
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
            meaning: 'A derivative describes local change. On z = 0.8 sin(x) cos(y), the pink tangent shows the slope in the x direction.',
            steps: ['Follow the yellow point and pink tangent as they travel over the surface.', 'Rotate the view to compare the tangent with nearby uphill and downhill regions.'],
            observe: 'The tangent tilts with the local x-direction slope and becomes horizontal when that slope is zero.',
            limitations: 'This scene follows one directional slope. Use Partial Derivatives to control the point and compare both input directions.',
        },
        'partial-derivatives': {
            meaning: 'A partial derivative measures change along one input axis while holding the other input fixed. Together, the slopes form the gradient.',
            steps: ['Adjust Coordinate X while keeping Y fixed, then adjust Y alone.', 'Compare the derivative readouts and colored tangent arrows; Reset restores the starting point.'],
            observe: 'Positive and negative slopes indicate uphill and downhill directions. The gradient combines both input directions.',
        },
        'jacobian-hessian': {
            meaning: 'The Jacobian describes first-order change. The Hessian describes second-order curvature, including how the slopes change together.',
            steps: ['Toggle Show Jacobian and Show Hessian to inspect each overlay.', 'Move the X and Y sliders and compare the displayed derivatives and curvature.'],
            observe: 'A small gradient does not imply flat curvature. The Hessian can reveal a bowl, hill, or saddle near a point.',
            limitations: 'The overlays are local approximations around the selected point, not descriptions of the entire surface.',
        },
        integrals: {
            meaning: 'Integration accumulates small contributions. Rectangular bars illustrate how a sum can approximate the area under a curve.',
            steps: ['Watch the heights of the bars change automatically.', 'Rotate the scene to see each bar’s width and height.'],
            observe: 'Each contribution is height × width; adding the contributions gives an area approximation.',
            limitations: 'The bar count stays fixed in this animation. Use Riemann Integral to change the partition count.',
        },
        'gradient-descent-calc': {
            meaning: 'Gradient descent repeatedly moves opposite the gradient to reduce an objective. This lesson uses a convex quadratic bowl.',
            steps: ['Watch the point and its computed trail move down the bowl.', 'Use Pause to inspect the route and Reset to replay it.'],
            observe: 'The updates approach the bottom as the gradient becomes smaller.',
            limitations: 'The starting point and step size are fixed. This simple convex example does not show every possible optimization behavior.',
        },
        'taylor-remainder': {
            meaning: 'A Taylor polynomial approximates a function near an expansion point. The remainder is the difference between the function and that polynomial.',
            steps: ['Choose Sine Wave, Exponential, or Logarithm, then adjust Degree.', 'Move Center to relocate the expansion point and compare the function, polynomial, and error.'],
            observe: 'Approximation is local: accuracy near the center does not guarantee accuracy far away.',
            limitations: 'Curves and errors are sampled and clipped for display. The logarithm is shown only on its valid domain x > −1.',
        },
        'riemann-integral': {
            meaning: 'Riemann integration partitions the input domain and sums rectangle areas sampled from the function.',
            steps: ['Start with a small Number of Partitions.', 'Increase it and compare the thinner rectangles with the curve.'],
            observe: 'Finer partitions follow the smooth function more closely.',
            limitations: 'The displayed curve is smooth. The text discusses non-integrable functions, but the scene does not simulate those pathological examples.',
        },
        'sigma-algebra': {
            meaning: 'A σ-algebra is a collection of measurable sets closed under complements and countable unions. It specifies which events can receive probabilities.',
            steps: ['Compare Universe Rule, Complement Rule, and Countable Union.', 'Choose Information Resolution and change Granularity Level.'],
            observe: 'Finer atoms distinguish more events; complements and unions remain within the allowed collection.',
            limitations: 'Finite pictures illustrate closure rules. They cannot display all sets in an infinite σ-algebra.',
        },
        'riemann-vs-lebesgue': {
            meaning: 'Riemann sums group contributions by input location. Lebesgue integration groups them by function value and the size of the corresponding sets.',
            steps: ['Choose Smooth Hills or Extreme Spikes, beginning with low Refinement.', 'Switch between Riemann and Lebesgue, then increase Refinement gradually.'],
            observe: 'Vertical columns partition the domain; horizontal layers accumulate regions above each height.',
            limitations: 'Both examples are smooth and integrable. Coarse sampling can miss narrow peaks; that does not mean Riemann integration fails mathematically.',
        },
        'lebesgue-measure': {
            meaning: 'Lebesgue measure extends length, area, and volume. Coverings connect irregular shapes to simple boxes and reveal sets of zero volume.',
            steps: ['Explore the three lesson steps and adjust each step’s slider.', 'In Null Sets, increase the slider to shrink the covering slab.'],
            observe: 'A flat plane can have positive area while its three-dimensional volume approaches zero.',
            limitations: 'Finite box covers illustrate outer measure; its definition takes an infimum over all suitable countable covers.',
        },
    },
    probability: {
        distributions: {
            meaning: 'A probability density describes how observations are distributed. Gaussian data cluster around a central region and thin out toward the tails.',
            steps: ['Compare the yellow sample positions with the pink bell-shaped surface.', 'Rotate the scene to inspect the spread around the center.'],
            observe: 'Sample concentration is greater near the center than far out in the tails.',
            limitations: 'The surface height is rescaled for display. Density height at a point is not that point’s probability, and these graphics are illustrative.',
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
            meaning: 'Monte Carlo estimates quantities using random samples. The fraction of cube samples inside a sphere estimates its volume ratio and therefore π.',
            steps: ['Watch pink and gray points appear automatically.', 'Compare the sample count, inside fraction, and π estimate as the run progresses.'],
            observe: 'The estimate fluctuates. More samples usually improve precision but do not make every update closer to π.',
            limitations: 'This run stops at 500 samples. Its result is an estimate, not an exact geometric calculation.',
        },
        'log-likelihood': {
            meaning: 'Log-likelihood scores how well a proposed probability model explains the observed data. Independent observations contribute additive log-density terms.',
            steps: ['Move the X-Position and Z-Position sliders to place the Gaussian center.', 'Change Spread and compare the log-likelihood score.'],
            observe: 'A narrow peak can fit one point while heavily penalizing the others. Center and spread must balance the whole dataset.',
            limitations: 'This is manual exploration of one Gaussian model, not an automatic optimizer. Displayed surface heights are adjusted for visibility.',
        },
        'probability-vs-likelihood': {
            meaning: 'The same model f(b | x) can predict data for a fixed parameter or score parameters for fixed observed data.',
            steps: ['Choose Forward / Probability: x is fixed and the curve varies over b.', 'Choose Inverse / Likelihood: b is fixed and the curve varies over x.'],
            observe: 'The forward peak is at b = 1.5. For observed b = 4.5, the likelihood is maximized at x = 3.',
            limitations: 'A likelihood is not automatically a probability distribution over parameters. A posterior requires a prior and Bayesian normalization.',
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
            meaning: 'Bias measures systematic prediction error; variance measures how much a fitted model changes across training samples. Both contribute to generalization error.',
            steps: ['Increase Polynomial degree and compare the fitted curves and mean prediction.', 'Change sample size or noise, then Resample training sets to inspect another ensemble.'],
            observe: 'The displayed decomposition separates squared bias, estimator variance, and irreducible noise. Training error alone does not measure generalization.',
            limitations: 'The shaded band is fit variability, not a confidence interval. Finite repeated fits estimate bias and variance; the tiny stabilizing penalty is part of the estimator.',
        },
        'signal-to-noise': {
            meaning: 'SNR compares signal variance with noise variance. It describes the data-generating process rather than the complexity of the chosen model.',
            steps: ['Change Signal amplitude and Noise standard deviation to compare SNR and observations.', 'Compare the two scale presets, then change Polynomial degree or Training sample size.'],
            observe: 'Model settings leave SNR unchanged. Doubling signal and noise preserves SNR while changing the scale of squared errors.',
            limitations: 'Test error varies with the sampled observations. Zero signal and zero noise make the ratio undefined; positive signal with zero noise gives infinite SNR.',
        },
        'neural-networks': {
            meaning: 'Neural networks compose layers of units. Connections carry information from inputs through hidden layers toward outputs.',
            steps: ['Follow the moving pulse through the displayed layers.', 'Use Pause Animation to inspect the connections, then Resume Animation.'],
            observe: 'Each layer connects to the next, illustrating the structure of a fully connected network.',
            limitations: 'This is a schematic architecture animation. The pulse is not a computed activation; the scene does not train weights or run backpropagation.',
        },
        'decision-boundaries': {
            meaning: 'A decision boundary separates regions assigned to different classes. A linear classifier uses a plane in three-dimensional feature space.',
            steps: ['Compare the yellow and purple clusters with the cyan plane.', 'Rotate the view to inspect the two sides of the plane.'],
            observe: 'A boundary partitions feature space; its geometric role is separate from how a learning algorithm chooses it.',
            limitations: 'The plane is fixed for this illustration. Use Linear Models for Classification to fit boundaries to editable training data.',
        },
        'gradient-descent-ml': {
            meaning: 'Gradient descent updates model parameters by subtracting a step along the gradient. A non-convex objective can have multiple stationary points.',
            steps: ['Follow the pink point and its computed trail over the gold loss surface.', 'Use Pause to inspect the trajectory and Reset to replay it.'],
            observe: 'The route reduces the objective from its starting position and approaches a stationary point.',
            limitations: 'The starting point and step size are fixed. Reaching a stationary point does not guarantee the global minimum.',
        },
        'measure-theory-ml': {
            meaning: 'Measure and transformations help explain low-dimensional data, changes in probability density, and the non-invertibility of some activations.',
            steps: ['Compare 1. Manifold, 2. Flows, and 3. ReLU.', 'Inspect the data cloud, animated deformation, and flat negative-input part of ReLU.'],
            observe: 'Lower-dimensional structure and transformations affect how probability is represented. ReLU maps many negative inputs to the same output.',
            limitations: 'These are conceptual graphics, not trained generative models. The manifold samples include noise, and flow colors do not provide an exact density calculation.',
        },
        'lagrange-constraints': {
            meaning: 'Regularization restricts allowable model weights. L2 and L1 budgets produce different geometric constraint regions.',
            steps: ['Switch between Ridge (L2) and Lasso (L1).', 'Change Allowed Budget and compare the feasible shape and marker position.'],
            observe: 'A smaller budget forces the illustrated weights closer to the origin; the L1 boundary has corners.',
            limitations: 'The marker follows a geometric illustration, not a solved regularized regression problem. Its L1 position should not be interpreted as an exact Lasso optimum.',
        },
        'lp-regularization': {
            meaning: 'Lp norms define different weight budgets, from the pointed L1 ball to the round L2 ball and box-like L∞ region.',
            steps: ['Choose a Penalty Type and change Constraint Radius.', 'Adjust the OLS Solution coordinates and compare the displayed weights.'],
            observe: 'Changing the norm changes the feasible shape and the displayed radial shrinkage.',
            limitations: 'The green marker is radial shrinkage, not a general least-squares constrained optimum. The L∞ display is a finite-p approximation.',
        },
        'linear-models': {
            meaning: 'Linear classifiers learn a straight decision boundary. Logistic regression, least squares on class targets, and the perceptron use different objectives.',
            steps: ['Choose a Learning algorithm and compare the same example data.', 'Select a class and add points by clicking the plot, or use its arrow-key cursor and Enter or Space.'],
            observe: 'Different objectives can produce different boundaries on the same data. Compare the cursor readout as you switch methods.',
            limitations: 'Logistic output is a modeled class probability; least-squares output is a raw regression score that may lie outside [0, 1]. The perceptron score is not a probability.',
        },
        'linear-discriminants': {
            meaning: 'A linear discriminant uses a weight vector normal to the boundary and a bias that offsets it. Its sign determines the predicted class.',
            steps: ['Change w Angle, Magnitude, and Bias to reposition the boundary.', 'Drag the test point across the boundary and inspect its score and distance.'],
            observe: 'The weight vector is perpendicular to the boundary. The score changes sign when the point crosses it.',
            limitations: 'This is geometric exploration of a chosen rule; no training algorithm fits the weights.',
        },
        'least-squares-multiclass': {
            meaning: 'One-of-K targets fit one linear score per class. The class with the largest score becomes the prediction.',
            steps: ['Choose a class under Add Points and click the chart to add observations.', 'Toggle a class in Target View to inspect its 0/1 targets, then use Reset Points.'],
            observe: 'Each line fits its class targets; the highest line determines the colored decision region.',
            limitations: 'Least-squares scores are not calibrated class probabilities and need not lie between 0 and 1.',
        },
        'lagrange-multipliers': {
            meaning: 'At a regular constrained optimum, the objective gradient aligns with the constraint gradient because there is no downhill motion along the allowed path.',
            steps: ['Move Position on Path and compare the objective value and floor gradients.', 'Use Snap to Optimal Solution to inspect x = y = 2.'],
            observe: 'At the minimum, f = 8 and the two gradients are parallel. Hide or Show Floor Gradients isolates the geometry.',
            limitations: 'This lesson uses one equality constraint and one quadratic objective; gradient alignment alone is not a universal guarantee of a minimum.',
        },
        'fisher-lda': {
            meaning: 'Fisher’s discriminant finds a projection with large separation between class means relative to the spread within each class.',
            steps: ['Use Next or the numbered step buttons to follow the derivation.', 'At the classification step, click the scatter plot to test a new point.'],
            observe: 'The projection accounts for within-class scatter, rather than choosing the mean-difference direction alone.',
            limitations: 'The displayed dataset and projection are fixed examples. The classification threshold adds a decision rule to the Fisher projection.',
        },
        'gaussian-mixture': {
            meaning: 'A Gaussian mixture models overlapping groups. EM alternates estimating soft group assignments and refitting the component distributions.',
            steps: ['Choose 1. E-Step, then 2. M-Step, and compare assignments with the ellipsoids.', 'Try Auto Run or Reset & Regenerate Data for another fit.'],
            observe: 'The E-step updates responsibilities; the M-step updates means, variances, and mixture weights. Higher log-likelihood indicates a better fit to these data.',
            limitations: 'This example fixes three components and diagonal covariances. EM depends on initialization and does not guarantee a global optimum.',
        },
    },
};

export function getLessonGuide(topicId: string, subtopicId: string): LessonGuide | undefined {
    if (!Object.hasOwn(lessonGuides, topicId)) return undefined;
    const guides = lessonGuides[topicId];
    return Object.hasOwn(guides, subtopicId) ? guides[subtopicId] : undefined;
}
