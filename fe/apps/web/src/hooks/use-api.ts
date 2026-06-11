"use client";

import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { AxiosError, AxiosRequestConfig } from "axios";

import { apiClient } from "@/lib/api/api-client";

type HttpMethod = "post" | "put" | "patch" | "delete";

export const useApi = () => ({
  get: async <TData>(url: string, config?: AxiosRequestConfig) => {
    const response = await apiClient.get<TData>(url, config);
    return response.data;
  },
  post: async <TData, TVariables = unknown>(
    url: string,
    payload?: TVariables,
    config?: AxiosRequestConfig,
  ) => {
    const response = await apiClient.post<TData>(url, payload, config);
    return response.data;
  },
  put: async <TData, TVariables = unknown>(
    url: string,
    payload?: TVariables,
    config?: AxiosRequestConfig,
  ) => {
    const response = await apiClient.put<TData>(url, payload, config);
    return response.data;
  },
  patch: async <TData, TVariables = unknown>(
    url: string,
    payload?: TVariables,
    config?: AxiosRequestConfig,
  ) => {
    const response = await apiClient.patch<TData>(url, payload, config);
    return response.data;
  },
  delete: async <TData>(url: string, config?: AxiosRequestConfig) => {
    const response = await apiClient.delete<TData>(url, config);
    return response.data;
  },
});

export const useApiQuery = <TData>(
  queryKey: QueryKey,
  url: string,
  config?: AxiosRequestConfig,
  options?: Omit<UseQueryOptions<TData, AxiosError>, "queryKey" | "queryFn">,
) =>
  useQuery<TData, AxiosError>({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<TData>(url, config);
      return response.data;
    },
    ...options,
  });

export const useApiMutation = <TData, TVariables = unknown>(
  url: string,
  method: HttpMethod = "post",
  options?: UseMutationOptions<TData, AxiosError, TVariables>,
) =>
  useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (payload: TVariables) => {
      const response = await apiClient.request<TData>({
        url,
        method,
        data: payload,
      });
      return response.data;
    },
    ...options,
  });
