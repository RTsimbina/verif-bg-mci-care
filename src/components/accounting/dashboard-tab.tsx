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
import { CheckCircle2, AlertTriangle, XCircle, Search, Scale, BookOpen, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/accounting/pagination-bar";
import type { AnalysisResult, EntityAnalysis } from "@/lib/accounting/engine";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n || 0);

const fmtMGA = (n: number) => `${fmt(n)} MGA`;

interface Props {
  result: AnalysisResult;
}

type StatusFilter = "ALL" | "SOLDED" | "ECART";
type SortKey = "name" | "ecart_abs" | "ecart";

export function DashboardTab({ result }: Props) {
  const { verif, brouillard, transfers, transferStats, unmatchedEcarts } = result;
  const v = verif; // alias court

  // Filtres + tri pour la table des entités
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("ecart_abs");

  const filteredEntities = useMemo(() => {
    let arr = verif.entities.slice();
    if (statusFilter === "SOLDED") {
      arr = arr.filter((e) => e.isSolded);
    } else if (statusFilter === "ECART") {
      arr = arr.filter((e) => !e.isSolded);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.resolved512 || "").toLowerCase().includes(q) ||
          e.group512.some((g) => g.toLowerCase().includes(q))
      );
    }
    arr.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "ecart") return a.ecart - b.ecart;
      // ecart_abs (décroissant)
      return b.ecartAbsolu - a.ecartAbsolu;
    });
    return arr;
  }, [verif.entities, search, statusFilter, sortKey]);

  const pagination = usePagination(filteredEntities, 10);

  return (
    <div className="space-y-6">
      {/* Bandeau équilibre global prominent */}
      <Card
        className={
          result.brouillardEquilibre.isBalanced
            ? "border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-50/30"
            : "border-red-300 bg-gradient-to-r from-red-50 to-red-50/30"
        }
      >
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  result.brouillardEquilibre.isBalanced
                    ? "bg-emerald-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                <Scale className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Équilibre comptable global
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {result.brouillardEquilibre.isBalanced
                    ? "🟢 COMPTABILITÉ ÉQUILIBRÉE"
                    : "🔴 ÉCART DÉTECTÉ"}
                </div>
                <div className="text-xs text-slate-500">
                  Total Débit = {fmtMGA(result.brouillardEquilibre.totalDebit)} ·{" "}
                  Total Crédit = {fmtMGA(result.brouillardEquilibre.totalCredit)}
                  {!result.brouillardEquilibre.isBalanced && (
                    <span className="font-semibold text-red-700">
                      {" "}· Écart : {fmt(result.brouillardEquilibre.ecart)} MGA
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <div className="font-semibold text-slate-600">Pièces</div>
                <div className="text-lg font-bold tabular-nums">
                  {result.pieceControls.totalPieces.toLocaleString("fr-FR")}
                </div>
                <div className="text-slate-500">
                  {result.pieceControls.balancedPieces.toLocaleString("fr-FR")} équilibrées
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-slate-600">Journaux</div>
                <div className="text-lg font-bold tabular-nums">
                  {result.journalControls.length}
                </div>
                <div className="text-slate-500">
                  {result.journalControls.filter((j) => j.isBalanced).length} équilibrés
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-slate-600">Anomalies</div>
                <div className="text-lg font-bold tabular-nums text-red-700">
                  {result.anomalyStats.total.toLocaleString("fr-FR")}
                </div>
                <div className="text-slate-500">
                  {result.anomalyStats.critiqueCount} critiques
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Entités vérifiées"
          value={`${verif.soldedCount}/${verif.entityCount}`}
          subtitle={`${verif.ecartsCount} avec écart`}
          tone="primary"
        />
        <KpiCard
          title="Écarts totaux (|absolu|)"
          value={fmtMGA(verif.totalEcartAbsolu)}
          subtitle="à régulariser"
          tone={verif.totalEcartAbsolu > 0 ? "warn" : "ok"}
        />
        <KpiCard
          title="Transferts 580001 à créer"
          value={String(transferStats.aCreer)}
          subtitle={`Montant : ${fmtMGA(transferStats.montantTotal)}`}
          tone={transferStats.aCreer > 0 ? "warn" : "ok"}
        />
        <KpiCard
          title="Transferts déjà passés"
          value={String(transferStats.dejaPassee)}
          subtitle={`${brouillard.existingTransfersCount} écritures 580 existantes`}
          tone="info"
        />
      </div>

      {/* Nouveaux KPIs : 4 contrôles de validation croisée */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CheckKpi
          label="Équilibre D = C"
          okCount={v.equilibreDcOkCount}
          totalCount={v.entityCount}
          icon={<Scale className="h-3.5 w-3.5" />}
        />
        <CheckKpi
          label="Cohérence Balance"
          okCount={v.balanceOkCount}
          totalCount={v.entityCount}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <CheckKpi
          label="Cohérence Brouillard"
          okCount={v.brouillardOkCount}
          totalCount={v.entityCount}
          icon={<BookOpen className="h-3.5 w-3.5" />}
        />
        <CheckKpi
          label="Code journal valide"
          okCount={v.journalOkCount}
          totalCount={v.entityCount}
          icon={<FileText className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Statut global des entités */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm font-semibold text-slate-700">
              Statut global des {v.entityCount} entités :
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {v.globalOkCount} OK (4/4 contrôles)
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {v.globalWarnCount} avertissements (2-3/4)
            </Badge>
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" />
              {v.globalErrorCount} erreurs (0-1/4)
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Résumé opérations détectées */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Opérations détectées dans le brouillard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type d'opération</TableHead>
                  <TableHead className="text-right">Nombre d'écritures</TableHead>
                  <TableHead className="text-right">Total Débit</TableHead>
                  <TableHead className="text-right">Total Crédit</TableHead>
                  <TableHead className="text-right">Solde (D − C)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brouillard.operationsByType.map((op) => (
                  <TableRow key={op.type}>
                    <TableCell className="font-medium">{op.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(op.count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(op.totalDebit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(op.totalCredit)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmt(op.solde)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-semibold">
                  <TableCell>Compte 580001 (existant)</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(brouillard.existingTransfersCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(brouillard.totalDebit580)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(brouillard.totalCredit580)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(brouillard.totalDebit580 - brouillard.totalCredit580)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Liste des entités */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Entités — détail des écarts
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {filteredEntities.length} / {verif.entityCount} entités
          </Badge>
        </CardHeader>
        <CardContent>
          {/* Barre de filtres */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher une entité, un compte 512…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="SOLDED">Soldés uniquement</SelectItem>
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
                <SelectItem value="name">Nom (A-Z)</SelectItem>
                <SelectItem value="ecart">Écart signé (croissant)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tableau paginé */}
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Entité</TableHead>
                    <TableHead className="text-right">Solde Appels</TableHead>
                    <TableHead className="text-right">Solde Trésor.</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                    <TableHead className="text-center">D = C</TableHead>
                    <TableHead className="text-center">Balance</TableHead>
                    <TableHead className="text-center">Brouillard</TableHead>
                    <TableHead className="text-center">Journal</TableHead>
                    <TableHead className="text-center">Global</TableHead>
                    <TableHead>Compte 512</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="h-24 text-center text-sm text-slate-500">
                        Aucune entité ne correspond aux filtres.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagination.paginatedItems.map((e) => (
                      <EntityRow key={e.name} e={e} />
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
              itemLabel="entités"
            />
          </div>
        </CardContent>
      </Card>

      {/* Écarts non appariés */}
      {unmatchedEcarts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-800">
              <XCircle className="h-4 w-4" />
              Écarts non appariés — à traiter manuellement ({unmatchedEcarts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entité</TableHead>
                  <TableHead className="text-right">Écart restant</TableHead>
                  <TableHead className="text-center">Sévérité</TableHead>
                  <TableHead>Compte 512 dédié</TableHead>
                  <TableHead>Groupe 512</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedEcarts.map((e, i) => (
                  <TableRow key={`${e.name}-${i}`}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-red-700">
                      {fmt(e.ecart)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={e.severity === "MAJEUR" ? "destructive" : "secondary"}>
                        {e.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.resolved512 || "—"}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {e.group512.length > 0 ? e.group512.join(" · ") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "primary" | "ok" | "warn" | "info";
}) {
  const tones: Record<string, string> = {
    primary: "border-slate-200 bg-white",
    ok: "border-emerald-200 bg-emerald-50/60",
    warn: "border-amber-200 bg-amber-50/60",
    info: "border-sky-200 bg-sky-50/60",
  };
  const valueColors: Record<string, string> = {
    primary: "text-slate-900",
    ok: "text-emerald-700",
    warn: "text-amber-700",
    info: "text-sky-700",
  };
  return (
    <Card className={tones[tone]}>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {title}
        </div>
        <div className={`mt-1 text-2xl font-bold tabular-nums ${valueColors[tone]}`}>
          {value}
        </div>
        <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function CheckKpi({
  label,
  okCount,
  totalCount,
  icon,
}: {
  label: string;
  okCount: number;
  totalCount: number;
  icon: React.ReactNode;
}) {
  const pct = totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 0;
  const tone = pct === 100 ? "emerald" : pct >= 80 ? "amber" : "red";
  const toneClasses: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
    amber: "border-amber-200 bg-amber-50/60 text-amber-800",
    red: "border-red-200 bg-red-50/60 text-red-800",
  };
  return (
    <Card className={toneClasses[tone]}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">
          {okCount}<span className="text-base font-normal text-slate-500">/{totalCount}</span>
        </div>
        <div className="mt-1 text-xs text-slate-600">
          {pct}% des entités validées
        </div>
      </CardContent>
    </Card>
  );
}

function EntityRow({ e }: { e: EntityAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <TableRow
        className={e.hasEcart ? "bg-amber-50/40 cursor-pointer" : "cursor-pointer hover:bg-slate-50"}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-[40px] text-center">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </TableCell>
        <TableCell className="font-medium">{e.name}</TableCell>
        <TableCell className="text-right tabular-nums text-slate-600 text-xs">
          {fmt(e.soldeAppelDeFonds)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-slate-600 text-xs">
          {fmt(e.soldeTresorerie)}
        </TableCell>
        <TableCell className="text-right tabular-nums font-semibold">
          <span
            className={
              e.isSolded
                ? "text-emerald-700"
                : e.ecart > 0
                ? "text-amber-700"
                : "text-red-700"
            }
          >
            {fmt(e.ecart)}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <MiniCheck ok={e.equilibreDcOk} />
        </TableCell>
        <TableCell className="text-center">
          <MiniCheck
            ok={e.balanceOk}
            partial={e.balanceEcartCount > 0 && e.balanceCoherentCount > 0}
            label={`${e.balanceCoherentCount}/${e.balanceByAccount.length}`}
          />
        </TableCell>
        <TableCell className="text-center">
          <MiniCheck
            ok={e.brouillardOk}
            partial={e.brouillardEcartCount > 0 && e.brouillardCoherentCount > 0}
            label={`${e.brouillardCoherentCount}/${e.brouillardByAccount.length}`}
          />
        </TableCell>
        <TableCell className="text-center">
          <MiniCheck
            ok={e.journalOk}
            label={e.journalCodes.length > 0 ? `${e.journalCodes.length}` : "—"}
          />
        </TableCell>
        <TableCell className="text-center">
          <GlobalStatusBadge status={e.globalStatus} />
        </TableCell>
        <TableCell className="font-mono text-xs">
          {e.resolved512 || "—"}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-slate-50/50">
          <TableCell colSpan={11} className="p-4">
            <EntityDetail e={e} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function MiniCheck({
  ok,
  partial = false,
  label,
}: {
  ok: boolean;
  partial?: boolean;
  label?: string;
}) {
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {label && <span className="text-xs tabular-nums">{label}</span>}
      </span>
    );
  }
  if (partial) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        {label && <span className="text-xs tabular-nums">{label}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-700">
      <XCircle className="h-3.5 w-3.5" />
      {label && <span className="text-xs tabular-nums">{label}</span>}
    </span>
  );
}

function GlobalStatusBadge({ status }: { status: "OK" | "WARN" | "ERROR" }) {
  if (status === "OK") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        OK
      </Badge>
    );
  }
  if (status === "WARN") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        WARN
      </Badge>
    );
  }
  return <Badge variant="destructive">ERROR</Badge>;
}

function EntityDetail({ e }: { e: EntityAnalysis }) {
  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="text-sm font-bold text-slate-900">{e.name}</h4>
        <Badge variant="outline" className="text-xs">
          {e.checksPassed}/{e.checksTotal} contrôles OK
        </Badge>
        <GlobalStatusBadge status={e.globalStatus} />
      </div>

      {/* Les 4 contrôles en cartes */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <CheckCard
          title="1. Équilibre D = C"
          ok={e.equilibreDcOk}
          okLabel="Équilibré"
          koLabel={`Écart : ${fmt(e.equilibreDcEcart)} MGA`}
          details={[
            `Total Débit : ${fmt(e.totalDebit)} MGA`,
            `Total Crédit : ${fmt(e.totalCredit)} MGA`,
          ]}
        />
        <CheckCard
          title="2. Cohérence Balance"
          ok={e.balanceOk}
          okLabel="Tous comptes cohérents"
          koLabel={`${e.balanceEcartCount} écart(s) — max ${fmt(e.balanceMaxEcart)} MGA`}
          details={[
            `Comptes vérifiés : ${e.balanceByAccount.length}`,
            `Cohérents : ${e.balanceCoherentCount}`,
          ]}
        />
        <CheckCard
          title="3. Cohérence Brouillard"
          ok={e.brouillardOk}
          okLabel="Tous comptes cohérents"
          koLabel={`${e.brouillardEcartCount} écart(s) — max ${fmt(e.brouillardMaxEcart)} MGA`}
          details={[
            `Comptes vérifiés : ${e.brouillardByAccount.length}`,
            `Cohérents : ${e.brouillardCoherentCount}`,
          ]}
        />
        <CheckCard
          title="4. Code journal"
          ok={e.journalOk}
          okLabel={`${e.journalCodes.length} journal(aux) trouvé(s)`}
          koLabel={e.journalExpected.length === 0 ? "Suffixe inconnu" : "Aucun journal attendu trouvé"}
          details={[
            `Journaux attendus : ${e.journalExpected.length > 0 ? e.journalExpected.join(", ") : "—"}`,
            `Journaux présents : ${e.journalCodes.length > 0 ? e.journalCodes.join(", ") : "—"}`,
            ...(e.journalMissing.length > 0 ? [`Manquants : ${e.journalMissing.join(", ")}`] : []),
          ]}
        />
      </div>

      {/* Détail par compte */}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader className="bg-slate-100">
            <TableRow>
              <TableHead>N° compte</TableHead>
              <TableHead className="text-right">Solde Verif</TableHead>
              <TableHead className="text-right">Solde Balance</TableHead>
              <TableHead className="text-right">Écart Balance</TableHead>
              <TableHead className="text-right">Solde Brouillard</TableHead>
              <TableHead className="text-right">Écart Brouillard</TableHead>
              <TableHead className="text-center">Balance</TableHead>
              <TableHead className="text-center">Brouillard</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {e.balanceByAccount.map((ac) => (
              <TableRow key={ac.compte}>
                <TableCell className="font-mono text-xs font-semibold">{ac.compte}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {fmt(ac.verifSolde)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs text-slate-600">
                  {fmt(ac.balanceSolde)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  <span className={ac.isBalanceCoherent ? "text-emerald-700" : "text-red-700"}>
                    {fmt(ac.ecartBalance)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs text-slate-600">
                  {fmt(ac.brouillardSolde)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  <span className={ac.isBrouillardCoherent ? "text-emerald-700" : "text-red-700"}>
                    {fmt(ac.ecartBrouillard)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <MiniCheck ok={ac.isBalanceCoherent} />
                </TableCell>
                <TableCell className="text-center">
                  <MiniCheck ok={ac.isBrouillardCoherent} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CheckCard({
  title,
  ok,
  okLabel,
  koLabel,
  details,
}: {
  title: string;
  ok: boolean;
  okLabel: string;
  koLabel: string;
  details: string[];
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        ok
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-red-200 bg-red-50/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {title}
        </span>
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
      </div>
      <div
        className={`mt-1 text-xs font-medium ${
          ok ? "text-emerald-700" : "text-red-700"
        }`}
      >
        {ok ? okLabel : koLabel}
      </div>
      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
        {details.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({
  solded,
  severity,
}: {
  solded: boolean;
  severity: "OK" | "MINEUR" | "MAJEUR";
}) {
  if (solded) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Soldé
      </Badge>
    );
  }
  if (severity === "MAJEUR") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Majeur
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
      <AlertTriangle className="mr-1 h-3 w-3" />
      Mineur
    </Badge>
  );
}
