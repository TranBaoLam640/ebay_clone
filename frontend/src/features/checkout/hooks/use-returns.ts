import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { returnApi, type CreateReturnInput } from '../services/return-api';

/** Buyer's return requests + a create mutation. */
export function useReturns() {
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ['returns'], queryFn: returnApi.list });

  const create = useMutation({
    mutationFn: (input: CreateReturnInput) => returnApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['returns'] }),
  });

  return { list, create };
}
