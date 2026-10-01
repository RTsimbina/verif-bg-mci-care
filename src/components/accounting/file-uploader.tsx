"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { AnalysisResult } from "@/lib/accounting/engine";
import { parseVerifBG, parseBrouillard } from "@/lib/accounting/parser";
import { analyze as runAnalysis } from "@/lib/accounting/engine";

interface FileSlotProps {
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File | null) => void;
  accent?: "primary" | "secondary";
}

function FileSlot({ label, hint, file, onPick, accent = "primary" }: FileSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const accentClasses =
    accent === "primary"
      ? "border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50"
      : "border-amber-300 bg-amber-50/50 hover:bg-amber-50";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`group cursor-pointer rounded-xl border-2 border-dashed p-6 transition-all ${accentClasses} ${
        dragOver ? "scale-[1.02] ring-2 ring-offset-2 ring-emerald-400" : ""
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
            accent === "primary" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {file ? <FileSpreadsheet className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="mt-1 text-xs text-slate-500">{hint}</div>
          {file ? (
            <div className="mt-2 truncate text-xs font-mono text-slate-700">{file.name}</div>
          ) : (
            <div className="mt-2 text-xs text-slate-400">Glissez-déposez ou cliquez pour parcourir</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  onAnalyzed: (result: AnalysisResult) => void;
}

export function FileUploader({ onAnalyzed }: Props) {
  const [verif, setVerif] = useState<File | null>(null);
  const [brouillard, setBrouillard] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const canAnalyze = verif && brouillard && !loading;

  const analyze = useCallback(async () => {
    if (!verif || !brouillard) return;
    setLoading(true);
    setError(null);
    try {
      // Lecture des fichiers côté client
      const verifBuf = await verif.arrayBuffer();
      const brouBuf = await brouillard.arrayBuffer();
      // Parsing + analyse (tout côté client)
      const verifData = parseVerifBG(verifBuf);
      const brouData = parseBrouillard(brouBuf);
      const result = runAnalysis(verifData, brouData);
      onAnalyzed(result);
      toast({
        title: "Analyse terminée",
        description: `${result.verif.entityCount} entités, ${result.transfers.length} transferts proposés.`,
      });
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'analyse");
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || "Erreur lors de l'analyse",
      });
    } finally {
      setLoading(false);
    }
  }, [verif, brouillard, onAnalyzed]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Chargement des fichiers</h2>
            <p className="text-xs text-slate-500">
              Sélectionnez les 2 fichiers Excel requis pour l'analyse comptable.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FileSlot
            label="Verif BG.xlsx"
            hint="Fichier de vérification (balance + feuille « 2026 » + lignes par entité)"
            file={verif}
            onPick={setVerif}
            accent="primary"
          />
          <FileSlot
            label="Brouillard 2026.xlsx"
            hint="Brouillard comptable — toutes les écritures de l'année"
            file={brouillard}
            onPick={setBrouillard}
            accent="secondary"
          />
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={analyze} disabled={!canAnalyze} className="bg-slate-900 hover:bg-slate-800">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyse en cours…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Lancer l'analyse
              </>
            )}
          </Button>
          {(verif || brouillard) && (
            <Button
              variant="ghost"
              onClick={() => {
                setVerif(null);
                setBrouillard(null);
                setError(null);
              }}
              disabled={loading}
            >
              Réinitialiser
            </Button>
          )}
          {loading && (
            <span className="text-xs text-slate-500">
              Le brouillard contient ~160 000 lignes, l'analyse peut prendre 30-60 s.
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                // basePath est géré automatiquement par Next.js via `assetPrefix`/`basePath`
                // mais pour un fetch manuel, il faut l'ajouter manuellement
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
                const res = await fetch(`${basePath}/demo-result.json`);
                if (!res.ok) throw new Error("Demo indisponible");
                const data: AnalysisResult = await res.json();
                onAnalyzed(data);
                toast({
                  title: "Mode démo chargé",
                  description: `${data.verif.entityCount} entités, ${data.transfers.length} transferts proposés.`,
                });
              } catch (e: any) {
                setError(e?.message || "Erreur lors du chargement de la démo");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Charger la démo (résultat pré-calculé)
          </Button>
          <span className="text-xs text-slate-500">
            Permet de visualiser l'interface sans avoir à uploader les fichiers.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
