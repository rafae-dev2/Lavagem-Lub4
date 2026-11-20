import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGroupEditSession,
  getGroupFleets,
  parseFleetCodes,
  validateGroupFleetAddition,
} from '../src/lib/apoioGroupEdit';
import type { ApoioFleet, ApoioGroup } from '../src/types/apoio';

const ROOT = path.resolve(import.meta.dirname, '..');

const GROUPS: ApoioGroup[] = [
  { id: 'grp-pipa', nome: 'Caminhão Pipa', cor: '#20a876' },
  { id: 'grp-munck', nome: 'Caminhão Munck', cor: '#3b82f6' },
];

const FLEETS: ApoioFleet[] = [
  { frota: '4580', grupo_id: 'grp-pipa', nome: 'Pipa 02' },
  { frota: '4508', grupo_id: 'grp-pipa', nome: 'Pipa 01' },
  { frota: '4569', grupo_id: 'grp-munck', nome: 'Munck 01' },
];

test('parseFleetCodes splits commas, spaces, semicolons and deduplicates preserving order', () => {
  assert.deepEqual(parseFleetCodes(' 4581, 4582 ; 4581\n4583 '), ['4581', '4582', '4583']);
  assert.deepEqual(parseFleetCodes('   '), []);
});

test('validateGroupFleetAddition classifies newly added, existing in group, and reassigned fleets and rejects invalid input', () => {
  assert.equal(validateGroupFleetAddition('4581', '', FLEETS).ok, false);
  assert.equal(validateGroupFleetAddition('   ', 'grp-pipa', FLEETS).ok, false);
  assert.equal(validateGroupFleetAddition('FROTA 1', 'grp-pipa', FLEETS).ok, true);
  assert.equal(validateGroupFleetAddition('SEM-FROTA', 'grp-pipa', FLEETS).ok, false);
  assert.equal(validateGroupFleetAddition('bad/char', 'grp-pipa', FLEETS).ok, false);

  const res = validateGroupFleetAddition('4580, 4569, 4599', 'grp-pipa', FLEETS);
  assert.equal(res.ok, true);
  assert.deepEqual(res.frotas, ['4580', '4569', '4599']);
  assert.deepEqual(res.alreadyInGroup, ['4580']);
  assert.deepEqual(res.reassignedFromOtherGroup, ['4569']);
  assert.deepEqual(res.newlyAdded, ['4599']);
});

test('getGroupFleets filters to target group and sorts numerically using pt-BR collation', () => {
  const fleets = getGroupFleets(FLEETS, 'grp-pipa');
  assert.deepEqual(fleets.map((f) => f.frota), ['4508', '4580']);
  assert.deepEqual(getGroupFleets(FLEETS, ''), []);
});

test('createGroupEditSession clones edited group, pre-selects fleetDraft group_id, and resets inline fleet inputs', () => {
  const session = createGroupEditSession(GROUPS[0]);
  assert.deepEqual(session.groupDraft, GROUPS[0]);
  assert.notEqual(session.groupDraft, GROUPS[0]);
  assert.equal(session.fleetGroupId, 'grp-pipa');
  assert.equal(session.inlineFrotas, '');
  assert.equal(session.inlineNome, '');
});

test('ControleApoio renders inline equipment editor inside Criar ou editar grupo Apoio when Editar is clicked', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/pages/ControleApoio.tsx'), 'utf8');
  assert.match(src, /onClick=\{\(\) => startEditingGroup\(group\)\}/);
  assert.match(src, /data-testid="apoio-group-equipment-editor"/);
  assert.match(src, /Adicionar mais equipamentos \(frotas\) ao grupo/);
  assert.match(src, /Adicionar equipamentos ao grupo/);
  assert.match(src, /groupDraft\.id === group\.id \? 'Editando' : 'Editar'/);
  assert.match(src, /setFleetDraft\(draft => \(\{ \.\.\.draft, grupo_id: session\.fleetGroupId \}\)\)/);
});
