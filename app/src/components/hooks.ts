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

/** Acción (POST/PATCH/…) que muestra el error y refresca lo necesario al terminar. */
export function useAction<A, R = unknown>(
  fn: (arg: A) => Promise<R>,
  opts?: { invalidate?: QueryKey[]; onSuccess?: (r: R) => void; successMessage?: string },
) {
  const qc = useQueryClient();
  return useMutation<R, Error, A>({
    mutationFn: fn,
    onSuccess: (r) => {
      // Por defecto refresca todo lo que esté en pantalla (la app es pequeña y así nunca queda desactualizada)
      if (opts?.invalidate) opts.invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      else qc.invalidateQueries();
      if (opts?.successMessage) notify(opts.successMessage);
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
