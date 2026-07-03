import { Result } from '../result';

describe('Result', () => {
  describe('Result.ok', () => {
    it('marks isOk true and isErr false', () => {
      const r = Result.ok(42);
      expect(r.isOk).toBe(true);
      expect(r.isErr).toBe(false);
    });

    it('exposes value via unwrap', () => {
      expect(Result.ok('hello').unwrap()).toBe('hello');
    });
  });

  describe('Result.err', () => {
    it('marks isOk false and isErr true', () => {
      const r = Result.err(new Error('boom'));
      expect(r.isOk).toBe(false);
      expect(r.isErr).toBe(true);
    });

    it('throws on unwrap of err', () => {
      const r = Result.err(new Error('boom'));
      expect(() => r.unwrap()).toThrow('boom');
    });

    it('exposes error via unwrapErr', () => {
      const err = new Error('boom');
      expect(Result.err(err).unwrapErr()).toBe(err);
    });
  });

  describe('map / mapErr', () => {
    it('map transforms ok value, leaves err untouched', () => {
      expect(Result.ok(2).map((n) => n * 10).unwrap()).toBe(20);
      const err = new Error('x');
      expect(Result.err<number, Error>(err).map((n) => n * 10).unwrapErr()).toBe(err);
    });

    it('mapErr transforms err, leaves ok untouched', () => {
      expect(Result.err<number, string>('a').mapErr((s) => s + 'b').unwrapErr()).toBe('ab');
      expect(Result.ok<number, string>(2).mapErr((s) => s + 'b').unwrap()).toBe(2);
    });
  });
});
