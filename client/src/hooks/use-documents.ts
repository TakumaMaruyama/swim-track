import useSWR from "swr";
import type { Document } from "db/schema";

export function useDocuments() {
  const { data: documents, error, mutate } = useSWR<Document[]>("/api/documents");

  return {
    documents,
    isLoading: !error && !documents,
    error,
    mutate
  };
}
