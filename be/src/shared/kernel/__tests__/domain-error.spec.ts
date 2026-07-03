import { DomainError } from '../domain-error';

class StoryNotFound extends DomainError {
  readonly code = 'STORY_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(public readonly storyId: string) {
    super(`Story ${storyId} not found`);
  }
}

describe('DomainError', () => {
  it('is an Error instance', () => {
    const err = new StoryNotFound('abc');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
  });

  it('exposes code and httpStatus', () => {
    const err = new StoryNotFound('abc');
    expect(err.code).toBe('STORY_NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  it('carries the message', () => {
    expect(new StoryNotFound('abc').message).toBe('Story abc not found');
  });

  it('carries the stack', () => {
    expect(new StoryNotFound('abc').stack).toBeDefined();
  });
});
