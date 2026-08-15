import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addressApi, type AddressInput } from '../services/address-api';

const KEY = ['addresses'] as const;

export function useAddresses() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const list = useQuery({ queryKey: KEY, queryFn: () => addressApi.list() });

  const create = useMutation({
    mutationFn: (data: AddressInput) => addressApi.create(data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AddressInput> }) =>
      addressApi.update(id, data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => addressApi.remove(id),
    onSuccess: invalidate,
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => addressApi.setDefault(id),
    onSuccess: invalidate,
  });

  return { list, create, update, remove, setDefault };
}
