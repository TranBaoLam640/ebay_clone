import { apiGet } from '@/services/api-client';

export interface SellerProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  description: string;
  averageFeedbackRating: number;
  feedbackCount: number;
}

export const sellerApi = {
  profile: (id: string) => apiGet<SellerProfile>(`/sellers/${id}`),
};
