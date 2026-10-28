const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/game/damageFeedback.ts');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module: moduleObject, exports: moduleObject.exports });
const { damageFeedback } = moduleObject.exports;
assert.equal(damageFeedback(0).tint, 0);
assert.equal(damageFeedback(-20).x, 0);
let moving = false;
for (let elapsed = 0; elapsed < 280; elapsed += 8) {
  const frame = damageFeedback(1100 - elapsed);
  assert(Math.abs(frame.x) <= 8 && Math.abs(frame.y) <= 5);
  assert(frame.tint >= 0 && frame.tint <= 0.14);
  if (Math.abs(frame.x) > 1) moving = true;
  const repeated = damageFeedback(1100 - elapsed);
  assert.equal(frame.x, repeated.x); assert.equal(frame.y, repeated.y);
}
assert(moving, 'Losing HP produces a visible camera displacement');
for (const elapsed of [280, 400, 900, 1100]) {
  const frame = damageFeedback(1100 - elapsed);
  assert(Math.abs(frame.x) < 1e-8 && Math.abs(frame.y) < 1e-8 && frame.tint === 0, 'Hit feedback settles completely');
}
console.log('Damage feedback passed: bounded deterministic shake, brief tint, exact freeze from simulation timer and complete settlement.');