import { getSubtopicById, getTopicById, type Subtopic } from './topics';

export type MLSectionId = 'algorithms' | 'concepts';

export interface LessonReference {
    topicId: string;
    subtopicId: string;
}

export interface MLFamily {
    id: string;
    title: string;
    description: string;
    lessonIds: readonly string[];
}

export interface MLSection {
    id: MLSectionId;
    title: string;
    description: string;
    families: readonly MLFamily[];
}

export interface LearningPath {
    id: string;
    title: string;
    description: string;
    lessons: readonly LessonReference[];
}

export interface LessonRelationships {
    prerequisites: readonly LessonReference[];
    related: readonly LessonReference[];
}

export interface ResolvedLesson extends LessonReference {
    title: string;
    topicTitle: string;
    description: string;
    subtopic: Subtopic;
}

const ml = (subtopicId: string): LessonReference => ({ topicId: 'ml', subtopicId });
const probability = (subtopicId: string): LessonReference => ({ topicId: 'probability', subtopicId });
const calculus = (subtopicId: string): LessonReference => ({ topicId: 'calculus', subtopicId });
const linearAlgebra = (subtopicId: string): LessonReference => ({ topicId: 'linear-algebra', subtopicId });

export const mlSections: readonly MLSection[] = [
    {
        id: 'algorithms',
        title: 'Algorithms',
        description: 'Explore how particular models learn from data, make predictions, and separate classes.',
        families: [
            {
                id: 'linear-classification',
                title: 'Linear models & classification',
                description: 'Start with a linear decision rule, then compare different objectives and extend to multiple classes.',
                lessonIds: ['linear-models', 'least-squares-multiclass', 'fisher-lda'],
            },
            {
                id: 'mixture-models',
                title: 'Mixture models',
                description: 'Discover hidden groups by fitting a mixture of probability distributions.',
                lessonIds: ['gaussian-mixture'],
            },
            {
                id: 'neural-networks',
                title: 'Neural networks',
                description: 'Follow activations through layers and connect network learning to optimization.',
                lessonIds: ['neural-networks'],
            },
        ],
    },
    {
        id: 'concepts',
        title: 'Core Concepts',
        description: 'Study the ideas shared by many algorithms: noisy data, generalization, optimization, and geometry.',
        families: [
            {
                id: 'generalization-noise',
                title: 'Generalization & noisy data',
                description: 'Distinguish the noise in observations from the bias and variability of a fitted model.',
                lessonIds: ['signal-to-noise', 'bias-variance'],
            },
            {
                id: 'optimization-regularization',
                title: 'Optimization & regularization',
                description: 'See how models minimize an objective and how constraints control their weights.',
                lessonIds: ['gradient-descent-ml', 'lagrange-multipliers', 'lagrange-constraints', 'lp-regularization'],
            },
            {
                id: 'geometry-measure',
                title: 'Geometry & measure',
                description: 'Connect decision regions, projections, and distributions to their mathematical structure.',
                lessonIds: ['linear-discriminants', 'decision-boundaries', 'measure-theory-ml'],
            },
        ],
    },
];

export const learningPaths: readonly LearningPath[] = [
    {
        id: 'linear-classification',
        title: 'From vectors to classification',
        description: 'Build a decision rule from vector geometry, fit it to data, then compare multiclass and Fisher classifiers.',
        lessons: [linearAlgebra('vector-operations'), ml('linear-discriminants'), ml('linear-models'), ml('least-squares-multiclass'), ml('fisher-lda'), ml('decision-boundaries')],
    },
    {
        id: 'generalization',
        title: 'Noise, complexity & generalization',
        description: 'Understand noisy observations, compare repeated fits, and use regularization to control model flexibility.',
        lessons: [probability('distributions'), ml('signal-to-noise'), ml('bias-variance'), ml('lagrange-constraints'), ml('lp-regularization')],
    },
    {
        id: 'mixture-estimation',
        title: 'From likelihood to mixture models',
        description: 'Separate probability from likelihood, learn parameter estimation, and watch EM fit hidden groups.',
        lessons: [probability('distributions'), probability('probability-vs-likelihood'), probability('log-likelihood'), ml('gaussian-mixture'), probability('bayes-theorem'), probability('variational-inference')],
    },
    {
        id: 'network-optimization',
        title: 'Gradients to neural networks',
        description: 'Follow partial derivatives into gradient descent, then connect the learning rule to a layered model.',
        lessons: [calculus('partial-derivatives'), calculus('gradient-descent-calc'), ml('gradient-descent-ml'), ml('neural-networks')],
    },
];

export const mlFoundations: readonly LessonReference[] = [
    probability('log-likelihood'),
    calculus('partial-derivatives'),
    linearAlgebra('vector-operations'),
];

