#!/usr/bin/env node

const fs = require('fs');
const { execFileSync } = require('child_process');

const mode = process.argv.includes('--all') ? 'all' : 'staged';
const allowedFiles = new Set([
  '.gitignore',
  '.github/workflows/secret-guard.yml',
  'scripts/check-secrets.js',
]);

const blockedPathPatterns = [
  { name: 'private key file', regex: /(^|[\\/])(?:key\.pem|id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:$|[\\/])/i },
  { name: 'pem file', regex: /\.pem$/i },
  { name: 'env file', regex: /(^|[\\/])\.env(?:\.|$)/i },
  { name: 'VPS secret folder', regex: /DO_NOT_UPLOAD_TO_GITHUB/i },
  { name: 'VPS info file', regex: /VPS\s*INFO/i },
];

const blockedContentPatterns = [
  { name: 'private key block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'OpenSSH private key', regex: /-----BEGIN OPENSSH PRIVATE KEY-----/ },
  { name: 'VPS secret marker', regex: /(?:DO_NOT_UPLOAD_TO_GITHUB|VPS\s*INFO|pass ssh|ssh password)/i },
  { name: 'hard-coded secret assignment', regex: /\b(?:api[_-]?key|secret[_-]?key|private[_-]?key|password|passwd)\b\s*[:=]\s*['"][^'"\n]{12,}['"]/i },
];

function gitFiles() {
  const args = mode === 'all'
    ? ['ls-files', '-z']
    : ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'];
  const output = execFileSync('git', args, { encoding: 'utf8' });
  return output.split('\0').filter(Boolean).map(file => file.replace(/\\/g, '/'));
}

function looksBinary(buffer) {
  return buffer.includes(0);
}

function scanFile(file) {
  if (allowedFiles.has(file)) return [];
  const problems = [];

  for (const pattern of blockedPathPatterns) {
    if (pattern.regex.test(file)) problems.push(`${file}: blocked path (${pattern.name})`);
  }

  if (!fs.existsSync(file)) return problems;
  const stat = fs.statSync(file);
  if (!stat.isFile()) return problems;
  if (stat.size > 2 * 1024 * 1024) return problems;

  const buffer = fs.readFileSync(file);
  if (looksBinary(buffer)) return problems;

  const text = buffer.toString('utf8');
  for (const pattern of blockedContentPatterns) {
    if (pattern.regex.test(text)) problems.push(`${file}: blocked content (${pattern.name})`);
  }

  return problems;
}

const problems = gitFiles().flatMap(scanFile);

if (problems.length) {
  console.error('Secret guard blocked this change:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Secret guard passed (${mode}).`);
