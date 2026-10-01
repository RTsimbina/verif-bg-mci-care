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
  AlertCircle,
  AlertTriangle,
  Search,
  ChevronRight,
  ChevronDown,
  XCircle,
  Info,
  ShieldAlert,
} from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/accounting/pagination-bar";
import type { AnalysisResult } from "@/lib/accounting/engine";
import type {
  Anomaly,
  AnomalyType,
  Confidence,
  Severity,
} from "@/lib/accounting/anomaly-engine";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n || 0);

const fmtMGA = (n: number) => `${fmt(n)} MGA`;

const SEVERITY_ICONS: Record<Severity, React.ReactNode> = {
  CRITIQUE: <XCircle className="h-3.5 w-3.5" />,
  MAJEURE: <AlertTriangle className="h-3.5 w-3.5" />,
  MINEURE: <AlertCircle className="h-3.5 w-3.5" />,
  INFO: <Info className="h-3.5 w-3.5" />,
};

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITIQUE: "bg-red-100 text-red-800 hover:bg-red-100",
  MAJEURE: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  MINEURE: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  INFO: "bg-slate-100 text-slate-800 hover:bg-slate-100",
};

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  CERTAINE: "bg-red-50 text-red-700 border-red-200",
  PROBABLE: "bg-amber-50 text-amber-700 border-amber-200",
  MANUELLE: "bg-slate-50 text-slate-700 border-slate-200",
};

interface Props {
  result: AnalysisResult;
}

type TypeFilter = "ALL" | AnomalyType;
type SeverityFilter = "ALL" | Severity;
type ConfidenceFilter = "ALL" | Confidence;

