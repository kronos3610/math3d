import type { PreviewMotif } from './topics';

/** Static previews describe the lesson without loading its renderer. */
export function previewForLesson(id: string): PreviewMotif {
    if (/tree|forest|bagging|boost|lightgbm/.test(id)) return 'tree';
    if (/transformer|attention|rnn|lstm|gru|mamba|state-space|markov|memory|position|cache|decod/.test(id)) return 'sequence';
    if (/neural|network|activation|embedding|mixture-of-experts/.test(id)) return 'network';
    if (/distribution|likelihood|bayes|variational|gaussian/.test(id)) return 'bell';
    if (/integral|lebesgue|sigma|regularization|constraint/.test(id)) return 'bars';
    if (/vector|eigen|subspace|discriminant|gradient-flow/.test(id)) return 'vectors';
    if (/simple-test|matrix|banach|measure-theory/.test(id)) return 'cube';
    if (/monte|boundary|boundaries|svm|projection|fisher/.test(id)) return 'scatter';
    if (/regression|bias|noise|least-square|taylor|loss/.test(id)) return 'curve';
    return 'surface';
}
