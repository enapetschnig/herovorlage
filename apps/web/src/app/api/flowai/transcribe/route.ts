import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@heatflow/auth";
import { transcribeAudio } from "@heatflow/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("audio");
  const language = (formData.get("language") as string | null) ?? "de";
  const prompt = (formData.get("prompt") as string | null) ?? "Wärmepumpe, Pufferspeicher, Vitocal, Vaillant, Kunde, Adresse";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio too large (max 25 MB — Whisper limit)" }, { status: 413 });
  }

  try {
    const buf = await file.arrayBuffer();
    const result = await transcribeAudio({
      audio: buf,
      filename: file.name || "memo.webm",
      mediaType: file.type || "audio/webm",
      language,
      prompt,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
