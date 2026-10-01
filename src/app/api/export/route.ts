import { NextRequest, NextResponse } from "next/server";
import { parseVerifBG, parseBrouillard } from "@/lib/accounting/parser";
import { analyze } from "@/lib/accounting/engine";
import { buildExportWorkbook } from "@/lib/accounting/exporter";
import type { AnalysisResult } from "@/lib/accounting/engine";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/export
 * Deux modes :
 *   1. multipart/form-data avec 2 fichiers (verif + brouillard) : on re-parse et on ré-analyse.
 *   2. application/json : on reçoit directement l'AnalysisResult déjà calculé.
 *
 * Retourne : un fichier Excel xlsx avec les écritures de transfert 580001.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let result: AnalysisResult;

    if (contentType.includes("application/json")) {
      // Mode 2 : on reçoit directement l'AnalysisResult
      const body = (await req.json()) as AnalysisResult;
      if (!body || !body.verif || !body.brouillard || !Array.isArray(body.transfers)) {
        return NextResponse.json(
          { error: "JSON invalide : AnalysisResult attendu." },
          { status: 400 }
        );
      }
      result = body;
    } else {
      // Mode 1 : multipart/form-data
      const form = await req.formData();
      const verifFile = form.get("verif") as File | null;
      const brouFile = form.get("brouillard") as File | null;
      if (!verifFile || !brouFile) {
        return NextResponse.json(
          { error: "Les 2 fichiers (verif + brouillard) sont requis." },
          { status: 400 }
        );
      }
      const verifBuf = await verifFile.arrayBuffer();
      const brouBuf = await brouFile.arrayBuffer();
      const verif = parseVerifBG(verifBuf);
      const brouillard = parseBrouillard(brouBuf);
      result = analyze(verif, brouillard);
    }

    const xlsxBuffer = buildExportWorkbook(result);

    return new NextResponse(xlsxBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Export_Verif_BG_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("[/api/export] ERROR", err);
    return NextResponse.json(
      { error: err?.message || "Erreur lors de l'export." },
      { status: 500 }
    );
  }
}
