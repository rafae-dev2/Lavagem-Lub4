const root = globalThis as any;
const state = root.__equipmentEditorAuthMock = {
  groups: [{ id: 'grupo-auth', nome: 'Grupo Auth', cor: '#146B45' }],
  images: [],
  permission: false,
  mode: 'success',
  session: null as any,
  sendPayload: null as any,
  verifyPayloads: [] as any[],
};
const callbacks: ((event: string, session: any) => void)[] = [];
function response(data: any = null, error: any = null) { return { data, error }; }
function query(table: string) {
  const q: any = {
    select: () => q, order: () => q, limit: () => q, abortSignal: () => q,
    then: (resolve: any, reject: any) => Promise.resolve().then(() => {
      const rows = table === 'apoio_grupos' ? state.groups : state.images;
      return response(rows);
    }).then(resolve, reject),
  };
  return q;
}
const editorSession = { user: { id: 'editor-auth', email: 'editor@example.test' }, access_token: 'access-token-only-in-mock' };
export const apoioClient: any = {
  from: query,
  rpc: () => {
    const q: any = { abortSignal: () => q, then: (resolve: any, reject: any) => Promise.resolve(response(state.permission)).then(resolve, reject) };
    return q;
  },
  auth: {
    getSession: () => Promise.resolve(response({ session: state.session })),
    onAuthStateChange: (callback: any) => { callbacks.push(callback); return { data: { subscription: { unsubscribe() {} } } }; },
    signInWithOtp: async (payload: any) => { state.sendPayload = payload; return response(); },
    verifyOtp: async (payload: any) => {
      state.verifyPayloads.push(payload);
      if (state.mode === 'invalid') return response(null, { code: 'invalid_token', message: 'invalid token' });
      if (state.mode === 'expired') return response(null, { code: 'otp_expired', message: 'OTP expired' });
      state.session = editorSession;
      callbacks.forEach((callback) => callback('SIGNED_IN', editorSession));
      return response({ session: editorSession, user: editorSession.user });
    },
    signOut: () => Promise.resolve(response()),
  },
  storage: { from: () => ({
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://qcpnnyqzosnomvvytmfi.supabase.co/storage/v1/object/public/equipment-group-images/${path}` } }),
  }) },
};
