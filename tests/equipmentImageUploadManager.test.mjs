import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const tempDir = await mkdtemp(path.join(tmpdir(), 'equipment-image-upload-'));
const originalDocument = globalThis.document;
const originalCreateImageBitmap = globalThis.createImageBitmap;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

let canvases = [];
let encodeMode = 'webp';
let bitmapDimensions = { width: 1200, height: 800 };
let revokedUrls = [];

class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.draws = [];
    canvases.push(this);
  }

  getContext() {
    return {
      clearRect: () => {},
      drawImage: (...args) => this.draws.push(args),
    };
  }

  toBlob(callback, requestedType, quality) {
    const type = encodeMode === 'png' ? 'image/png' : 'image/webp';
    let size;
    if (encodeMode === 'resize-until-limit') {
      size = this.width > 500 ? 220_000 : 118_000;
    } else if (encodeMode === 'png') {
      size = 18_000;
    } else {
      size = quality >= 0.86 ? 132_000 : 112_000;
    }
    callback(new Blob([new Uint8Array(size)], { type }));
  }
}

globalThis.document = { createElement: (tag) => {
  assert.equal(tag, 'canvas');
  return new MockCanvas();
} };
globalThis.createImageBitmap = async () => ({
  width: bitmapDimensions.width,
  height: bitmapDimensions.height,
  close() {},
});
URL.createObjectURL = () => 'blob:equipment-image-preview';
URL.revokeObjectURL = (url) => revokedUrls.push(url);

try {
  const output = path.join(tempDir, 'equipmentImageUpload.cjs');
  await build({
    entryPoints: [path.join(root, 'src/lib/equipmentImageUpload.ts')],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  const require = createRequire(import.meta.url);
  const { prepareEquipmentImage, MAX_EQUIPMENT_IMAGE_BYTES } = require(output);
  const file = (type, size = 32_000) => ({ type, size });

  await assert.rejects(
    () => prepareEquipmentImage(file('image/svg+xml')),
    /somente PNG, JPEG ou WebP/,
  );
  await assert.rejects(
    () => prepareEquipmentImage(file('image/png', 0)),
    /arquivo de imagem está vazio/,
  );

  bitmapDimensions = { width: 5000, height: 4000 };
  await assert.rejects(
    () => prepareEquipmentImage(file('image/jpeg')),
    /16 milhões de pixels/,
  );

  bitmapDimensions = { width: 1200, height: 800 };
  encodeMode = 'webp';
  canvases = [];
  const preparedWebp = await prepareEquipmentImage(file('image/jpeg', 70_000));
  assert.equal(preparedWebp.mimeType, 'image/webp');
  assert.equal(preparedWebp.extension, 'webp');
  assert.equal(preparedWebp.width, 640);
  assert.equal(preparedWebp.height, 427);
  assert.equal(preparedWebp.originalBytes, 70_000);
  assert.equal(preparedWebp.blob.type, 'image/webp');
  assert.ok(preparedWebp.blob.size <= MAX_EQUIPMENT_IMAGE_BYTES);
  assert.ok(preparedWebp.previewUrl);
  assert.ok(canvases[0].draws.length === 1, 'desenhou sem preencher fundo opaco');

  encodeMode = 'png';
  const preparedPng = await prepareEquipmentImage(file('image/webp', 11_000));
  assert.equal(preparedPng.mimeType, 'image/png', 'usa o tipo real retornado pelo canvas');
  assert.equal(preparedPng.extension, 'png');
  assert.equal(preparedPng.blob.type, 'image/png');

  encodeMode = 'resize-until-limit';
  canvases = [];
  const preparedResized = await prepareEquipmentImage(file('image/png', 20_000));
  assert.ok(preparedResized.blob.size <= MAX_EQUIPMENT_IMAGE_BYTES);
  assert.ok(preparedResized.width < 640, 'reduz 15% quando os passos de qualidade não bastam');
  assert.ok(canvases.length >= 2);

  const managerSource = await readFile(path.join(root, 'src/components/EquipmentImageManager.tsx'), 'utf8');
  assert.match(managerSource, /select\(GROUP_COLUMNS\)/);
  assert.match(managerSource, /select\(IMAGE_COLUMNS\)/);
  assert.match(managerSource, /rpc\('is_equipment_image_editor'\)/);
  assert.match(managerSource, /signInWithOtp\(/);
  assert.match(managerSource, /getEditorLoginRedirect\(window\.location\.origin\)/);
  assert.match(managerSource, /shouldCreateUser: true/);
  assert.match(managerSource, /Salvar ilustração/);
  assert.match(managerSource, /Restaurar ilustração padrão/);
  assert.match(managerSource, /prepareEquipmentImage\(file\)/);

  console.log('OK: compressão browser mockada, limite de pixels/tamanho, fallback PNG, resize e contrato protegido do manager.');
} finally {
  globalThis.document = originalDocument;
  globalThis.createImageBitmap = originalCreateImageBitmap;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  revokedUrls = [];
  await rm(tempDir, { recursive: true, force: true });
}
