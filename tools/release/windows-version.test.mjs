// The Windows release version has one source (src/YariZan.App/YariZan.App.csproj). Every other place
// that states it must agree, so a mismatched installer, EULA or download record fails CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/^﻿/, '');
const project = read('src/YariZan.App/YariZan.App.csproj');
const tag = (name) => project.match(new RegExp(`<${name}>([^<]+)</${name}>`))?.[1];
const version = tag('Version');

test('the app project declares one consistent semantic version', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(tag('AssemblyVersion'), version + '.0');
  assert.equal(tag('FileVersion'), version + '.0');
  assert.equal(tag('InformationalVersion'), version);
});

test('the installer script defaults to the same version and derives every version field from it', () => {
  const iss = read('YariZan-Setup.iss');
  assert.equal(iss.match(/#define MyAppVersion\s+"([^"]+)"/)?.[1], version);
  for (const line of ['VersionInfoVersion={#MyAppVersion}.0', 'VersionInfoProductVersion={#MyAppVersion}.0', 'OutputBaseFilename=YariZan-G{#Grade}-Setup-v{#MyAppVersion}', 'AppVersion={#MyAppVersion}'])
    assert.ok(iss.includes(line), line);
  // The per-grade identity never changes, so upgrades replace the installed version.
  assert.ok(iss.includes('AppId=YariZan-Grade-{#Grade}'));
  assert.doesNotMatch(iss, /\d+\.\d+\.\d+\.\d+/, 'no hard-coded four-part version');
  assert.doesNotMatch(iss, /osameh|telegram/i, 'no obsolete contact');
  assert.ok(iss.includes('#define MyAppSupportEmail "support@oarnova.games"'), 'official support email');
});

test('the build script passes the project version to Inno Setup and checks both binaries', () => {
  const bat = read('build-installer.bat');
  assert.ok(bat.includes('"/DMyAppVersion=%VERSION%"'));
  assert.ok(bat.includes('-Kind app') && bat.includes('-Kind installer'));
  assert.doesNotMatch(bat, /\d+\.\d+\.\d+/, 'no hard-coded version in the build script');
});

test('the end-user licence states the same version in English and Persian', () => {
  const eula = read('LICENSE.txt');
  assert.ok(eula.includes('Version ' + version));
  const persian = version.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  assert.ok(eula.includes('نسخهٔ ' + persian));
  assert.doesNotMatch(eula, /osameh|telegram|serial|HWID/i);
  for (const mail of ['support@oarnova.games', 'info@oarnova.games']) assert.ok(eula.includes(mail), mail);
});

test('the download registry never lists a version newer than the app', () => {
  const registry = read('apps/web/shared/windows-release.ts');
  const listed = [...registry.matchAll(/version:\s*'(\d+\.\d+\.\d+)'/g)].map((m) => m[1]);
  const n = (v) => v.split('.').map(Number);
  for (const v of listed) {
    const [a, b] = [n(v), n(version)];
    assert.ok(a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2]))), v);
  }
});
