import { apiMutate } from './api-client';

export interface UploadResult {
  url: string;
  key: string;
}

/** Upload a single image file to object storage via the backend. */
async function uploadImage(path: string, file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  // axios sets the multipart Content-Type (with boundary) from the FormData.
  return apiMutate<UploadResult>('post', path, form);
}

export const uploadApi = {
  avatar: (file: File) => uploadImage('/uploads/avatar', file),
  productImage: (file: File) => uploadImage('/uploads/product-image', file),
};
