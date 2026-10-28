import React, { useEffect, useState, type ReactNode } from 'react';
import BootLogo from './BootLogo';
import { isMenuPrepared, prepareMenu } from './menuResources';

export default function MenuPreparation({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(isMenuPrepared);
  const [error, setError] = useState<string | null>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (ready) return;
    let mounted = true;

    // No minimum duration, fade or gameplay loading card on menu navigation.
    void prepareMenu().then(() => { if (mounted) setReady(true); }, cause => { if (mounted) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { mounted = false; };
  }, [ready, attempt]);
  return ready ? <>{children}</> : <BootLogo error={error !== null} errorDetail={error ?? undefined} onRetry={() => { setError(null); retry(value => value + 1); }} />;
}
