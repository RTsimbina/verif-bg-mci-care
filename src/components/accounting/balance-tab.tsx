"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Scale,
  TrendingUp,
  TrendingDown,
  GitCompare,
} from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/accounting/pagination-bar";
import type { AnalysisResult, BalanceBrouillardComparison } from "@/lib/accounting/engine";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n || 0);

const fmtMGA = (n: number) => `${fmt(n)} MGA`;

interface Props {
  result: AnalysisResult;
}

type CoherenceFilter = "ALL" | "COHERENT" | "ECART";
type SortKey = "compte" | "ecart_abs";

export function BalanceTab({ result }: Props) {
  const { balance } = result;
  const [search, setSearch] = useState("");
  const [coherenceFilter, setCoherenceFilter] = useState<CoherenceFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("ecart_abs");

  const filteredComparison = useMemo(() => {
    let arr = balance.comparison.slice();
    if (coherenceFilter === "COHERENT") {
      arr = arr.filter((c) => c.isCoherent);
    } else if (coherenceFilter === "ECART") {
      arr = arr.filter((c) => !c.isCoherent);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (c) =>
          c.compte.toLowerCase().includes(q) ||
          c.intitule.toLowerCase().includes(q)
      );
    }
    arr.sort((a, b) => {
      if (sortKey === "compte") return a.compte.localeCompare(b.compte);
      // écart absolu décroissant
      return Math.abs(b.ecartSolde) - Math.abs(a.ecartSolde);
    });
    return arr;
  }, [balance.comparison, search, coherenceFilter, sortKey]);

  const pagination = usePagination(filteredComparison, 10);

  const ecartCount = balance.comparison.filter((c) => !c.isCoherent).length;
  const coherentCount = balance.comparison.length - ecartCount;

  return (
    <div className="space-y-6">
      {/* Bandeau équilibre de la balance */}
      <Card
        className={
          balance.isBalanced
            ? "border-emerald-200 bg-emerald-50/30"
            : "border-red-200 bg-red-50/30"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-slate-600" />
            Équilibre de la Balance des comptes
            {balance.periodeAu && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                (arrêtée au {new Date(balance.periodeAu).toLocaleDateString("fr-FR")})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Bloc 1 : Total bilan + gestion */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Comptes de bilan (classes 1-5)
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Débit</span>
                  <span className="tabular-nums font-semibold">
                    {fmtMGA(balance.totalBilanDebit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Crédit</span>
                  <span className="tabular-nums font-semibold">
                    {fmtMGA(balance.totalBilanCredit)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <span className="text-slate-600">Écart</span>
                  <span
                    className={`tabular-nums font-bold ${
                      Math.abs(balance.totalBilanDebit - balance.totalBilanCredit) < 1
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {fmt(balance.totalBilanDebit - balance.totalBilanCredit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bloc 2 : Comptes de gestion */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Comptes de gestion (classes 6-7)
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Débit</span>
                  <span className="tabular-nums font-semibold">
                    {fmtMGA(balance.totalGestionDebit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Crédit</span>
                  <span className="tabular-nums font-semibold">
                    {fmtMGA(balance.totalGestionCredit)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <span className="text-slate-600">Écart</span>
                  <span
                    className={`tabular-nums font-bold ${
                      Math.abs(balance.totalGestionDebit - balance.totalGestionCredit) < 1
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {fmt(balance.totalGestionDebit - balance.totalGestionCredit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bloc 3 : Total balance */}
            <div
              className={`rounded-lg border p-4 ${
                balance.isBalanced
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-red-300 bg-red-50"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Totaux de la balance (Sage)
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-700">Total Débit</span>
                  <span className="tabular-nums font-bold">
                    {fmtMGA(balance.totalBalanceDebit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Total Crédit</span>
                  <span className="tabular-nums font-bold">
                    {fmtMGA(balance.totalBalanceCredit)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="text-xs font-medium uppercase text-slate-700">
                    Statut
                  </span>
                  {balance.isBalanced ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Équilibrée
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Déséquilibrée
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Vérification de cohérence interne */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <CoherenceCard
              title="Recalcul des totaux (somme des comptes)"
              debit={balance.computedDebit}
              credit={balance.computedCredit}
              ecart={balance.ecartComputed}
              ok={Math.abs(balance.ecartComputed) < 1}
            />
            <CoherenceCard
              title="Équilibre des soldes (D = C)"
              debit={balance.computedSoldeDebit}
              credit={balance.computedSoldeCredit}
              ecart={balance.ecartSoldes}
              ok={Math.abs(balance.ecartSoldes) < 1}
            />
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <GitCompare className="h-4 w-4 text-slate-500" />
            <span>
              <strong>Recalcul vs Sage :</strong>{" "}
              {balance.coherenceWithSage ? (
                <span className="text-emerald-700 font-medium">
                  ✅ Cohérent — notre recalcul correspond aux totaux Sage
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  ⚠️ Écart détecté entre notre recalcul et les totaux Sage — possible différence d'arrondi ou de périmètre
                </span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Synthèse par catégorie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-slate-600" />
            Synthèse par catégorie de comptes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Nombre de comptes</TableHead>
                  <TableHead className="text-right">Total Débit</TableHead>
                  <TableHead className="text-right">Total Crédit</TableHead>
                  <TableHead className="text-right">Solde Débiteur</TableHead>
                  <TableHead className="text-right">Solde Créditeur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.byCategory.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell className="font-medium">{c.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {fmt(c.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {fmt(c.totalCredit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-700">
                      {c.soldeDebit > 0 ? fmt(c.soldeDebit) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-amber-700">
                      {c.soldeCredit > 0 ? fmt(c.soldeCredit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-bold">
                  <TableCell>TOTAUX</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {balance.totalAccounts}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(balance.computedDebit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(balance.computedCredit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700">
                    {fmt(balance.computedSoldeDebit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-amber-700">
                    {fmt(balance.computedSoldeCredit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Comparaison Balance vs Brouillard */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-4 w-4 text-slate-600" />
            Comparaison Balance vs Brouillard
            <Badge variant="outline" className="ml-2 text-xs">
              {coherentCount} cohérents · {ecartCount} écarts
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher un compte ou intitulé…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={coherenceFilter}
              onValueChange={(v) => setCoherenceFilter(v as CoherenceFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cohérence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les comptes</SelectItem>
                <SelectItem value="COHERENT">Cohérents uniquement</SelectItem>
                <SelectItem value="ECART">Avec écart</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortKey}
              onValueChange={(v) => setSortKey(v as SortKey)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ecart_abs">Écart absolu (décroissant)</SelectItem>
                <SelectItem value="compte">N° de compte (croissant)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>N° compte</TableHead>
                    <TableHead>Intitulé</TableHead>
                    <TableHead className="text-right">Balance D</TableHead>
                    <TableHead className="text-right">Balance C</TableHead>
                    <TableHead className="text-right">Brouillard D</TableHead>
                    <TableHead className="text-right">Brouillard C</TableHead>
                    <TableHead className="text-right">Écart Solde</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-sm text-slate-500">
                        Aucun compte ne correspond aux filtres.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagination.paginatedItems.map((c) => (
                      <ComparisonRow key={c.compte} c={c} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              rangeStart={pagination.rangeStart}
              rangeEnd={pagination.rangeEnd}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="comptes"
            />
          </div>
        </CardContent>
      </Card>

      {/* Comptes 512 spécifiques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Comptes 512 et 513 — Soldes de trésorerie
            <Badge variant="outline" className="ml-2 text-xs">
              {balance.accounts512.length} comptes
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° compte</TableHead>
                  <TableHead>Intitulé</TableHead>
                  <TableHead className="text-right">Mouvements Débit</TableHead>
                  <TableHead className="text-right">Mouvements Crédit</TableHead>
                  <TableHead className="text-right">Solde Débiteur</TableHead>
                  <TableHead className="text-right">Solde Créditeur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.accounts512.map((a) => (
                  <TableRow key={a.compte}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {a.compte}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{a.intitule}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {fmt(a.mvtDebit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {fmt(a.mvtCredit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-700">
                      {a.soldeDebit > 0 ? fmt(a.soldeDebit) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-amber-700">
                      {a.soldeCredit > 0 ? fmt(a.soldeCredit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonRow({ c }: { c: BalanceBrouillardComparison }) {
  return (
    <TableRow className={c.isCoherent ? "" : "bg-red-50/30"}>
      <TableCell className="font-mono text-xs font-semibold">{c.compte}</TableCell>
      <TableCell className="text-sm text-slate-700">{c.intitule}</TableCell>
      <TableCell className="text-right tabular-nums text-slate-600">
        {fmt(c.balanceDebit)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-slate-600">
        {fmt(c.balanceCredit)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-slate-600">
        {fmt(c.brouillardDebit)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-slate-600">
        {fmt(c.brouillardCredit)}
      </TableCell>
      <TableCell className="text-right tabular-nums font-semibold">
        <span
          className={
            c.isCoherent
              ? "text-emerald-700"
              : Math.abs(c.ecartSolde) > 1_000_000
              ? "text-red-700"
              : "text-amber-700"
          }
        >
          {c.ecartSolde > 0 ? "+" : ""}
          {fmt(c.ecartSolde)}
        </span>
      </TableCell>
      <TableCell className="text-center">
        {c.isCoherent ? (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            OK
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Écart
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function CoherenceCard({
  title,
  debit,
  credit,
  ecart,
  ok,
}: {
  title: string;
  debit: number;
  credit: number;
  ecart: number;
  ok: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        ok ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </div>
      <div className="mt-2 flex items-center gap-4">
        <div className="flex items-center gap-1 text-sm">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <span className="text-slate-600">D :</span>
          <span className="tabular-nums font-semibold">{fmtMGA(debit)}</span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <TrendingDown className="h-4 w-4 text-amber-600" />
          <span className="text-slate-600">C :</span>
          <span className="tabular-nums font-semibold">{fmtMGA(credit)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Écart :</span>
          <span
            className={`tabular-nums font-bold ${
              ok ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {fmt(ecart)}
          </span>
          {ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
        </div>
      </div>
    </div>
  );
}
