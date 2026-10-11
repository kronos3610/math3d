import { describe, expect, it } from 'vitest';
import { getTopicById } from './topics';
import {
    getLearningPaths, getLessonRelationships, getMLSection, getPathNavigation, hasLessonConnections,
    learningPaths, lessonUrl, mlFoundations, mlLessonRelationships, mlSections, resolveLesson, sameLesson,
} from './mlCurriculum';

describe('ML curriculum integrity', () => {
    it('organizes every canonical ML lesson once, with no unavailable lessons', () => {
        const grouped = mlSections.flatMap(section => section.families.flatMap(family => family.lessonIds));
        const canonical = getTopicById('ml')!.subtopics.map(lesson => lesson.id);
        expect([...grouped].sort()).toEqual([...canonical].sort());
        expect(new Set(grouped).size).toBe(grouped.length);
        for (const id of canonical) {
            expect(getMLSection(id)).toBeDefined();
            expect(mlLessonRelationships[id]).toBeDefined();
        }
    });

    it('resolves every relationship, foundation, and path to the registered scene', () => {
        const references = [
            ...mlFoundations,
            ...Object.values(mlLessonRelationships).flatMap(relationships => [...relationships.prerequisites, ...relationships.related]),
            ...learningPaths.flatMap(path => path.lessons),
        ];
        for (const reference of references) {
            expect(resolveLesson(reference), lessonUrl(reference)).toBeDefined();
        }
        for (const [subtopicId, relationships] of Object.entries(mlLessonRelationships)) {
            const reference = { topicId: 'ml', subtopicId };
            expect([...relationships.prerequisites, ...relationships.related].some(candidate => sameLesson(candidate, reference))).toBe(false);
        }
    });

    it('has unique meaningful paths and valid previous/next links at every step', () => {
        expect(new Set(learningPaths.map(path => path.id)).size).toBe(learningPaths.length);
        for (const path of learningPaths) {
            expect(path.lessons.length).toBeGreaterThan(2);
            expect(new Set(path.lessons.map(lesson => lessonUrl(lesson))).size).toBe(path.lessons.length);
            path.lessons.forEach((reference, index) => {
                const navigation = getPathNavigation(path.id, reference)!;
                expect(navigation.index).toBe(index);
                expect(navigation.previous).toEqual(path.lessons[index - 1]);
                expect(navigation.next).toEqual(path.lessons[index + 1]);
                expect(lessonUrl(reference, path.id)).toBe(`${lessonUrl(reference)}?path=${path.id}`);
            });
        }
    });

    it('drops irrelevant or unknown path IDs and supports a lesson shared by paths', () => {
        const noise = { topicId: 'ml', subtopicId: 'signal-to-noise' };
        expect(lessonUrl(noise, 'network-optimization')).toBe('/ml/signal-to-noise');
        expect(lessonUrl(noise, 'missing')).toBe('/ml/signal-to-noise');
        expect(getPathNavigation('missing', noise)).toBeUndefined();
        expect(getLearningPaths({ topicId: 'probability', subtopicId: 'distributions' }).map(path => path.id)).toEqual(['generalization', 'mixture-estimation', 'probability-core']);
    });

    it('links mathematical foundations back to ML without duplicate references', () => {
        const distributions = { topicId: 'probability', subtopicId: 'distributions' };
        const relationships = getLessonRelationships(distributions);
        expect(relationships.related).toContainEqual({ topicId: 'ml', subtopicId: 'signal-to-noise' });
        expect(relationships.related).toContainEqual({ topicId: 'ml', subtopicId: 'gaussian-mixture' });
        expect(new Set(relationships.related.map(reference => lessonUrl(reference))).size).toBe(relationships.related.length);
        expect(hasLessonConnections(distributions.topicId, distributions.subtopicId)).toBe(true);
        expect(hasLessonConnections('ml', 'missing')).toBe(false);
        expect(hasLessonConnections('linear-algebra', 'simple-test')).toBe(true);
    });
});
