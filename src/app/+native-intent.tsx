import { postPostponeLink, redirectPostponeSystemPath } from '../domain/postpone-request';

let linkSequence = 0;
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const key = Date.now().toString(36) + '-' + (++linkSequence);
  const redirected = redirectPostponeSystemPath(path, key);
  if (redirected !== path) {
    const values = new URL(redirected, 'remilo:///').searchParams.getAll('postponeRequest');
    postPostponeLink(values.length === 1 ? values[0] : values, key);
  }
  return redirected;
}
