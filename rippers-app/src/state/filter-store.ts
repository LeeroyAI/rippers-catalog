"use client";

import { useMemo, useState } from "react";

import { applyFilters } from "@/src/domain/filter-engine";
import { catalog } from "@/src/data/catalog";
import { defaultFilters } from "@/src/domain/types";
import type { FilterState } from "@/src/domain/types";

export function useFilterStore() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const filteredBikes = useMemo(() => applyFilters(catalog, filters), [filters]);

  function updateFilters(next: Partial<FilterState>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function resetFilters() {
    setFilters(defaultFilters);
  }

  return {
    filters,
    filteredBikes,
    updateFilters,
    resetFilters,
  };
}
