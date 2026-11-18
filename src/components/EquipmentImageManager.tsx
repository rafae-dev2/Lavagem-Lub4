import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import EquipmentThumbnail from './EquipmentThumbnail';
import { apoioClient } from '../lib/apoioService';
import {
  EQUIPMENT_IMAGE_PREVIEW_NOTE,
  EQUIPMENT_IMAGE_TABLE,
  getEquipmentGroupImagePublicUrl,
  prepareEquipmentImage,
  restoreEquipmentGroupImage,
  saveEquipmentGroupImage,
  type EquipmentGroupImageMetadata,
  type PreparedEquipmentImage,
} from '../lib/equipmentImageUpload';
import {
  friendlyEditorAuthError,
  getEditorLoginRedirect,
  parseAuthErrorFromHref,
  parseCredential,
  toVerifyOtpParams,
  type EditorCredentialMode,
} from '../lib/equipmentEditorAuth';
import '../styles/equipment-image-manager.css';

interface EquipmentGroup {
  id: string;
  nome: string;
  cor: string;
}

type ManagerStatus = { kind: 'success' | 'error' | 'warning' | 'info'; text: string } | null;

type QueryError = { message?: string; details?: string; hint?: string } | null | undefined;

export interface EquipmentImageManagerProps {
  className?: string;
}

const GROUP_COLUMNS = 'id,nome,cor';
const IMAGE_COLUMNS = 'group_id,object_path,mime_type,bytes,width,height,updated_at';
const REQUEST_TIMEOUT_MS = 15_000;
const MAGIC_LINK_THROTTLE_MS = 60_000;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message?: unknown }).message || 'erro desconhecido');
  return String(error || 'erro desconhecido');
}

function describeQueryError(error: QueryError): string {
  if (!error) return 'erro desconhecido';
  return [error.message, error.details, error.hint].filter(Boolean).join(' — ') || 'erro Supabase';
}

function withTimeout<T>(operation: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('A leitura excedeu 15 segundos.'));
    }, REQUEST_TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function loadPublicCatalog(): Promise<{ groups: EquipmentGroup[]; images: EquipmentGroupImageMetadata[] }> {
  const [groupsResult, imagesResult] = await Promise.all([
    withTimeout((signal) =>
      apoioClient
        .from('apoio_grupos')
        .select(GROUP_COLUMNS)
        .order('nome')
        .limit(500)
        .abortSignal(signal),
    ),
    withTimeout((signal) =>
      apoioClient
        .from(EQUIPMENT_IMAGE_TABLE)
        .select(IMAGE_COLUMNS)
        .order('group_id')
        .limit(500)
        .abortSignal(signal),
    ),
  ]) as [
    { data: EquipmentGroup[] | null; error: QueryError },
    { data: EquipmentGroupImageMetadata[] | null; error: QueryError },
  ];

  if (groupsResult.error) throw new Error(`Grupos: ${describeQueryError(groupsResult.error)}`);
  if (imagesResult.error) throw new Error(`Imagens: ${describeQueryError(imagesResult.error)}`);
  return { groups: groupsResult.data || [], images: imagesResult.data || [] };
}

