import { NextRequest, NextResponse } from "next/server";
import { parseVerifBG, parseBrouillard } from "@/lib/accounting/parser";
import { analyze } from "@/lib/accounting/engine";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min pour parser le gros brouillard

/**
 * POST /api/analyze
 * Body: multipart/form-data avec 2 fichiers :
 *   - verif : Verif BG*.xlsx
 *   - brouillard : Brouillard*.xlsx
 *
 * Retourne : JSON AnalysisResult
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const verifFile = form.get("verif") as File | null;
    const brouFile = form.get("brouillard") as File | null;
    if (!verifFile || !brouFile) {
      return NextResponse.json(
        { error: "Les 2 fichiers (verif + brouillard) sont requis." },
        { status: 400 }
      );
    }
    // Verif file est petit (~200 Ko), on lit en mémoire
    const verifBuf = await verifFile.arrayBuffer();
    const brouBuf = await brouFile.arrayBuffer();

    const verif = parseVerifBG(verifBuf);
    const brouillard = parseBrouillard(brouBuf);
    const result = analyze(verif, brouillard);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/analyze] ERROR", err);
    return NextResponse.json(
      { error: err?.message || "Erreur lors de l'analyse." },
      { status: 500 }
    );
  }
}
