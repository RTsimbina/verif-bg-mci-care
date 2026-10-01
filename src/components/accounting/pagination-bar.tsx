"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  /** Libellé pour les éléments (ex: "entités", "transferts") */
  itemLabel?: string;
}

/**
 * Barre de pagination complète :
 *  - Boutons Précédent / Suivant
 *  - Numéros de page avec ellipsis pour les grandes plages
 *  - Sélecteur de taille de page (10 / 25 / 50 / 100)
 *  - Compteur "Affichage de X à Y sur Z"
 */
export function PaginationBar({
  page,
  pageSize,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "éléments",
}: PaginationBarProps) {
  if (totalItems === 0) return null;

  // Calcul des numéros de page à afficher (avec ellipsis)
  const pages = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Compteur + sélecteur de taille */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span>
          Affichage de <strong className="tabular-nums">{rangeStart}</strong> à{" "}
          <strong className="tabular-nums">{rangeEnd}</strong> sur{" "}
          <strong className="tabular-nums">{totalItems}</strong> {itemLabel}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">|</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[90px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)} className="text-xs">
                  {opt} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pagination */}
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
              className={page <= 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
            />
          </PaginationItem>

          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                  className="cursor-pointer tabular-nums"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
              className={page >= totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

/**
 * Génère la liste des numéros de page à afficher, en insérant des
 * "ellipsis" quand il y a trop de pages.
 *
 * Exemple pour page=1, totalPages=10 : [1, 2, "ellipsis", 9, 10]
 * Exemple pour page=5, totalPages=10 : [1, "ellipsis", 4, 5, 6, "ellipsis", 10]
 */
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  // Toujours afficher la 1ère page
  pages.push(1);

  if (current > 4) {
    pages.push("ellipsis");
  }

  // Pages autour de la page courante
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 3) {
    pages.push("ellipsis");
  }

  // Toujours afficher la dernière page
  pages.push(total);

  return pages;
}
