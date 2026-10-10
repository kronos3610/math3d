import { describe, expect, it } from 'vitest';
import { getLessonGuide, lessonGuides } from './lessonGuides';
import { topics } from './topics';

describe('brief lesson guides', () => {
    it('provides useful guidance for every registered lesson, including the graphics check', () => {
        for (const topic of topics) {
            for (const lesson of topic.subtopics) {
                const guide = getLessonGuide(topic.id, lesson.id);
                expect(guide, `${topic.id}/${lesson.id}`).toBeDefined();
                expect(guide!.meaning.trim().length).toBeGreaterThan(20);
                expect(guide!.observe.trim().length).toBeGreaterThan(20);
                expect(guide!.steps.length).toBeGreaterThanOrEqual(2);
                expect(guide!.steps.length).toBeLessThanOrEqual(3);
                expect(guide!.steps.every(step => step.trim().length > 15)).toBe(true);
                if (guide!.limitations) expect(guide!.limitations.trim().length).toBeGreaterThan(20);
            }
        }
    });

    it('has no orphaned guide entries and returns undefined for unknown routes', () => {
        for (const [topicId, lessons] of Object.entries(lessonGuides)) {
            const topic = topics.find(candidate => candidate.id === topicId);
            expect(topic).toBeDefined();
            for (const subtopicId of Object.keys(lessons)) {
                expect(topic!.subtopics.some(lesson => lesson.id === subtopicId), `${topicId}/${subtopicId}`).toBe(true);
            }
        }
        expect(getLessonGuide('unknown', 'unknown')).toBeUndefined();
        expect(getLessonGuide('ml', 'unknown')).toBeUndefined();
        expect(getLessonGuide('__proto__', 'toString')).toBeUndefined();
        expect(getLessonGuide('ml', 'toString')).toBeUndefined();
    });

    it('distinguishes schematic animations and regression scores from computed quantities', () => {
        expect(getLessonGuide('ml', 'neural-networks')!.limitations).toContain('does not train weights');
        expect(getLessonGuide('linear-algebra', 'banach-tarski')!.limitations).toContain('not the theorem’s non-measurable sets');
        expect(getLessonGuide('probability', 'variational-inference')!.limitations).toContain('does not compute ELBO');
        expect(getLessonGuide('ml', 'linear-models')!.limitations).toContain('raw regression score');
        expect(getLessonGuide('ml', 'lp-regularization')!.limitations).toContain('radial shrinkage');
    });
});
