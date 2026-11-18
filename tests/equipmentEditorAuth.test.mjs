import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const temp = await mkdtemp(path.join(root, 'tests/.tmp-editor-auth-'));
try {
  await build({
    entryPoints: ['src/lib/equipmentEditorAuth.ts'],
    outfile: path.join(temp, 'equipmentEditorAuth.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const auth = await import(pathToFileURL(path.join(temp, 'equipmentEditorAuth.mjs')));
  const host = 'https://qcpnnyqzosnomvvytmfi.supabase.co/auth/v1/verify';

  assert.deepEqual(
    auth.parseCredential(`${host}?token=hash-from-email&type=magiclink&redirect_to=https%3A%2F%2Fapp.test%2F%3Feditor_login%3D1`),
    { kind: 'link', token_hash: 'hash-from-email', type: 'magiclink' },
  );
  assert.deepEqual(auth.parseCredential(`${host}?token_hash=hash-signup&type=signup`), { kind: 'link', token_hash: 'hash-signup', type: 'signup' });
  assert.deepEqual(auth.toVerifyOtpParams(auth.parseCredential('123456', 'code'), 'editor@example.test'), { email: 'editor@example.test', token: '123456', type: 'email' });
  assert.deepEqual(auth.toVerifyOtpParams(auth.parseCredential(`${host}?token_hash=h&type=email`)), { token_hash: 'h', type: 'email' });
  assert.equal(auth.parseCredential('12345'), null, 'código curto rejeitado');
  assert.equal(auth.parseCredential('123456789'), null, 'código longo rejeitado');
  assert.equal(auth.parseCredential('http://qcpnnyqzosnomvvytmfi.supabase.co/auth/v1/verify?token=h&type=email'), null, 'HTTP rejeitado');
  assert.equal(auth.parseCredential('https://evil.example/auth/v1/verify?token=h&type=email'), null, 'host arbitrário rejeitado');
  assert.equal(auth.parseCredential('http://localhost:3000/?access_token=secret#token_type=bearer'), null, 'callback localhost/access_token rejeitado');
  assert.equal(auth.parseCredential(`${host}?access_token=secret&token_hash=h&type=email`), null, 'access_token jamais aceito');
  assert.equal(auth.parseCredential(`${host}?token=h&type=recovery`), null, 'tipo não permitido rejeitado');
  assert.equal(auth.parseCredential(`${host}?token=h&token_hash=hh&type=email`), null, 'credencial ambígua rejeitada');

  const redirect = auth.getEditorLoginRedirect('http://localhost:3000');
  assert.equal(redirect, 'http://localhost:3000/?editor_login=1');
  assert.deepEqual(auth.parseAuthErrorFromHref('http://localhost:3000/?editor_login=1#error=access_denied&error_code=otp_expired&error_description=raw-secret'), { code: 'otp_expired', error: 'raw-secret' });
  assert.match(auth.friendlyEditorAuthError({ code: 'otp_expired', message: 'expired' }), /expirou|usado/i);
  assert.match(auth.friendlyEditorAuthError({ code: 'invalid_token' }), /já foi usado|mais válido/i);
  assert.doesNotMatch(auth.friendlyEditorAuthError({ code: 'otp_expired', message: 'token=secret' }), /secret/);
  console.log('OK auth helper: links restritos, códigos, payloads verifyOtp, redirect sem hash e erros amigáveis.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
