import fs from 'node:fs';
import path from 'node:path';

const repository = path.resolve(import.meta.dirname, '..');
const portable = value => value.split(path.sep).join('/');

/** Preserve line numbers while excluding fenced examples from link checks. */
function prose(text) {
  let fence;
  return text.split(/\r?\n/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return '';
    }
    return fence ? '' : line;
  });
}

export function markdownAnchors(text) {
  const anchors = new Set();
  const addHeading = title => {
    const base = title.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '')
      .toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').trim().replace(/\s/g, '-');
    let slug = base, suffix = 0;
    while (anchors.has(slug)) slug = `${base}-${++suffix}`;
    anchors.add(slug);
  };
  const lines = prose(text);
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) addHeading(heading[1]);
    else if (index > 0 && /^ {0,3}(?:=+|-+)\s*$/.test(lines[index]) && lines[index - 1].trim()) addHeading(lines[index - 1]);
    for (const match of lines[index].matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/g)) anchors.add(match[1]);
  }
  return anchors;
}

export function markdownLinks(text) {
  const lines = prose(text), links = [], definitions = new Map();
  const key = label => label.trim().replace(/\s+/g, ' ').toLowerCase();
  const target = '(?:<[^>]+>|(?:\\\\.|[^\\s()]|\\([^()]*\\))+)';
  const inline = new RegExp('!?\\[[^\\]\\n]*\\]\\(\\s*(' + target + ')(?:\\s+["\'][^\\n]*?["\'])?\\s*\\)', 'g');
  const definition = new RegExp('^ {0,3}\\[([^\\]]+)\\]:\\s*(' + target + ')');
  const unquote = value => value.startsWith('<') ? value.slice(1, -1) : value;
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(definition);
    if (match) { definitions.set(key(match[1]), unquote(match[2])); lines[index] = ''; }
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/(`+).*?\1/g, '');
    for (const match of line.matchAll(inline)) links.push({ target: unquote(match[1]), line: index + 1 });
    const withoutInline = line.replace(inline, '');
    for (const match of withoutInline.matchAll(/!?\[([^\]]+)\](?:\[([^\]]*)\])?/g)) {
      const value = definitions.get(key(match[2] || match[1]));
      if (value) links.push({ target: value, line: index + 1 });
      else if (match[2] !== undefined) links.push({ missingReference: match[2] || match[1], line: index + 1 });
    }
  }
  return links;
}

export function verifyDocs(root = repository, { entries = ['README.md', 'AGENTS.md', 'docs', 'localization/README.md', 'assets/brand/README.md', '.agents/skills'] } = {}) {
  root = fs.realpathSync(root);
  const findings = [], files = [], cache = new Map();
  const inside = absolute => absolute === root || (!path.relative(root, absolute).startsWith(`..${path.sep}`) && path.relative(root, absolute) !== '..' && !path.isAbsolute(path.relative(root, absolute)));
  const add = (file, line, target, message) => findings.push({ path: portable(path.relative(root, file)), line, target, message });
  const visit = relative => {
    const absolute = path.resolve(root, relative);
    if (!fs.existsSync(absolute)) { add(absolute, 1, relative, 'Maintained documentation entry is missing.'); return; }
    if (!inside(fs.realpathSync(absolute))) { add(absolute, 1, relative, 'Documentation entry escapes repository.'); return; }
    if (fs.statSync(absolute).isDirectory()) {
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '__pycache__') continue;
        if (entry.isDirectory() || entry.isFile() && entry.name.endsWith('.md')) visit(path.join(relative, entry.name));
      }
    } else if (absolute.endsWith('.md')) files.push(absolute);
  };
  entries.forEach(visit);
  let checked = 0;
  for (const file of files) {
    for (const link of markdownLinks(fs.readFileSync(file, 'utf8'))) {
      if (link.missingReference) { add(file, link.line, link.missingReference, 'Undefined Markdown link reference.'); continue; }
      let value = link.target.replace(/\\([ ()#])/g, '$1');
      if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) continue;
      checked++;
      try {
        const hash = value.indexOf('#'), fragment = hash < 0 ? '' : decodeURIComponent(value.slice(hash + 1));
        value = decodeURIComponent((hash < 0 ? value : value.slice(0, hash)).split('?')[0]);
        let absolute = value ? path.resolve(value.startsWith('/') ? root : path.dirname(file), value.replace(/^\//, '')) : file;
        if (!inside(absolute)) { add(file, link.line, link.target, 'Link escapes repository.'); continue; }
        if (!fs.existsSync(absolute)) { add(file, link.line, link.target, 'Local link target is missing.'); continue; }
        if (!inside(fs.realpathSync(absolute))) { add(file, link.line, link.target, 'Link resolves outside repository.'); continue; }
        if (fs.statSync(absolute).isDirectory() && fragment) absolute = path.join(absolute, 'README.md');
        if (fragment && absolute.toLowerCase().endsWith('.md')) {
          if (!cache.has(absolute)) cache.set(absolute, markdownAnchors(fs.readFileSync(absolute, 'utf8')));
          if (!cache.get(absolute).has(fragment)) add(file, link.line, link.target, 'Local Markdown anchor is missing.');
        }
      } catch (error) { add(file, link.line, link.target, error.message); }
    }
  }
  return { checks: { markdownFiles: files.length, localLinks: checked }, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const flags = process.argv.slice(2);
  if (flags.includes('--help')) console.log('npm run verify:docs\nRead-only maintained Markdown links, images and anchors. No network or Git history.');
  else if (flags.length) { console.error('Unknown option; use --help.'); process.exitCode = 1; }
  else { const result = verifyDocs(); console.log(JSON.stringify(result, null, 2)); if (result.findings.length) process.exitCode = 1; }
}
