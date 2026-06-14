export class Result<T, E> {
  private constructor(
    private readonly _value: T | undefined,
    private readonly _error: E | undefined,
    public readonly isOk: boolean,
  ) {}

  static ok<T, E = never>(value: T): Result<T, E> {
    return new Result<T, E>(value, undefined, true);
  }

  static err<T = never, E = unknown>(error: E): Result<T, E> {
    return new Result<T, E>(undefined, error, false);
  }

  get isErr(): boolean {
    return !this.isOk;
  }

  unwrap(): T {
    if (!this.isOk) {
      const err = this._error;
      if (err instanceof Error) throw err;
      throw new Error(`Result.unwrap on err: ${String(err)}`);
    }
    return this._value as T;
  }

  unwrapErr(): E {
    if (this.isOk) {
      throw new Error('Result.unwrapErr on ok');
    }
    return this._error as E;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isOk ? Result.ok<U, E>(fn(this._value as T)) : Result.err<U, E>(this._error as E);
  }

  mapErr<F>(fn: (err: E) => F): Result<T, F> {
    return this.isOk ? Result.ok<T, F>(this._value as T) : Result.err<T, F>(fn(this._error as E));
  }
}
