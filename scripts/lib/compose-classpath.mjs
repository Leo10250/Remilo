import { Buffer } from 'node:buffer';
import { WorkflowError } from '../tools.mjs';

export const composeReportMarker = 'REMILO_COMPOSE_CLASSPATH_REPORT_V1=';
const families = new Set(['androidx.compose.material3', 'androidx.compose.ui', 'androidx.compose.foundation', 'androidx.compose.runtime']);
const invalid = () => { throw new WorkflowError('COMPOSE_REPORT_INVALID', 'A complete resolved release Compose classpath report is required before assembly.'); };
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
function componentMap(snapshot, project, configuration) {
  if (!object(snapshot) || snapshot.project !== project || snapshot.configuration !== configuration || !Array.isArray(snapshot.components) || !snapshot.components.length || snapshot.components.length > 256) invalid();
  const components = new Map(), observedFamilies = new Set();
  for (const component of snapshot.components) {
    if (!object(component) || !families.has(component.group) || typeof component.name !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,159}$/.test(component.name) || typeof component.version !== 'string' || !/^[0-9][A-Za-z0-9.+_-]{0,79}$/.test(component.version)) invalid();
    const coordinate = component.group + ':' + component.name;
    if (components.has(coordinate)) invalid();
    components.set(coordinate, component.version); observedFamilies.add(component.group);
  }
  if ([...families].some(family => !observedFamilies.has(family))) invalid();
  return components;
}
export function parseComposeClasspathReport(output) {
  if (typeof output !== 'string') invalid();
  const reports = output.split(/\r?\n/).filter(line => line.startsWith(composeReportMarker));
  if (reports.length !== 1 || Buffer.byteLength(reports[0], 'utf8') > 262144 + composeReportMarker.length) invalid();
  let report;
  try { report = JSON.parse(reports[0].slice(composeReportMarker.length)); } catch { invalid(); }
  if (!object(report) || report.schemaVersion !== 1) invalid();
  return { nativeCompile: componentMap(report.nativeCompile, ':remilo-alarm', 'releaseCompileClasspath'), appRuntime: componentMap(report.appRuntime, ':app', 'releaseRuntimeClasspath') };
}
export function verifyComposeClasspath(output) {
  const { nativeCompile, appRuntime } = parseComposeClasspathReport(output);
  const differences = [];
  for (const [coordinate, version] of nativeCompile) {
    const packaged = appRuntime.get(coordinate);
    if (packaged !== version) differences.push(`${coordinate}: native compile ${version}; app runtime ${packaged ?? 'missing'}`);
  }
  if (differences.length) throw new WorkflowError('COMPOSE_CLASSPATH_MISMATCH', `Release Compose classpaths differ; assembly was not started.\n${differences.slice(0, 12).join('\n')}${differences.length > 12 ? '\nAdditional mismatches omitted.' : ''}`);
  return { nativeCompileComponents: nativeCompile.size, appRuntimeComponents: appRuntime.size };
}
/** Keep assembly behind the actual resolved report, including every buildRelease caller. */
export async function runComposeAlignedRelease({ report, assemble }) {
  const alignment = verifyComposeClasspath(await report());
  await assemble();
  return alignment;
}