async function checkEditorPermission(): Promise<boolean> {
  const result = await withTimeout((signal) => apoioClient.rpc('is_equipment_image_editor').abortSignal(signal)) as {
    data: unknown;
    error: QueryError;
  };
  if (result.error) throw new Error(describeQueryError(result.error));
  return result.data === true;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function revokePreview(prepared: PreparedEquipmentImage | null): void {
  if (
    prepared?.previewUrl &&
    typeof URL !== 'undefined' &&
    typeof URL.revokeObjectURL === 'function'
  ) {
    URL.revokeObjectURL(prepared.previewUrl);
  }
}

export default function EquipmentImageManager({ className = '' }: EquipmentImageManagerProps) {
  const [groups, setGroups] = useState<EquipmentGroup[]>([]);
  const [images, setImages] = useState<EquipmentGroupImageMetadata[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedEquipmentImage | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState<ManagerStatus>(null);
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkCooldownUntil, setLinkCooldownUntil] = useState(0);
  const [credentialMode, setCredentialMode] = useState<EditorCredentialMode>('auto');
  const [credential, setCredential] = useState('');
  const [verifyingCredential, setVerifyingCredential] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const preparedRef = useRef<PreparedEquipmentImage | null>(null);
  const preparationToken = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const permissionRequestRef = useRef(0);

  const linkCooldownActive = linkCooldownUntil > Date.now();
  const linkCooldownSeconds = Math.max(0, Math.ceil((linkCooldownUntil - Date.now()) / 1000));

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );
  const currentMetadata = useMemo(
    () => images.find((image) => image.group_id === selectedGroupId) || null,
    [images, selectedGroupId],
  );
  const currentUrl = useMemo(
    () => (currentMetadata ? getEquipmentGroupImagePublicUrl(currentMetadata.object_path) : null),
    [currentMetadata],
  );

  const commitPrepared = useCallback((next: PreparedEquipmentImage | null) => {
    revokePreview(preparedRef.current);
    preparedRef.current = next;
    setPrepared(next);
  }, []);

  const clearPrepared = useCallback(() => {
    preparationToken.current += 1;
    setPreparing(false);
    commitPrepared(null);
    setFileName(null);
    setPreparing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [commitPrepared]);

  const refreshCatalog = useCallback(async () => {
    if (!mountedRef.current) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const catalog = await loadPublicCatalog();
      if (!mountedRef.current) return;
      setGroups(catalog.groups);
      setImages(catalog.images);
      setSelectedGroupId((current) =>
        catalog.groups.some((group) => group.id === current) ? current : catalog.groups[0]?.id || '',
      );
    } catch (error) {
      if (mountedRef.current) setCatalogError(`Não foi possível carregar os grupos e imagens: ${errorMessage(error)}`);
    } finally {
      if (mountedRef.current) setCatalogLoading(false);
    }
  }, []);

  const refreshPermission = useCallback(async () => {
    const requestId = ++permissionRequestRef.current;
    try {
      const allowed = await checkEditorPermission();
      if (!mountedRef.current || requestId !== permissionRequestRef.current) return allowed;
      setCanEdit(allowed);
      setPermissionError(null);
      return allowed;
    } catch (error) {
      if (mountedRef.current && requestId === permissionRequestRef.current) {
        setCanEdit(false);
        setPermissionError(`Edição protegida indisponível: ${errorMessage(error)}`);
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshCatalog();

    // O App pode encaminhar a rota, mas o hash de erro precisa ser lido aqui
    // antes que o SDK emita notificações e limpe a URL.
    const initialAuthError = typeof window !== 'undefined' ? parseAuthErrorFromHref(window.location.href) : null;
    if (initialAuthError) setAuthMessage(friendlyEditorAuthError(initialAuthError));

    const { data } = apoioClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!mountedRef.current) return;
      setSession(nextSession);
      setEmail((current) => current || nextSession?.user.email || '');
      // Não aguarda RPC dentro do callback do Supabase Auth.
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        void refreshPermission().catch(() => {});
      }, 0);
    });

    void (async () => {
      try {
        const sessionResult = await withTimeout(() => apoioClient.auth.getSession()) as {
          data: { session: Session | null };
          error: QueryError;
        };
        if (sessionResult.error) throw new Error(describeQueryError(sessionResult.error));
        if (!mountedRef.current) return;
        setSession(sessionResult.data.session);
        setEmail((current) => current || sessionResult.data.session?.user.email || '');
        await refreshPermission();
      } catch (error) {
        if (!mountedRef.current) return;
        setCanEdit(false);
        setPermissionError(`Edição protegida indisponível: ${errorMessage(error)}`);
      }
    })();

    return () => {
      mountedRef.current = false;
      permissionRequestRef.current += 1;
      preparationToken.current += 1;
      revokePreview(preparedRef.current);
      preparedRef.current = null;
      data.subscription.unsubscribe();
    };
  }, [refreshCatalog, refreshPermission]);

  useEffect(() => {
    if (!linkCooldownUntil) return undefined;
    const timer = window.setInterval(() => {
      setLinkCooldownUntil((current) => (Date.now() >= current ? 0 : current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [linkCooldownUntil]);

  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    clearPrepared();
    setStatus(null);
    setSelectedGroupId(event.target.value);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    const token = ++preparationToken.current;
    commitPrepared(null);
    setFileName(file?.name || null);
    setStatus(null);
    if (!file) return;

    setPreparing(true);
    try {
      const next = await prepareEquipmentImage(file);
      if (token !== preparationToken.current || !mountedRef.current) {
        revokePreview(next);
        return;
      }
      preparedRef.current = next;
      setPrepared(next);
    } catch (error) {
      if (token === preparationToken.current && mountedRef.current) {
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setStatus({ kind: 'error', text: errorMessage(error) });
      }
    } finally {
      if (token === preparationToken.current && mountedRef.current) setPreparing(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit || !selectedGroup || !prepared || saving || restoring) return;
    setSaving(true);
    setStatus(null);
    try {
      await saveEquipmentGroupImage(selectedGroup.id, prepared, currentMetadata?.object_path);
      await refreshCatalog();
      clearPrepared();
      setStatus({ kind: 'success', text: `Ilustração de ${selectedGroup.nome} salva com sucesso.` });
    } catch (error) {
      setStatus({ kind: 'error', text: `Não foi possível salvar a ilustração: ${errorMessage(error)}` });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!canEdit || !selectedGroup || !currentMetadata || saving || restoring) return;
    if (!window.confirm(`Restaurar a ilustração padrão de “${selectedGroup.nome}”?`)) return;

    setRestoring(true);
    setStatus(null);
    try {
      await restoreEquipmentGroupImage(selectedGroup.id, currentMetadata.object_path);
      await refreshCatalog();
      clearPrepared();
      setStatus({ kind: 'success', text: 'Ilustração padrão restaurada.' });
    } catch (error) {
      // A leitura após erro mantém a tela alinhada ao metadata real, inclusive se
      // a remoção do objeto antigo tiver falhado e deixado um órfão.
      await refreshCatalog();
      setStatus({ kind: 'warning', text: errorMessage(error) });
    } finally {
      if (mountedRef.current) setRestoring(false);
    }
  };

  const handleMagicLink = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@') || sendingLink) return;
    if (linkCooldownActive) {
      setAuthMessage('Um link já foi solicitado. Use somente o link mais recente ou aguarde antes de pedir outro.');
      return;
    }
    setSendingLink(true);
    setAuthMessage(null);
    try {
      const { error } = await apoioClient.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getEditorLoginRedirect(window.location.origin),
          shouldCreateUser: true,
        },
      });
      if (error) throw new Error(error.message);
      setLinkCooldownUntil(Date.now() + MAGIC_LINK_THROTTLE_MS);
      setAuthMessage('Link enviado. Abra o e-mail autorizado, copie o endereço original do botão e confirme aqui.');
    } catch (error) {
      setAuthMessage(`Não foi possível enviar o link: ${friendlyEditorAuthError(error)}`);
    } finally {
      if (mountedRef.current) setSendingLink(false);
    }
  };

  const handleVerifyCredential = async () => {
    if (verifyingCredential || !credential.trim()) return;
    const parsed = parseCredential(credential, credentialMode);
    if (!parsed) {
      setAuthMessage(
        credentialMode === 'code'
          ? 'Informe o código de 6 a 8 dígitos que veio no e-mail.'
          : 'Cole o endereço original do e-mail, no formato seguro do Supabase; não use a URL localhost aberta após o clique.',
      );
      return;
    }

    let params;
    try {
      params = toVerifyOtpParams(parsed, email);
    } catch (error) {
      setAuthMessage(errorMessage(error));
      return;
    }

    setVerifyingCredential(true);
    setAuthMessage(null);
    try {
      const result = await apoioClient.auth.verifyOtp(params);
      if (result.error) throw result.error;
      setCredential('');
      if (result.data?.session) setSession(result.data.session);

      const allowed = await refreshPermission();
      if (mountedRef.current) {
        setAuthMessage(
          allowed
            ? 'Acesso confirmado. A edição protegida está disponível.'
            : 'Acesso confirmado, mas este e-mail não está autorizado para editar imagens.',
        );
      }
    } catch (error) {
      if (mountedRef.current) {
        setCanEdit(false);
        setAuthMessage(friendlyEditorAuthError(error));
      }
    } finally {
      if (mountedRef.current) setVerifyingCredential(false);
    }
  };

  const rootClassName = ['equipment-image-manager', className].filter(Boolean).join(' ');
  const previewAlt = selectedGroup ? `Ilustração de ${selectedGroup.nome}` : 'Ilustração do grupo';

  return (
    <section className={rootClassName} aria-labelledby="equipment-image-manager-title">
      <header className="equipment-image-manager__header">
        <div>
          <p className="equipment-image-manager__eyebrow">Catálogo visual</p>
          <h2 id="equipment-image-manager-title">Ilustrações por grupo de equipamento</h2>
          <p className="equipment-image-manager__intro">
            A leitura é pública. A substituição fica disponível somente para e-mails autorizados pela lista de administradores autorizados.
          </p>
        </div>
        <span className={`equipment-image-manager__role ${canEdit ? 'is-editor' : 'is-viewer'}`}>
          {canEdit ? 'editor autorizado' : 'somente leitura'}
        </span>
      </header>

      {catalogError && <div className="equipment-image-manager__notice is-error" role="alert">{catalogError}</div>}
      {permissionError && <div className="equipment-image-manager__notice is-warning" role="status">{permissionError}</div>}
      {status && <div className={`equipment-image-manager__notice is-${status.kind}`} role="status">{status.text}</div>}

      {catalogLoading ? (
        <p className="equipment-image-manager__loading">Carregando grupos e imagens…</p>
      ) : groups.length === 0 ? (
        <div className="equipment-image-manager__empty">Nenhum grupo de equipamento foi encontrado.</div>
      ) : (
        <>
          <div className="equipment-image-manager__selector">
            <label htmlFor="equipment-image-group">Grupo de equipamento</label>
            <select id="equipment-image-group" value={selectedGroupId} onChange={handleGroupChange} disabled={saving || restoring}>
              {groups.map((group) => (
                <option value={group.id} key={group.id}>{group.nome}</option>
              ))}
            </select>
            {selectedGroup && <span className="equipment-image-manager__group-dot" style={{ backgroundColor: selectedGroup.cor }} aria-hidden="true" />}
          </div>

          <div className="equipment-image-manager__workspace">
            <div className="equipment-image-manager__preview-card">
              <div className="equipment-image-manager__checker">
                {prepared?.previewUrl ? (
                  <img src={prepared.previewUrl} alt={previewAlt} className="equipment-image-manager__preview" />
                ) : currentUrl ? (
                  <img src={currentUrl} alt={previewAlt} className="equipment-image-manager__preview" />
                ) : selectedGroup ? (
                  <EquipmentThumbnail equipment={{ groupId: selectedGroup.id, apoio: selectedGroup.nome }} size="hero" className="equipment-image-manager__default" />
                ) : null}
              </div>
              <div className="equipment-image-manager__preview-caption">
                <strong>{prepared ? 'Prévia comprimida' : currentMetadata ? 'Ilustração personalizada' : 'Ilustração padrão'}</strong>
                {prepared && (
                  <span>{formatBytes(prepared.originalBytes)} → {formatBytes(prepared.blob.size)} · {prepared.width} × {prepared.height}px</span>
                )}
                {!prepared && currentMetadata && (
                  <span>{formatBytes(currentMetadata.bytes)} · {currentMetadata.width} × {currentMetadata.height}px</span>
                )}
              </div>
            </div>

            <div className="equipment-image-manager__form">
              {canEdit ? (
                <fieldset disabled={saving || restoring}>
                  <legend>Substituir ilustração</legend>
                  <label className="equipment-image-manager__file-label" htmlFor="equipment-image-file">
                    <span>{preparing ? 'Preparando imagem…' : 'Escolher PNG, JPEG ou WebP'}</span>
                    <input
                      ref={fileInputRef}
                      id="equipment-image-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      disabled={preparing || saving || restoring}
                    />
                  </label>
                  {fileName && <p className="equipment-image-manager__filename">{fileName}</p>}
                  {prepared && (
                    <p className="equipment-image-manager__metrics">
                      Arquivo que será enviado: <strong>{formatBytes(prepared.blob.size)}</strong> · {prepared.mimeType} · {prepared.width} × {prepared.height}px
                    </p>
                  )}
                  <p className="equipment-image-manager__hint">{EQUIPMENT_IMAGE_PREVIEW_NOTE}</p>
                  <div className="equipment-image-manager__actions">
                    <button type="button" className="equipment-image-manager__button is-primary" onClick={handleSave} disabled={!prepared || preparing || saving || restoring}>
                      {saving ? 'Salvando…' : 'Salvar ilustração'}
                    </button>
                    <button type="button" className="equipment-image-manager__button is-quiet" onClick={clearPrepared} disabled={!prepared || preparing || saving || restoring}>
                      Cancelar
                    </button>
                    {currentMetadata && (
                      <button type="button" className="equipment-image-manager__button is-danger" onClick={handleRestore} disabled={saving || restoring}>
                        {restoring ? 'Restaurando…' : 'Restaurar ilustração padrão'}
                      </button>
                    )}
                  </div>
                </fieldset>
              ) : (
                <div className="equipment-image-manager__readonly">
                  <strong>Área protegida</strong>
                  <p>Faça login com um e-mail autorizado para substituir ou restaurar a ilustração. A visualização continua disponível sem login.</p>
                  {session && <p className="equipment-image-manager__session">Sessão atual: {session.user.email || 'e-mail não informado'}</p>}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!canEdit && (
        <div className="equipment-image-manager__login">
          <div className="equipment-image-manager__login-copy">
            <h3>Acesso de editor</h3>
            <p>Informe o e-mail de um administrador autorizado. O e-mail só será enviado depois que você clicar no botão.</p>
          </div>
          <div className="equipment-image-manager__login-request">
            <div className="equipment-image-manager__login-row">
              <label htmlFor="equipment-image-editor-email">E-mail autorizado</label>
              <input
                id="equipment-image-editor-email"
                type="email"
                value={email || session?.user.email || ''}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com"
                autoComplete="email"
              />
              <button type="button" className="equipment-image-manager__button is-primary" onClick={handleMagicLink} disabled={sendingLink || linkCooldownActive || !email.includes('@')}>
                {sendingLink ? 'Enviando…' : linkCooldownActive ? `Aguarde ${linkCooldownSeconds}s` : 'Enviar link de acesso'}
              </button>
            </div>
            {linkCooldownActive && <p className="equipment-image-manager__throttle">Solicite no máximo um novo link por vez e use somente o e-mail mais recente.</p>}
          </div>
          <div className="equipment-image-manager__confirmation">
            <div>
              <h4>Confirme dentro do app</h4>
              <p>Antes de clicar no e-mail, copie o endereço original do botão. Não cole a URL localhost que aparece depois do clique.</p>
            </div>
            <div className="equipment-image-manager__confirmation-row">
              <label htmlFor="equipment-image-editor-credential">Tipo</label>
              <select
                id="equipment-image-editor-credential-type"
                value={credentialMode}
                onChange={(event) => setCredentialMode(event.target.value as EditorCredentialMode)}
                disabled={verifyingCredential}
              >
                <option value="auto">Link ou código</option>
                <option value="link">Link original</option>
                <option value="code">Código de 6–8 dígitos</option>
              </select>
              <input
                id="equipment-image-editor-credential"
                type="password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                placeholder="Cole o link original ou o código"
                autoComplete="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                disabled={verifyingCredential}
              />
              <button type="button" className="equipment-image-manager__button is-primary" onClick={handleVerifyCredential} disabled={verifyingCredential || !credential.trim()}>
                {verifyingCredential ? 'Confirmando…' : 'Confirmar acesso'}
              </button>
            </div>
            <p className="equipment-image-manager__secret-note">O segredo é usado somente nesta confirmação, não é salvo nem enviado para outro endereço.</p>
          </div>
          {authMessage && <p className="equipment-image-manager__auth-message" role="status">{authMessage}</p>}
        </div>
      )}
    </section>
  );
}
