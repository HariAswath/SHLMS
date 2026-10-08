import { useCallback, useEffect, useRef, useState } from "react";

// Loads data on mount (and when deps change). `reload()` refetches without flashing the spinner.
export function useLoad(fn, deps = [], { pollMs } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (silent) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((s) => ({ data: silent ? s.data : null, error: silent ? s.error : error, loading: false }));
    }
  }, []);

  useEffect(() => {
    run(false);
    if (!pollMs) return undefined;
    const t = setInterval(() => run(true), pollMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: () => run(true), retry: () => run(false) };
}
