import WelcomeSplashView from '@modules/layout/components/welcome-splash/splash-view';

// Página dedicada del splash de bienvenida (mobile), en su propio route group
// `(splash)` para no heredar el layout del home. El home decide server-side y
// redirige acá una vez por sesión; el splash devuelve a la home al cerrarse.
export const dynamic = 'force-dynamic';

export default function SplashPage() {
  return <WelcomeSplashView />;
}
