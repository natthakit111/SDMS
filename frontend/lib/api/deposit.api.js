import api from './axiosInstance';

export const depositAPI = {
  getAll: () => api.get('/deposits').then((r) => r.data),
  refund: (contractId, { refund_amount, note }) =>
    api.put(`/deposits/${contractId}/refund`, { refund_amount, note }).then((r) => r.data),
};