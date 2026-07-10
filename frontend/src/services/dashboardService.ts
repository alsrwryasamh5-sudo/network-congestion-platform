import { apiGet } from './api';

export const dashboardService = {
  overview: () => apiGet('/dashboard/overview'),
  networkHealth: () => apiGet('/dashboard/network-health'),
  systemLoad: () => apiGet('/dashboard/system-load'),
  congestionTimeline: (hours = 24) =>
    apiGet(`/dashboard/congestion-timeline?hours=${hours}`),
  recentPredictions: (limit = 10) =>
    apiGet(`/dashboard/recent-predictions?limit=${limit}`),
  apiStats: () => apiGet('/dashboard/api-stats'),
  intelligence: () => apiGet('/dashboard/intelligence'),
  live: () => apiGet('/dashboard/live'),
};
