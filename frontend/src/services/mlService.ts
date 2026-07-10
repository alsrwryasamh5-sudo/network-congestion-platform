import { apiGet, apiPost } from './api';

export interface PredictionResult {
  prediction_id?: number;
  predicted_label: number;
  predicted_probability: number;
  confidence: number;
  is_congested: boolean;
  congestion_score?: number;
  inference_time_ms?: number;
}

export interface ShapResult {
  available: boolean;
  values: Record<string, number>;
  top_features: Array<{
    feature: string;
    shap_value: number;
    value: number;
    contribution_pct: number;
  }>;
}

export interface RcaResult {
  host_responsible: string;
  source_ip: string | null;
  destination_ip: string | null;
  protocol: any;
  cluster_id: number;
  volume_contribution: number;
  qos_impact_score: number;
  ai_support_score: number;
  spatial_penalty: number;
  total_rca_score: number;
  severity: string;
  recommended_mitigation: string;
  congestion_cause: string;
  evidence: Record<string, any>;
  confidence: number;
}

export const mlService = {
  modelInfo: () => apiGet('/ml/model-info'),

  predict: (flow: Record<string, any>) => apiPost('/ml/predict', { flow }),

  predictBatch: (flows: any[]) => apiPost('/ml/predict-batch', { flows }),

  shap: (flow: Record<string, any>, topK = 10) =>
    apiPost('/ml/shap', { flow, top_k: topK }),

  rootCause: (flow: Record<string, any>, predictedLabel = 1, clusterId = 0) =>
    apiPost('/ml/root-cause', { flow, predicted_label: predictedLabel, cluster_id: clusterId }),

  fullInference: (flow: Record<string, any>, clusterId = 0) =>
    apiPost('/ml/full-inference', { flow, cluster_id: clusterId }),

  evaluate: () => apiGet('/ml/evaluate'),

  train: (payload: { synthetic?: boolean; n_samples?: number; dataset_id?: number; csv_path?: string; experiment_name?: string }) =>
    apiPost('/ml/train', payload),

  featureImportance: () => apiGet('/ml/feature-importance'),

  clustering: (hosts: any[]) => apiPost('/ml/clustering', { hosts }),

  history: (page = 1, perPage = 20) =>
    apiGet(`/ml/history?page=${page}&per_page=${perPage}`),
};
