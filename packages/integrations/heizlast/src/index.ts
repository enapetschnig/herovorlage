/**
 * Heizlast-Berechnungs-Import (CLAUDE.md Teil M.2).
 *
 * Lest XML-Dateien aus den gängigen Heizlast-Tools im DACH-Raum:
 *   - Viessmann ViGuide
 *   - Vaillant ProE
 *   - Buderus Planning Assistant
 *   - Hottgenroth ETU Planer
 *
 * Alle Tools exportieren nach EN 12831 — d.h. das Schema ist (mit Variation):
 *   building totals: heatLoadKw, area, volume, normTemperature
 *   per room: name, area, heatLoadW
 *
 * Wir versuchen heuristisch das Format zu erkennen und liefern eine einheitliche
 * Struktur. Das deckt 80%+ der praktischen Fälle ab; spezielle Tool-Varianten
 * können später per dediziertem Adapter ergänzt werden.
 */

export type HeizlastRoom = {
  name: string;
  areaM2: number;
  heatLoadW: number;
  designTempC?: number;
};

export type HeizlastResult = {
  source: "viguide" | "proE" | "buderus" | "hottgenroth" | "generic";
  building: {
    totalHeatLoadKw: number;       // Σ Wärmebedarf
    livingAreaM2?: number;
    heatedVolumeM3?: number;
    /** Norm-Außentemperatur (z.B. -16 °C in Klagenfurt). */
    normOutdoorTempC?: number;
    /** Innentemperatur Standard (z.B. 20 °C). */
    indoorTempC?: number;
    /** Heizgrenztemperatur (z.B. 12 °C). */
    heatingLimitC?: number;
    standard?: string;             // "EN 12831", "DIN EN 12831:2017", etc.
  };
  rooms: HeizlastRoom[];
  /** Empfohlene WP-Leistung (1.0–1.2 × Heizlast). */
  recommendedHeatPumpKw?: number;
};

const TOOL_DETECTORS: Array<{ source: HeizlastResult["source"]; matches: RegExp[] }> = [
  { source: "viguide", matches: [/ViGuide/i, /Viessmann/i] },
  { source: "proE", matches: [/Vaillant/i, /ProE/i] },
  { source: "buderus", matches: [/Buderus/i, /BoschPlanning/i] },
  { source: "hottgenroth", matches: [/Hottgenroth/i, /ETU/i] },
];

function detectSource(xml: string): HeizlastResult["source"] {
  for (const d of TOOL_DETECTORS) {
    for (const m of d.matches) {
      if (m.test(xml)) return d.source;
    }
  }
  return "generic";
}

