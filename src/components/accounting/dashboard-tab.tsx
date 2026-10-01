"use client";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { AnalysisResult } from "@/lib/accounting/engine";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n || 0);

const fmtMGA = (n: number) => `${fmt(n)} MGA`;

interface Props {
  result: AnalysisResult;
}

export function DashboardTab({ result }: Props) {
  const { verif, brouillard, transfers, transferStats, unmatchedEcarts } = result;

  return (
    <div className="space-y-6">
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
            {verif.entityCount} entités
          </Badge>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[480px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead>Entité</TableHead>
                  <TableHead className="text-right">Solde Appel de fonds</TableHead>
                  <TableHead className="text-right">Solde Trésorerie</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead>Compte 512 dédié</TableHead>
                  <TableHead>Groupe 512</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verif.entities.map((e) => (
                  <TableRow
                    key={e.name}
                    className={e.hasEcart ? "bg-amber-50/40" : ""}
                  >
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {fmt(e.soldeAppelDeFonds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
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
                      <StatusBadge solded={e.isSolded} severity={e.severity} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.resolved512 || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {e.group512.length > 0 ? e.group512.join(" · ") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
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
