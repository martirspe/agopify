import {
  isKnowledgeTopic,
  KNOWLEDGE_POLICY_TEMPLATES,
  KNOWLEDGE_TOPIC_META,
  KNOWLEDGE_TOPICS,
  topicLabel,
} from './knowledge-topics';

describe('knowledge topics', () => {
  it('exposes the six corporate buckets', () => {
    expect(KNOWLEDGE_TOPICS).toEqual([
      'GENERAL',
      'SHIPPING',
      'RETURNS',
      'PAYMENTS',
      'HOURS',
      'ABOUT',
    ]);
    expect(KNOWLEDGE_TOPIC_META).toHaveLength(6);
  });

  it('validates and labels topics', () => {
    expect(isKnowledgeTopic('SHIPPING')).toBe(true);
    expect(isKnowledgeTopic('UNKNOWN')).toBe(false);
    expect(topicLabel('RETURNS')).toBe('Cambios y devoluciones');
    expect(topicLabel('missing')).toBe('General');
  });

  it('ships starter templates only for key policy topics', () => {
    const topics = new Set(KNOWLEDGE_POLICY_TEMPLATES.map((item) => item.topic));
    expect(topics.has('GENERAL')).toBe(false);
    expect(topics.has('SHIPPING')).toBe(true);
    expect(topics.has('RETURNS')).toBe(true);
    expect(topics.has('PAYMENTS')).toBe(true);
    expect(topics.has('HOURS')).toBe(true);
    expect(topics.has('ABOUT')).toBe(true);
    for (const item of KNOWLEDGE_POLICY_TEMPLATES) {
      expect(item.question.length).toBeGreaterThanOrEqual(4);
      expect(item.answer.length).toBeGreaterThanOrEqual(4);
    }
  });
});
