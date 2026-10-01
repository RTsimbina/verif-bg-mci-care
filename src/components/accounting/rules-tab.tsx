"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, KeyRound, History, BookOpen } from "lucide-react";
import { GROUPED_ENTITIES, SPECIFIC_512, SANLAM_HISTORY } from "@/lib/accounting/rules";

export function RulesTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-slate-500" />
            Règles de gestion comptable — Comptes 512
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <p>
            La logique centrale repose sur l'identification et le regroupement des entités
            partageant les mêmes comptes bancaires (512). La règle d'or pour le compte 512
            se base sur la correspondance des <strong>3 derniers chiffres</strong> du numéro
            de compte. Les règles ci-dessous sont codées en dur dans le moteur et appliquées
            automatiquement lors de l'analyse.
          </p>
        </CardContent>
      </Card>

      {/* 1. Regroupements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-emerald-600" />
            1. Regroupements par compte 512 partagé
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {GROUPED_ENTITIES.map((group, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                {group.map((e, idx) => (
                  <span key={e} className="flex items-center gap-2">
                    <Badge className="bg-slate-900 text-white">{e}</Badge>
                    {idx < group.length - 1 && (
                      <span className="text-slate-400">↔</span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Ces entités sont lettrées entre elles : un transfert depuis le 512 de l'une
            doit être régularisé par une écriture 580001 vers le 512 de l'autre.
          </p>
        </CardContent>
      </Card>

      {/* 2. Affectations spécifiques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-amber-600" />
            2. Affectations spécifiques de comptes 512
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(SPECIFIC_512).map(([entity, compte]) => (
              <div
                key={`${entity}-${compte}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
              >
                <span className="font-medium text-slate-800">{entity}</span>
                <span className="font-mono text-sm font-bold text-amber-700">
                  {compte}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3. Historique SANLAM */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-sky-600" />
            3. Règle d'évolution historique — Cas SANLAMALLIANZ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Par le passé
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">SANLAMALLIANZ AUTOFI → 512100</Badge>
                <Badge variant="outline">SANLAMALLIANZ COMPAGNIE → 512100</Badge>
              </div>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                Actuellement
              </div>
              <div className="mt-2 space-y-1 text-sm">
                {Object.entries(SANLAM_HISTORY).map(([entity, compte]) => (
                  <div key={entity} className="flex items-center gap-2">
                    <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                      {entity}
                    </Badge>
                    <span className="text-slate-400">→</span>
                    <span className="font-mono font-bold text-sky-800">{compte}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Types d'opérations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-slate-600" />
            4. Types d'opérations détectées automatiquement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Appels de fonds
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Comptes <span className="font-mono font-bold">460xxx</span> et{" "}
                <span className="font-mono font-bold">461xxx</span>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Paiements prestataires
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Comptes <span className="font-mono font-bold">467xxx</span>
              </div>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                Honoraires
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Comptes <span className="font-mono font-bold">462xxx</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
