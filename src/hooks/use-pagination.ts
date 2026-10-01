"use client";

import { useState, useMemo, useCallback } from "react";

/**
 * Hook de pagination réutilisable.
 *
 * @param items tableau complet à paginer
 * @param initialPageSize taille de page par défaut (default: 10)
 * @returns { page, pageSize, totalPages, totalItems, paginatedItems, setPage, setPageSize, rangeStart, rangeEnd }
 */
export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Page effective clampée entre 1 et totalPages (sans setState dans un effet)
  const effectivePage = Math.min(Math.max(1, page), totalPages);

  const paginatedItems = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    const end = start + pageSize;
    return items.slice(start, end);
  }, [items, effectivePage, pageSize]);

  const rangeStart = totalItems === 0 ? 0 : (effectivePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(effectivePage * pageSize, totalItems);

  // Wrapper setPageSize qui remet à la page 1 pour éviter les pages vides
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  // Wrapper setPage qui clamp directement
  const safeSetPage = useCallback(
    (p: number) => {
      setPage(Math.min(Math.max(1, p), Math.max(1, Math.ceil(items.length / pageSize))));
    },
    [items.length, pageSize]
  );

  return {
    page: effectivePage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    setPage: safeSetPage,
    setPageSize,
    goToFirst: () => safeSetPage(1),
    goToLast: () => safeSetPage(totalPages),
    rangeStart,
    rangeEnd,
  };
}
