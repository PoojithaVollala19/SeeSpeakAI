const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'frontend', 'src');

function getAllFiles(dir, exts = ['.tsx', '.ts', '.css']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getAllFiles(srcDir);
const results = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  // Match all className attributes, single-line or multi-line
  const classRegex = /className=(?:\{`([\s\S]*?)`\}|"([^"]*)")/g;
  let match;

  while ((match = classRegex.exec(content)) !== null) {
    const classStr = match[1] || match[2] || '';
    const tokens = classStr.split(/\s+/).filter(Boolean);

    const hasBgWhite = tokens.some(t => t === 'bg-white' || t.startsWith('bg-white/'));
    const hasDarkBg = tokens.some(t => t.startsWith('dark:bg-'));

    if (hasBgWhite && !hasDarkBg) {
      // Find line number
      const lineNum = content.substring(0, match.index).split('\n').length;
      results.push({
        file: path.relative(srcDir, file),
        line: lineNum,
        issue: 'bg-white without dark:bg-',
        snippet: classStr.replace(/\s+/g, ' ').trim()
      });
    }

    const hasBgSlate = tokens.some(t => t === 'bg-slate-50' || t.startsWith('bg-slate-50/'));
    if (hasBgSlate && !hasDarkBg) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      results.push({
        file: path.relative(srcDir, file),
        line: lineNum,
        issue: 'bg-slate-50 without dark:bg-',
        snippet: classStr.replace(/\s+/g, ' ').trim()
      });
    }
  }
});

console.log(`Found ${results.length} multi-line issues:`);
results.forEach(r => {
  console.log(`[${r.file}:${r.line}] ${r.issue}\n  -> ${r.snippet}`);
});
