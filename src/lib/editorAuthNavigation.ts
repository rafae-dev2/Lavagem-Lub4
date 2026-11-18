export function isEquipmentEditorReturn(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.searchParams.get('editor_login') === '1') return true;
    const hash = new URLSearchParams(url.hash.slice(1));
    return Boolean(
      (hash.has('access_token') && hash.has('token_type')) ||
      (hash.has('error') && hash.has('error_code')),
    );
  } catch {
    return false;
  }
}

// Only identifies routing intent; never stores or logs URL credentials.
