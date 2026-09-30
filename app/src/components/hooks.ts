import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Catalogs } from '@/lib/types';
import { notify } from './ui';

/** GET con caché. La clave es la ruta + parámetros. */
export function useApi<T>(path: string | null, query?: Record<string, any>, opts?: { refetchInterval?: number }) {
  return useQuery<T>({
    queryKey: [path, query ?? {}],
    queryFn: () => api.get<T>(path!, query),
    enabled: !!path,
    refetchInterval: opts?.refetchInterval,
  });
}

/** Texto fijo o calculado a partir del argumento y la respuesta de la acción. */
type Msg<A, R> = string | ((arg: A, r: R) => string | undefined);
const text = <A, R>(m: Msg<A, R> | undefined, arg: A, r: R) => (typeof m === 'function' ? m(arg, r) : m);

/** Acción (POST/PATCH/…) que avisa si salió bien o mal y refresca lo necesario al terminar. */
export function useAction<A, R = unknown>(
  fn: (arg: A) => Promise<R>,
  opts?: {
    invalidate?: QueryKey[];
    onSuccess?: (r: R) => void;
    /** Título del aviso verde de "completado", p. ej. "Problemática publicada" */
    successMessage?: Msg<A, R>;
    /** Explicación debajo del título, p. ej. "Los estudiantes ya pueden verla" */
    successDetail?: Msg<A, R>;
  },
) {
  const qc = useQueryClient();
  return useMutation<R, Error, A>({
    mutationFn: fn,
    onSuccess: (r, arg) => {
      // Por defecto refresca todo lo que esté en pantalla (la app es pequeña y así nunca queda desactualizada)
      if (opts?.invalidate) opts.invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      else qc.invalidateQueries();
      const title = text(opts?.successMessage, arg, r);
      if (title) notify(title, text(opts?.successDetail, arg, r));
      opts?.onSuccess?.(r);
    },
    onError: (e) => notify('No se pudo completar', e.message, 'error'),
  });
}

export const useCatalogs = () => useQuery<Catalogs>({
  queryKey: ['/catalogs'],
  queryFn: () => api.get<Catalogs>('/catalogs'),
  staleTime: Infinity,
});

/** Devuelve el valor después de que el usuario deja de escribir (buscar mientras se escribe sin saturar al servidor). */
export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
