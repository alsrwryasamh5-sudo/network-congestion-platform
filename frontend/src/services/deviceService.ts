import { apiGet, apiPost, apiPatch, apiDelete } from './api';

export const deviceService = {
  list: () => apiGet('/devices'),
  overview: () => apiGet('/devices/overview'),
  get: (id: number) => apiGet(`/devices/${id}`),
  create: (data: any) => apiPost('/devices', data),
  update: (id: number, data: any) => apiPatch(`/devices/${id}`, data),
  delete: (id: number) => apiDelete(`/devices/${id}`),
  metrics: (id: number) => apiGet(`/devices/${id}/metrics`),
  alerts: (deviceId?: number) => apiGet(`/devices/alerts${deviceId ? `?device_id=${deviceId}` : ''}`),
  resolveAlert: (alertId: number) => apiPost(`/devices/alerts/${alertId}/resolve`),
};
