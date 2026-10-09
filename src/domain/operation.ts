/** A mounted UI operation keeps its captured input until a definitive response. */
export class CapturedOperation<Input, Result> {
  private input?: Input;
  private flight?: Promise<Result>;
  constructor(private perform: (input: Input) => Promise<Result>, private rejected: (error: unknown) => boolean) {}
  get pending() { return this.input !== undefined; }
  get captured() { return this.input; }
  run(input: Input) {
    if (this.flight) return this.flight;
    this.input ??= input;
    this.flight = this.perform(this.input).then((result) => { this.input = undefined; return result; }, (error: unknown) => {
      if (this.rejected(error)) this.input = undefined;
      throw error;
    }).finally(() => { this.flight = undefined; });
    return this.flight;
  }
}