export const mlLessonRelationships: Readonly<Record<string, LessonRelationships>> = {
    'linear-models': {
        prerequisites: [linearAlgebra('vector-operations'), ml('linear-discriminants')],
        related: [ml('gradient-descent-ml'), ml('lagrange-constraints'), ml('bias-variance'), probability('log-likelihood')],
    },
    'least-squares-multiclass': {
        prerequisites: [ml('linear-models'), linearAlgebra('matrix-transformations')],
        related: [ml('decision-boundaries'), ml('bias-variance'), ml('lagrange-constraints')],
    },
    'fisher-lda': {
        prerequisites: [ml('linear-discriminants'), linearAlgebra('eigenvalues'), probability('distributions')],
        related: [ml('decision-boundaries'), ml('signal-to-noise'), ml('linear-models')],
    },
    'gaussian-mixture': {
        prerequisites: [probability('distributions'), probability('log-likelihood')],
        related: [probability('bayes-theorem'), probability('variational-inference'), ml('signal-to-noise')],
    },
    'neural-networks': {
        prerequisites: [linearAlgebra('matrix-transformations'), ml('gradient-descent-ml')],
        related: [ml('decision-boundaries'), ml('bias-variance'), ml('lagrange-constraints'), ml('measure-theory-ml')],
    },
    'signal-to-noise': {
        prerequisites: [probability('distributions')],
        related: [ml('bias-variance'), ml('linear-models'), ml('fisher-lda'), ml('gaussian-mixture')],
    },
    'bias-variance': {
        prerequisites: [ml('signal-to-noise'), probability('distributions')],
        related: [ml('lagrange-constraints'), ml('linear-models'), ml('least-squares-multiclass'), ml('neural-networks')],
    },
    'gradient-descent-ml': {
        prerequisites: [calculus('partial-derivatives'), calculus('gradient-descent-calc')],
        related: [calculus('jacobian-hessian'), ml('linear-models'), ml('neural-networks'), probability('log-likelihood')],
    },
    'lagrange-multipliers': {
        prerequisites: [calculus('partial-derivatives')],
        related: [ml('lagrange-constraints'), ml('lp-regularization'), ml('gradient-descent-ml')],
    },
    'lagrange-constraints': {
        prerequisites: [ml('lagrange-multipliers'), ml('linear-models')],
        related: [ml('lp-regularization'), ml('bias-variance'), ml('neural-networks')],
    },
    'lp-regularization': {
        prerequisites: [ml('lagrange-constraints'), linearAlgebra('vector-operations')],
        related: [ml('bias-variance'), ml('linear-models'), ml('neural-networks')],
    },
    'linear-discriminants': {
        prerequisites: [linearAlgebra('vector-operations')],
        related: [ml('linear-models'), ml('fisher-lda'), ml('decision-boundaries')],
    },
    'decision-boundaries': {
        prerequisites: [ml('linear-discriminants')],
        related: [ml('linear-models'), ml('least-squares-multiclass'), ml('fisher-lda'), ml('neural-networks')],
    },
    'measure-theory-ml': {
        prerequisites: [calculus('sigma-algebra'), calculus('lebesgue-measure'), probability('distributions')],
        related: [linearAlgebra('matrix-transformations'), ml('neural-networks'), probability('variational-inference')],
    },
};

export function sameLesson(first: LessonReference, second: LessonReference): boolean {
    return first.topicId === second.topicId && first.subtopicId === second.subtopicId;
}

export function resolveLesson(reference: LessonReference): ResolvedLesson | undefined {
    const topic = getTopicById(reference.topicId);
    const subtopic = getSubtopicById(reference.topicId, reference.subtopicId);
    if (!topic || !subtopic) return undefined;
    return { ...reference, title: subtopic.title, topicTitle: topic.title, description: subtopic.description, subtopic };
}

export function getMLSection(subtopicId: string): MLSection | undefined {
    return mlSections.find(section => section.families.some(family => family.lessonIds.includes(subtopicId)));
}

export function getLearningPaths(reference: LessonReference): readonly LearningPath[] {
    return learningPaths.filter(path => path.lessons.some(lesson => sameLesson(lesson, reference)));
}

export function getPathNavigation(pathId: string | null | undefined, reference: LessonReference) {
    const path = learningPaths.find(candidate => candidate.id === pathId);
    const index = path?.lessons.findIndex(lesson => sameLesson(lesson, reference)) ?? -1;
    if (!path || index < 0) return undefined;
    return { path, index, previous: path.lessons[index - 1], next: path.lessons[index + 1] };
}

export function lessonUrl(reference: LessonReference, pathId?: string | null): string {
    const url = `/${reference.topicId}/${reference.subtopicId}`;
    const navigation = getPathNavigation(pathId, reference);
    return navigation ? `${url}?path=${encodeURIComponent(navigation.path.id)}` : url;
}

export function getLessonRelationships(reference: LessonReference): LessonRelationships {
    const direct = reference.topicId === 'ml' ? mlLessonRelationships[reference.subtopicId] : undefined;
    const related = [...(direct?.related ?? [])];
    for (const [subtopicId, relationships] of Object.entries(mlLessonRelationships)) {
        if ([...relationships.prerequisites, ...relationships.related].some(lesson => sameLesson(lesson, reference))) {
            const backlink = ml(subtopicId);
            if (!related.some(lesson => sameLesson(lesson, backlink)) && !direct?.prerequisites.some(lesson => sameLesson(lesson, backlink))) {
                related.push(backlink);
            }
        }
    }
    // Every mathematical lesson on a sequence also points to the ML lessons it supports.
    if (reference.topicId !== 'ml') {
        for (const path of getLearningPaths(reference)) {
            for (const lesson of path.lessons.filter(candidate => candidate.topicId === 'ml')) {
                if (!related.some(candidate => sameLesson(candidate, lesson))) related.push(lesson);
            }
        }
    }
    return { prerequisites: direct?.prerequisites ?? [], related };
}

export function hasLessonConnections(topicId: string, subtopicId: string): boolean {
    const reference = { topicId, subtopicId };
    if (!resolveLesson(reference)) return false;
    const relationships = getLessonRelationships(reference);
    return relationships.prerequisites.length > 0 || relationships.related.length > 0 || getLearningPaths(reference).length > 0;
}