export function AnomaliesTab({ result }: Props) {
  const { anomalies, anomalySummary, anomalyStats } = result;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("ALL");

  const filtered = useMemo(() => {
    let arr = anomalies.slice();
    if (typeFilter !== "ALL") {
      arr = arr.filter((a) => a.type === typeFilter);
    }
    if (severityFilter !== "ALL") {
      arr = arr.filter((a) => a.severity === severityFilter);
    }
    if (confidenceFilter !== "ALL") {
      arr = arr.filter((a) => a.confidence === confidenceFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.entity || "").toLowerCase().includes(q) ||
          (a.journal || "").toLowerCase().includes(q) ||
          (a.numPiece || "").toLowerCase().includes(q) ||
          (a.compte || "").toLowerCase().includes(q) ||
          (a.compteTiers || "").toLowerCase().includes(q) ||
          a.evidence.some((e) => e.toLowerCase().includes(q))
      );
    }
    return arr;
  }, [anomalies, search, typeFilter, severityFilter, confidenceFilter]);

  const pagination = usePagination(filtered, 25);

  return (
    <div className="space-y-6">
      {/* Bandeau équilibre global */}
      <Card
        className={
          result.brouillardEquilibre.isBalanced
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-red-300 bg-red-50/40"
        }
      >
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-slate-600" />
              <div>
                <div className="text-sm font-semibold text-slate-700">
                  Équilibre global du Brouillard
                </div>
                <div className="text-xs text-slate-500">
                  Total Débit vs Total Crédit (tous journaux confondus)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-slate-500">Total Débit</div>
                <div className="font-bold tabular-nums">
                  {fmtMGA(result.brouillardEquilibre.totalDebit)}
                </div>
              </div>
              <div className="text-2xl font-light text-slate-400">=</div>
              <div className="text-left">
                <div className="text-xs text-slate-500">Total Crédit</div>
                <div className="font-bold tabular-nums">
                  {fmtMGA(result.brouillardEquilibre.totalCredit)}
                </div>
              </div>
              {result.brouillardEquilibre.isBalanced ? (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  COMPTABILITÉ ÉQUILIBRÉE
                </Badge>
              ) : (
                <Badge variant="destructive">
                  ÉCART : {fmt(result.brouillardEquilibre.ecart)} MGA
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs par type d'anomalie */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {anomalySummary.map((s) => (
          <AnomalyTypeCard
            key={s.type}
            summary={s}
            onClick={() => setTypeFilter(s.type === typeFilter ? "ALL" : s.type)}
            active={s.type === typeFilter}
          />
        ))}
      </div>

      {/* Stats globales */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-slate-700">
              {anomalyStats.total} anomalies au total
            </span>
            <Badge variant="destructive">
              {anomalyStats.critiqueCount} critiques
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              {anomalyStats.majeureCount} majeures
            </Badge>
            <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
              {anomalyStats.mineureCount} mineures
            </Badge>
            <Badge variant="outline" className="border-slate-300">
              {anomalyStats.certaineCount} certaines ·{" "}
              {anomalyStats.probableCount} probables ·{" "}
              {anomalyStats.manuelleCount} manuelles
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des anomalies */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Détail des anomalies
            <Badge variant="outline" className="ml-2 text-xs">
              {filtered.length} affichées
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher (entité, journal, pièce, compte…)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TypeFilter)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les types</SelectItem>
                {anomalySummary.map((s) => (
                  <SelectItem key={s.type} value={s.type}>
                    {s.typeLabel} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={severityFilter}
              onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sévérité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes sévérités</SelectItem>
                <SelectItem value="CRITIQUE">Critique</SelectItem>
                <SelectItem value="MAJEURE">Majeure</SelectItem>
                <SelectItem value="MINEURE">Mineure</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={confidenceFilter}
              onValueChange={(v) => setConfidenceFilter(v as ConfidenceFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Confiance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes confiances</SelectItem>
                <SelectItem value="CERTAINE">Certaine</SelectItem>
                <SelectItem value="PROBABLE">Probable</SelectItem>
                <SelectItem value="MANUELLE">Manuelle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tableau */}
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Aucune anomalie ne correspond aux filtres. 🎉
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead className="w-[110px]">Type</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Entité / Journal</TableHead>
                      <TableHead>Pièce / Compte</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                      <TableHead className="text-center">Sévérité</TableHead>
                      <TableHead className="text-center">Confiance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedItems.map((a) => (
                      <AnomalyRow key={a.id} a={a} />
                    ))}
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
                pageSizeOptions={[10, 25, 50, 100, 250]}
                itemLabel="anomalies"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnomalyTypeCard({
  summary,
  onClick,
  active,
}: {
  summary: {
    type: AnomalyType;
    typeLabel: string;
    count: number;
    critiqueCount: number;
    majeureCount: number;
    mineureCount: number;
  };
  onClick: () => void;
  active: boolean;
}) {
  const tone =
    summary.critiqueCount > 0
      ? "border-red-300 bg-red-50/50"
      : summary.majeureCount > 0
      ? "border-amber-300 bg-amber-50/50"
      : "border-slate-200 bg-white";
  return (
    <Card
      className={`${tone} cursor-pointer transition-all hover:scale-[1.02] ${
        active ? "ring-2 ring-slate-400" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {summary.typeLabel}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{summary.count}</div>
        <div className="mt-1 flex gap-1 text-[10px]">
          {summary.critiqueCount > 0 && (
            <span className="rounded bg-red-100 px-1 text-red-700">
              {summary.critiqueCount} crit
            </span>
          )}
          {summary.majeureCount > 0 && (
            <span className="rounded bg-amber-100 px-1 text-amber-700">
              {summary.majeureCount} maj
            </span>
          )}
          {summary.mineureCount > 0 && (
            <span className="rounded bg-sky-100 px-1 text-sky-700">
              {summary.mineureCount} min
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AnomalyRow({ a }: { a: Anomaly }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-[40px] text-center">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </TableCell>
        <TableCell className="font-mono text-xs text-slate-500">{a.id}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px]">
            {a.type.split("_")[0]}
          </Badge>
        </TableCell>
        <TableCell className="text-sm font-medium text-slate-900">
          {a.title}
        </TableCell>
        <TableCell className="text-xs">
          {a.entity && <div className="font-medium">{a.entity}</div>}
          {a.journal && <div className="text-slate-500">{a.journal}</div>}
        </TableCell>
        <TableCell className="text-xs">
          {a.numPiece && <div className="font-mono">Pièce {a.numPiece}</div>}
          {a.compte && <div className="font-mono text-slate-500">{a.compte}</div>}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs font-semibold">
          {a.ecart !== undefined && a.ecart !== 0 ? (
            <span className={Math.abs(a.ecart) > 1_000_000 ? "text-red-700" : "text-amber-700"}>
              {fmt(a.ecart)}
            </span>
          ) : a.montant !== undefined ? (
            <span className="text-slate-600">{fmt(a.montant)}</span>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="text-center">
          <Badge className={SEVERITY_COLORS[a.severity]}>
            {SEVERITY_ICONS[a.severity]}
            <span className="ml-1 text-[10px]">{a.severity}</span>
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_COLORS[a.confidence]}`}>
            {a.confidence}
          </Badge>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-slate-50/50">
          <TableCell colSpan={9} className="p-4">
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Description
                </div>
                <p className="mt-1 text-sm text-slate-700">{a.description}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Preuves
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {a.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      <span className="font-mono">{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {(a.date || a.compteTiers) && (
                <div className="flex gap-4 text-xs text-slate-500">
                  {a.date && <div>Date : <strong>{a.date}</strong></div>}
                  {a.compteTiers && <div>Tiers : <strong className="font-mono">{a.compteTiers}</strong></div>}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