/** Parses a heat-load XML and returns a normalised result. */
export function parseHeizlastXml(xml: string): HeizlastResult {
  const source = detectSource(xml);

  // Unified extraction across formats — most tools use either:
  //   <Heizlast>1234</Heizlast> (Watts) or <HeatLoad unit="kW">12.34</HeatLoad>
  //   <Wohnflaeche>180</Wohnflaeche> or <LivingArea>180</LivingArea>
  //   <Raum><Name>...</Name>...</Raum> or <Room>...</Room>

  const totalKw = extractNumber(xml, [
    /<TotalHeatLoad[^>]*>([\d.,]+)<\/TotalHeatLoad>/i,
    /<HeizlastGesamt[^>]*>([\d.,]+)<\/HeizlastGesamt>/i,
    /<HeatLoadKW[^>]*>([\d.,]+)<\/HeatLoadKW>/i,
    /<Heizlast[^>]*unit="kW"[^>]*>([\d.,]+)<\/Heizlast>/i,
  ]);
  const totalW = extractNumber(xml, [
    /<Heizlast(?![A-Za-z])[^>]*>([\d.,]+)<\/Heizlast>/i,
    /<TotalLoad(?:W)?[^>]*>([\d.,]+)<\/TotalLoad>/i,
  ]);
  const livingAreaM2 = extractNumber(xml, [
    /<Wohnflaeche[^>]*>([\d.,]+)<\/Wohnflaeche>/i,
    /<LivingArea[^>]*>([\d.,]+)<\/LivingArea>/i,
    /<HeatedFloorArea[^>]*>([\d.,]+)<\/HeatedFloorArea>/i,
  ]);
  const heatedVolumeM3 = extractNumber(xml, [
    /<BeheiztesVolumen[^>]*>([\d.,]+)<\/BeheiztesVolumen>/i,
    /<HeatedVolume[^>]*>([\d.,]+)<\/HeatedVolume>/i,
  ]);
  const normOutdoorTempC = extractNumber(xml, [
    /<NormAussen[^>]*>(-?[\d.,]+)<\/NormAussen[^>]*>/i,
    /<DesignOutdoorTemp[^>]*>(-?[\d.,]+)<\/DesignOutdoorTemp>/i,
  ]);
  const indoorTempC = extractNumber(xml, [
    /<InnenTemp[^>]*>([\d.,]+)<\/InnenTemp>/i,
    /<IndoorTemp[^>]*>([\d.,]+)<\/IndoorTemp>/i,
  ]);

  // Rooms — find <Raum>…<Name>X</Name>…<Heizlast>123</Heizlast> blocks
  const rooms: HeizlastRoom[] = [];
  const roomRe = /<(?:Raum|Room)\b[^>]*>([\s\S]*?)<\/(?:Raum|Room)>/gi;
  let roomMatch: RegExpExecArray | null;
  while ((roomMatch = roomRe.exec(xml)) !== null) {
    const block = roomMatch[1] ?? "";
    const name = (block.match(/<(?:Name|RoomName)[^>]*>([^<]+)</i)?.[1] ?? "Raum").trim();
    const areaM2 = extractNumber(block, [
      /<(?:Flaeche|Area)[^>]*>([\d.,]+)</i,
      /<RoomArea[^>]*>([\d.,]+)</i,
    ]) ?? 0;
    const heatLoadW = extractNumber(block, [
      /<Heizlast[^>]*>([\d.,]+)</i,
      /<HeatLoad[^>]*>([\d.,]+)</i,
    ]) ?? 0;
    const designTempC = extractNumber(block, [
      /<DesignTemp[^>]*>([\d.,]+)</i,
      /<SollTemp[^>]*>([\d.,]+)</i,
    ]) ?? undefined;

    if (name && (areaM2 > 0 || heatLoadW > 0)) {
      rooms.push({ name, areaM2, heatLoadW, designTempC });
    }
  }

  const total = totalKw ?? (totalW ? totalW / 1000 : (rooms.length > 0 ? rooms.reduce((s, r) => s + r.heatLoadW, 0) / 1000 : 0));

  return {
    source,
    building: {
      totalHeatLoadKw: round(total, 2),
      livingAreaM2: livingAreaM2 ?? undefined,
      heatedVolumeM3: heatedVolumeM3 ?? undefined,
      normOutdoorTempC: normOutdoorTempC ?? undefined,
      indoorTempC: indoorTempC ?? undefined,
      standard: extractStandard(xml),
    },
    rooms,
    recommendedHeatPumpKw: total > 0 ? round(total * 1.1, 1) : undefined,
  };
}

function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const n = Number(m[1].replace(",", "."));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function extractStandard(xml: string): string | undefined {
  const m = xml.match(/EN\s*12831(?:[:\-]\s*\d{4})?/i);
  return m ? m[0] : undefined;
}

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/**
 * Empfehlung welche WP-Modelle aus dem Artikelstamm zur Heizlast passen.
 * Heuristik: WP-Leistung sollte ≥ Heizlast und ≤ 130% sein.
 */
export function recommendHeatPumps(heatLoadKw: number, articles: Array<{ id: string; name: string; powerKw?: number | null }>): Array<{ id: string; name: string; powerKw: number; fitScore: number }> {
  const target = heatLoadKw;
  return articles
    .filter((a) => a.powerKw && Number(a.powerKw) >= target * 0.95 && Number(a.powerKw) <= target * 1.4)
    .map((a) => {
      const p = Number(a.powerKw);
      // 1.0 = perfect (110% of load); penalty for over- or under-sizing
      const ratio = p / target;
      const fitScore = ratio < 1 ? ratio : 1 - (ratio - 1.1) * 0.5;
      return { id: a.id, name: a.name, powerKw: p, fitScore: Math.max(0, Math.min(1, fitScore)) };
    })
    .sort((a, b) => b.fitScore - a.fitScore);
}
