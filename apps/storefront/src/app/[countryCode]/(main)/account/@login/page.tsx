import LoginTemplate from "@modules/account/templates/login-template";

function safeReturnTo(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;
  try {
    const parsed = new URL(value, 'https://mercatto.invalid');
    return parsed.origin === 'https://mercatto.invalid' ? `${parsed.pathname}${parsed.search}${parsed.hash}` : undefined;
  } catch { return undefined; }
}

export default async function Login({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const query = await searchParams;
  return <LoginTemplate redirectTo={safeReturnTo(query.returnTo)} />;
}
