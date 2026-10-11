import { type ComponentType } from 'react';
import { lazyWithPreload, type PreloadableComponent } from '../utils/lazy';
import { mlVisualLessons } from './mlVisualLessons';

export type PreviewMotif = 'surface' | 'vectors' | 'bars' | 'bell' | 'scatter' | 'tree' | 'network' | 'curve' | 'cube' | 'sequence';

export interface Subtopic {
    id: string;
    title: string;
    description: string;
    visualization?: '3d' | 'experiment';
    preview?: PreviewMotif;
    component: PreloadableComponent<ComponentType>;
}

export interface Topic {
    id: string;
    title: string;
    icon: string;
    color: string;
    gradient: string;
    subtopics: Subtopic[];
}

export const topics: Topic[] = [
    {
        id: 'linear-algebra',
        title: 'Linear Algebra',
        icon: '⊹',
        color: '#6c5ce7',
        gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
        subtopics: [
            {
                id: 'simple-test',
                title: 'Explore 3D Coordinates',
                description: 'Compare cube corners along the x, y, and z axes, and practice rotating and zooming the view.',
                component: lazyWithPreload(() => import('../scenes/linear-algebra/SimpleTest')),
            },
            {
                id: 'vector-operations',
                title: 'Vector Operations',
                description: 'Add two vectors coordinate by coordinate and explore the parallelogram rule in 3D space.',
                component: lazyWithPreload(() => import('../scenes/linear-algebra/VectorOperations')),
            },
            {
                id: 'matrix-transformations',
                title: 'Matrix Transformations',
                description: 'Watch scaling and rotation change an object, its basis vectors, and its transformation matrix.',
                component: lazyWithPreload(() => import('../scenes/linear-algebra/MatrixTransformations')),
            },
            {
                id: 'eigenvalues',
                title: 'Eigenvalues & Eigenvectors',
                description: 'Explore eigenvectors that remain fixed in direction under linear transformations.',
                component: lazyWithPreload(() => import('../scenes/linear-algebra/Eigenvalues')),
            },
            {
                id: 'fundamental-subspaces',
                title: 'Fundamental Subspaces',
                description: 'Visualize the 4 fundamental subspaces of a matrix — Row Space, Null Space, Column Space, and Left Null Space.',
                component: lazyWithPreload(() => import('../scenes/linear-algebra/FundamentalSubspaces')),
            },
            {
                id: 'fundamental-subspaces-lite',
                title: 'Fundamental Subspaces (Lite)',
                description: 'Simplified version with lower GPU requirements - shows vector decomposition.',
                component: lazyWithPreload(() => import('../scenes/linear-algebra/FundamentalSubspacesLite')),
            },
            {
                id: 'banach-tarski',
                title: 'Banach-Tarski Paradox',
                description: 'Explore a schematic surface illustration of the theorem’s conclusion, and why ordinary measurable pieces cannot construct it.',
                component: lazyWithPreload(() => import('../scenes/linear-algebra/BanachTarski')),
            },
        ],
    },
    {
        id: 'calculus',
        title: 'Calculus',
        icon: '∫',
        color: '#00cec9',
        gradient: 'linear-gradient(135deg, #00cec9, #81ecec)',
        subtopics: [
            {
                id: 'derivatives',
                title: 'Derivatives',
                description: 'Visualize tangent lines and rate of change on 3D surfaces.',
                component: lazyWithPreload(() => import('../scenes/calculus/Derivatives')),
            },
            {
                id: 'partial-derivatives',
                title: 'Partial Derivatives',
                description: 'Explore how functions change along one axis while holding the other constant.',
                component: lazyWithPreload(() => import('../scenes/calculus/PartialDerivatives')),
            },
            {
                id: 'jacobian-hessian',
                title: 'Jacobian vs Hessian',
                description: 'Visualize the first-order gradient (Jacobian) and second-order curvature (Hessian) simultaneously.',
                component: lazyWithPreload(() => import('../scenes/calculus/JacobianHessian')),
            },
            {
                id: 'integrals',
                title: 'Integrals',
                visualization: 'experiment',
                description: 'Move the integration endpoint and see signed area accumulate into a function whose slope matches the integrand.',
                component: lazyWithPreload(() => import('../scenes/calculus/Integrals')),
            },
            {
                id: 'gradient-descent-calc',
                title: 'Gradient Descent',
                description: 'Watch optimization algorithms navigate the surface of a loss function.',
                component: lazyWithPreload(() => import('../scenes/calculus/GradientDescent')),
            },
            {
                id: 'taylor-remainder',
                title: 'Taylor Series Remainder',
                description: 'Explore the Taylor series and visualize the error term (remainder) across different degrees.',
                component: lazyWithPreload(() => import('../scenes/calculus/TaylorRemainder')),
            },
            {
                id: 'riemann-integral',
                title: 'Riemann Integral',
                description: 'Visualize domain partitioning and understand when Riemann integration breaks down.',
                component: lazyWithPreload(() => import('../scenes/calculus/RiemannIntegral')),
            },
            {
                id: 'sigma-algebra',
                title: 'σ-Algebra & Measure Theory',
                description: 'Explore the mathematical "whitelist" that prevents paradoxes in integration and probability.',
                component: lazyWithPreload(() => import('../scenes/calculus/SigmaAlgebra')),
            },
            {
                id: 'riemann-vs-lebesgue',
                title: 'Riemann vs Lebesgue',
                description: 'Compare how Riemann and Lebesgue integration handle functions with sharp spikes.',
                component: lazyWithPreload(() => import('../scenes/calculus/RiemannVsLebesgue')),
            },
            {
                id: 'lebesgue-measure',
                title: 'Lebesgue Measure Properties',
                description: 'Understand the universal ruler: building blocks, outer measure, and why 2D planes have zero 3D volume.',
                component: lazyWithPreload(() => import('../scenes/calculus/LebesgueMeasure')),
            },
        ],
    },
    {
        id: 'probability',
        title: 'Probability',
        icon: '⚄',
        color: '#fd79a8',
        gradient: 'linear-gradient(135deg, #fd79a8, #fab1a0)',
        subtopics: [
            {
                id: 'distributions',
                title: 'Distributions',
                description: 'Explore probability distributions as 3D surfaces and curves.',
                component: lazyWithPreload(() => import('../scenes/probability/Distributions')),
            },
            {
                id: 'bayes-theorem',
                title: "Bayes' Theorem",
                description: 'Follow a spam-filter example to see how a clue changes a chance, and why false alarms matter.',
                component: lazyWithPreload(() => import('../scenes/probability/BayesTheorem')),
            },
            {
                id: 'monte-carlo',
                title: 'Monte Carlo',
                description: 'Watch random sampling converge to true probability values.',
                component: lazyWithPreload(() => import('../scenes/probability/MonteCarlo')),
            },
            {
                id: 'log-likelihood',
                title: 'Log-Likelihood',
                description: 'Visualize how parameters maximize the probability of observing data.',
                component: lazyWithPreload(() => import('../scenes/probability/LogLikelihood')),
            },
            {
                id: 'probability-vs-likelihood',
                title: 'Probability vs Likelihood',
                description: 'Explore the 3D Gaussian surface f(b|x) for b = Ax + ε. Slice it as a probability distribution (forward) or a likelihood function (inverse) to find the MLE.',
                component: lazyWithPreload(() => import('../scenes/probability/ProbabilityVsLikelihood')),
            },
            {
                id: 'variational-inference',
                title: 'Variational Inference',
                description: 'Explore a conceptual illustration of the ELBO–KL identity. Move an approximate hill toward a multi-peaked posterior; schematic values show a remaining approximation gap.',
                component: lazyWithPreload(() => import('../scenes/probability/VariationalInference')),
            },
        ],
    },
    {
        id: 'ml',
        title: 'Machine Learning',
        icon: '⬡',
        color: '#fdcb6e',
        gradient: 'linear-gradient(135deg, #fdcb6e, #f39c12)',
        subtopics: [
            {
                id: 'bias-variance',
                title: 'Bias–Variance Tradeoff',
                description: 'Fit models to repeated training samples. Adjust complexity, sample size, and noise to compare bias, variance, and prediction error.',
                visualization: 'experiment',
                component: lazyWithPreload(() => import('../scenes/ml/BiasVariance')),
            },
            {
                id: 'signal-to-noise',
                title: 'Signal-to-Noise Ratio',
                description: 'Separate the underlying signal from observation noise and see how their variance ratio changes the data and prediction error.',
                visualization: 'experiment',
                component: lazyWithPreload(() => import('../scenes/ml/SignalToNoise')),
            },
            {
                id: 'neural-networks',
                title: 'Neural Networks',
                description: 'Manipulate actual feed-forward activations, inspect weighted connections, and train a tiny XOR network.',
                component: lazyWithPreload(() => import('../scenes/ml/NeuralNetworks')),
            },
            {
                id: 'decision-boundaries',
                title: 'Decision Boundaries',
                description: 'See how classifiers partition feature space into decision regions.',
                component: lazyWithPreload(() => import('../scenes/ml/DecisionBoundaries')),
            },
            {
                id: 'gradient-descent-ml',
                title: 'Gradient Descent',
                description: 'Observe the optimization path through a high-dimensional loss landscape.',
                component: lazyWithPreload(() => import('../scenes/ml/GradientDescentML')),
            },
            {
                id: 'measure-theory-ml',
                title: 'Measure Theory in ML',
                description: 'Why "size" and "sets" matter: Manifolds, Normalizing Flows, and ReLU singularities.',
                component: lazyWithPreload(() => import('../scenes/ml/MeasureTheoryML')),
            },
            {
                id: 'lagrange-constraints',
                title: 'Ridge & Lasso Constraints',
                description: 'Visualize regularization as a budget constraint: see how Ridge (L2) and Lasso (L1) penalties shrink model weights in 3D.',
                component: lazyWithPreload(() => import('../scenes/ml/LagrangeConstraints')),
            },
            {
                id: 'lp-regularization',
                title: 'Lp Norm Balls',
                description: 'Manipulate an input vector and compare L1, L2, L3, and L∞ balls, with illustrative radial shrinkage under each norm.',
                component: lazyWithPreload(() => import('../scenes/ml/LpRegularization')),
            },
            {
                id: 'linear-models',
                title: 'Linear Models for Classification',
                description: 'Compare logistic probabilities, least-squares scores, and perceptron decisions on the same two-class training data.',
                component: lazyWithPreload(() => import('../scenes/ml/LinearModels')),
            },
            {
                id: 'linear-discriminants',
                title: 'Linear Discriminant Geometry',
                description: 'Visualize the geometric relationship between the weight vector w, bias w₀, and the decision boundary. Drag the test point to see the signed perpendicular distance r.',
                component: lazyWithPreload(() => import('../scenes/ml/LinearDiscriminants')),
            },
            {
                id: 'least-squares-multiclass',
                title: '1-of-K Least Squares',
                description: 'Visualize how 1-of-K encoding fits a separate linear model per class. Use Target View to see what each line is trying to fit, and watch argmax carve out decision regions.',
                component: lazyWithPreload(() => import('../scenes/ml/LeastSquaresMulticlass')),
            },
            {
                id: 'lagrange-multipliers',
                title: 'Lagrange Multipliers',
                description: 'Minimize f(x,y) = x² + y² subject to x + y = 4. Watch the gradient vectors ∇f and ∇g align at the constrained optimum — the geometric heart of Lagrange theory.',
                component: lazyWithPreload(() => import('../scenes/ml/LagrangeMultipliers')),
            },
            {
                id: 'fisher-lda',
                title: "Fisher's Linear Discriminant",
                description: 'Step-by-step derivation of Fisher\'s LDA: see why w ∝ S_W⁻¹(m₂ − m₁) maximises class separation, project data onto the optimal axis, and classify new points interactively.',
                component: lazyWithPreload(() => import('../scenes/ml/FisherLDA')),
            },
            {
                id: 'gaussian-mixture',
                title: 'Gaussian Mixture Models',
                description: 'Watch Expectation–Maximization fit K=3 Gaussians to 3D data. Step through E (responsibilities) and M (refit means & variances), or auto-run ten iterations.',
                component: lazyWithPreload(() => import('../scenes/ml/GaussianMixture')),
            },
            ...mlVisualLessons,
        ],
    },
];

export function getTopicById(id: string): Topic | undefined {
    return topics.find((t) => t.id === id);
}

export function getSubtopicById(topicId: string, subtopicId: string): Subtopic | undefined {
    const topic = getTopicById(topicId);
    return topic?.subtopics.find((s) => s.id === subtopicId);
}
