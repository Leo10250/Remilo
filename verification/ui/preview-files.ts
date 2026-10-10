// In-memory exports for the opt-in web fixture only. No filesystem or picker access.
export const Paths = { cache: 'memory://remilo-preview' };
export class Directory {
  readonly uri: string;
  constructor(parent: string, name: string) { this.uri = `${parent}/${name}`; }
  create() {}
}
export class File {
  readonly uri: string;
  private content = '';
  constructor(parent: Directory | string, name?: string) { this.uri = `${typeof parent === 'string' ? parent : parent.uri}${name ? '/' + name : ''}`; }
  create() {}
  write(content: string) { this.content = content; }
  async text() { return this.content; }
  static async pickFileAsync(): Promise<never> { throw new Error('File restoration requires the Android app.'); }
}
