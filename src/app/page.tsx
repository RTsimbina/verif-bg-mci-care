"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileUploader } from "@/components/accounting/file-uploader";
import { DashboardTab } from "@/components/accounting/dashboard-tab";
import { ComptesAComptesTab } from "@/components/accounting/comptes-a-comptes-tab";
import { RulesTab } from "@/components/accounting/rules-tab";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ScrollText,
  Calculator,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/accounting/engine";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleAnalyzed = useCallback((r: AnalysisResult) => {
    setResult(r);
  }, []);

  const handleExport = useCallback(async () => {
    if (!result) return;
    setExporting(true);
    try {
      const fd = new FormData();
      // Re-read files from inputs is not possible here, so we POST the result JSON
      // instead — but the /api/export endpoint expects files. To keep it simple,
      // we POST the JSON and let the server regenerate.
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Export_Verif_BG_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
      alert("Erreur lors de l'export : " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [result]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 sm:text-lg">
                  Vérification BG — MCI CARE MADAGASCAR
                </h1>
                <p className="hidden text-xs text-slate-500 sm:block">
                  Détection automatique des écritures incorrectes et génération
                  des transferts 580001
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex">
                Comptes 512 · Transferts 580001
              </Badge>
              {result && (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  {result.verif.soldedCount}/{result.verif.entityCount} soldés
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {!result ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Bienvenue dans l'assistant de vérification des écritures
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Cet outil analyse le fichier <strong>Verif BG.xlsx</strong> (lignes de
                vérification par entité) et le <strong>Brouillard 2026.xlsx</strong> (écritures
                comptables détaillées) pour détecter les écritures incorrectes et proposer
                automatiquement les écritures de transfert <strong>580001</strong> permettant
                de solder toutes les lignes de vérification.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  Détection des 3 types d'opérations : appels de fonds, paiements
                  prestataires, honoraires
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  Application des règles de regroupement 512 (PAMF↔EASYTECH, AITS↔STELARIX, etc.)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  Gestion de l'historique SANLAMALLIANZ (512100 → 512501)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  Export Excel avec écritures de transfert prêtes à intégrer
                </li>
              </ul>
            </div>

            <FileUploader onAnalyzed={handleAnalyzed} />
          </div>
        ) : (
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-fit lg:grid-cols-4">
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Tableau de bord</span>
                <span className="sm:hidden">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="transferts" className="gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                <span className="hidden sm:inline">Comptes à comptes</span>
                <span className="sm:hidden">580001</span>
                {result.transferStats.aCreer > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 h-5 px-1.5 text-[10px]"
                  >
                    {result.transferStats.aCreer}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-2">
                <ScrollText className="h-4 w-4" />
                <span className="hidden sm:inline">Règles de gestion</span>
                <span className="sm:hidden">Règles</span>
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-2">
                <Calculator className="h-4 w-4" />
                <span className="hidden sm:inline">Recharger</span>
                <span className="sm:hidden">Fichiers</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-4">
              <DashboardTab result={result} />
            </TabsContent>
            <TabsContent value="transferts" className="mt-4">
              <ComptesAComptesTab
                result={result}
                onExport={handleExport}
                exporting={exporting}
              />
            </TabsContent>
            <TabsContent value="rules" className="mt-4">
              <RulesTab />
            </TabsContent>
            <TabsContent value="upload" className="mt-4">
              <FileUploader onAnalyzed={handleAnalyzed} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
            <div>
              MCI CARE MADAGASCAR — Assistant de vérification des écritures BG
            </div>
            <div className="font-mono">
              Comptes 460/461 · 462 · 467 · 512/513 · 580001
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
