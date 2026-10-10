import { describe, it } from 'vitest';
import assert from 'node:assert';
import { getTopicById, getSubtopicById, topics } from './topics.ts';

describe('Topics Data Access', () => {
  describe('getTopicById', () => {
    it('should return the correct topic for a valid ID', () => {
      const topic = getTopicById('linear-algebra');
      assert.ok(topic);
      assert.strictEqual(topic?.id, 'linear-algebra');
      assert.strictEqual(topic?.title, 'Linear Algebra');
    });

    it('should return undefined for a non-existent ID', () => {
      const topic = getTopicById('non-existent-id');
      assert.strictEqual(topic, undefined);
    });
  });

  describe('getSubtopicById', () => {
    it('should return the correct subtopic for valid topic and subtopic IDs', () => {
      const subtopic = getSubtopicById('linear-algebra', 'vector-operations');
      assert.ok(subtopic);
      assert.strictEqual(subtopic?.id, 'vector-operations');
      assert.strictEqual(subtopic?.title, 'Vector Operations');
    });

    it('should return undefined for a valid topic ID but invalid subtopic ID', () => {
      const subtopic = getSubtopicById('linear-algebra', 'non-existent-subtopic');
      assert.strictEqual(subtopic, undefined);
    });

    it('should return undefined for a non-existent topic ID', () => {
      const subtopic = getSubtopicById('non-existent-topic', 'vector-operations');
      assert.strictEqual(subtopic, undefined);
    });
  });

  describe('Data Integrity', () => {
    it('should have unique topic IDs', () => {
      const ids = topics.map(t => t.id);
      const uniqueIds = new Set(ids);
      assert.strictEqual(ids.length, uniqueIds.size, 'Duplicate topic IDs found');
    });

    it('should have unique subtopic IDs within each topic', () => {
      topics.forEach(topic => {
        const subtopicIds = topic.subtopics.map(s => s.id);
        const uniqueSubtopicIds = new Set(subtopicIds);
        assert.strictEqual(
          subtopicIds.length,
          uniqueSubtopicIds.size,
          `Duplicate subtopic IDs found in topic: ${topic.id}`
        );
      });
    });
  });
});
