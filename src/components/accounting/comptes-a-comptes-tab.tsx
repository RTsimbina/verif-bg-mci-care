"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Download,
  Search,
  ArrowDownUp,
} from "lucide-react";
import type { AnalysisResult, ProposedTransfer } from "@/lib/accounting/engine";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n || 0);

const fmtMGA = (n: number) => `${fmt(n)} MGA`;

type StatusFilter = "ALL" | "A_CREER" | "DEJA_PASSEE" | "MANUEL";

interface Props {
  result: AnalysisResult;
  onExport: () => void;
  exporting: boolean;
}

export function ComptesAComptesTab({ result, onExport, exporting }: Props) {
  const { transfers, transferStats } = result;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"montant" | "entity" | "status">("montant");

  const filtered = useMemo(() => {
    let arr = transfers.slice();
    if (statusFilter !== "ALL") {
      arr = arr.filter((t) => t.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.entityFrom.toLowerCase().includes(q) ||
          t.entityTo.toLowerCase().includes(q) ||
          t.compteFrom.toLowerCase().includes(q) ||
          t.compteTo.toLowerCase().includes(q) ||
          t.libelle.toLowerCase().includes(q)
      );
    }
    arr.sort((a, b) => {
      if (sortKey === "montant") return b.montant - a.montant;
      if (sortKey === "entity") return a.entityFrom.localeCompare(b.entityFrom);
      // status
      return a.status.localeCompare(b.status);
    });
    return arr;
  }, [transfers, statusFilter, search, sortKey]);

  return (
    <div className="space-y-6">
      {/* Bandeau de stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatPill
          icon={<Clock className="h-4 w-4" />}
          label="À créer"
          value={String(transferStats.aCreer)}
          tone="amber"
        />
        <StatPill
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Déjà passées"
          value={String(transferStats.dejaPassee)}
          tone="emerald"
        />
        <StatPill
          icon={<HelpCircle className="h-4 w-4" />}
          label="Manuel"
          value={String(transferStats.manuel)}
          tone="slate"
        />
        <StatPill
          icon={<ArrowDownUp className="h-4 w-4" />}
          label="Montant total à créer"
          value={fmtMGA(transferStats.montantTotal)}
          tone="primary"
        />
      </div>

      {/* Bandeau d'actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Écritures de transfert — Compte 580001
          </CardTitle>
          <Button onClick={onExport} disabled={exporting} className="bg-slate-900 hover:bg-slate-800">
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Export en cours…" : "Exporter Excel"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher entité, compte, libellé…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="A_CREER">À créer</SelectItem>
                <SelectItem value="DEJA_PASSEE">Déjà passées</SelectItem>
                <SelectItem value="MANUEL">Manuel</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortKey}
              onValueChange={(v) => setSortKey(v as "montant" | "entity" | "status")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="montant">Montant décroissant</SelectItem>
                <SelectItem value="entity">Entité émettrice (A-Z)</SelectItem>
                <SelectItem value="status">Statut</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {transfers.length === 0
                ? "Aucune écriture de transfert à proposer. Tous les écarts sont soldés. 🎉"
                : "Aucune écriture ne correspond aux filtres."}
            </div>
          ) : (
            <ScrollArea className="max-h-[640px] rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>Flux (émetteur → récepteur)</TableHead>
                    <TableHead>Comptes 512</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead>Transfert existant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TransferRow key={t.id} t={t} />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TransferRow({ t }: { t: ProposedTransfer }) {
  return (
    <TableRow className={t.status === "DEJA_PASSEE" ? "opacity-60" : ""}>
      <TableCell className="font-mono text-xs text-slate-500">{t.id}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-semibold text-slate-900">{t.entityFrom}</div>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <div className="font-semibold text-slate-900">{t.entityTo}</div>
        </div>
        <div className="mt-1 text-xs text-slate-500 line-clamp-1" title={t.libelle}>
          {t.libelle}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
            Crédit {t.compteFrom}
          </span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
            Débit {t.compteTo}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums font-semibold">
        {fmtMGA(t.montant)}
      </TableCell>
      <TableCell className="text-center">
        <StatusBadge status={t.status} />
      </TableCell>
      <TableCell className="text-xs text-slate-500">
        {t.matchedExisting ? (
          <div className="space-y-0.5">
            <div className="font-mono">
              {t.matchedExisting.journal} · {t.matchedExisting.numPiece || "—"}
            </div>
            {t.matchedExisting.date && (
              <div className="text-slate-400">
                {new Date(t.matchedExisting.date).toLocaleDateString("fr-FR")}
              </div>
            )}
            <div className="line-clamp-1 text-slate-400" title={t.matchedExisting.libelle}>
              {t.matchedExisting.libelle}
            </div>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: ProposedTransfer["status"] }) {
  if (status === "A_CREER") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        <Clock className="mr-1 h-3 w-3" />
        À créer
      </Badge>
    );
  }
  if (status === "DEJA_PASSEE") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Déjà passée
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <HelpCircle className="mr-1 h-3 w-3" />
      Manuel
    </Badge>
  );
}

function StatPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "amber" | "emerald" | "slate" | "primary";
}) {
  const tones: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50/60 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
    slate: "border-slate-200 bg-slate-50/60 text-slate-700",
    primary: "border-slate-300 bg-slate-100/60 text-slate-900",
  };
  return (
    <Card className={tones[tone]}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/80">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide opacity-70">
            {label}
          </div>
          <div className="text-lg font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
