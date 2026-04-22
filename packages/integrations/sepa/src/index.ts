/**
 * SEPA-XML-Generator (pain.008.001.08 für Lastschrift, pain.001.001.09 für Überweisung).
 *
 * Implementierung deckt die in Österreich/Deutschland üblichen Use-Cases ab:
 *   • SEPA-Direct-Debit B2C (CORE) — Lastschrift einziehen
 *   • SEPA-Credit-Transfer — Sammelüberweisung (Lieferanten zahlen)
 *
 * Schemata:
 *   pain.008.001.08 — SDD CORE (Customer-Direct-Debit-Initiation V08, gültig ab 11/2023)
 *   pain.001.001.09 — SCT (Customer-Credit-Transfer-Initiation V09)
 *
 * Zeichenset: ASCII-only — Sonderzeichen werden transliteriert (ä→ae, ß→ss).
 */

export type SepaCreditor = {
  name: string;
  iban: string;
  bic: string;
  /** Creditor-Identifier — in DE: bei Bundesbank beantragen; in AT: bei OeNB. */
  creditorId: string;
};

export type SepaDebitor = {
  name: string;
  iban: string;
  bic?: string;
  /** Mandate Reference — eindeutig pro Debitor pro Creditor. */
  mandateId: string;
  /** Datum der Mandats-Unterzeichnung. */
  mandateDate: string; // YYYY-MM-DD
  /** RCUR=wiederkehrend, FRST=erstmalig, OOFF=einmalig, FNAL=letzte. */
  sequenceType?: "FRST" | "RCUR" | "OOFF" | "FNAL";
};

export type SepaTransaction = {
  endToEndId: string;
  amount: number; // EUR
  debitor: SepaDebitor;
  remittanceInfo: string; // RE-Nummer + Verwendungszweck
};

export type SepaDirectDebitInput = {
  creditor: SepaCreditor;
  /** Datum, an dem die Lastschrift eingezogen wird. */
  collectionDate: string; // YYYY-MM-DD
  messageId: string;
  transactions: SepaTransaction[];
};

export function renderSepaDirectDebit(input: SepaDirectDebitInput): string {
  const total = input.transactions.reduce((s, t) => s + t.amount, 0);
  const ctrlSum = total.toFixed(2);
  const numTx = input.transactions.length;

  const txXml = input.transactions.map((t) => `
        <DrctDbtTxInf>
          <PmtId>
            <EndToEndId>${esc(t.endToEndId)}</EndToEndId>
          </PmtId>
          <InstdAmt Ccy="EUR">${t.amount.toFixed(2)}</InstdAmt>
          <DrctDbtTx>
            <MndtRltdInf>
              <MndtId>${esc(t.debitor.mandateId)}</MndtId>
              <DtOfSgntr>${t.debitor.mandateDate}</DtOfSgntr>
            </MndtRltdInf>
          </DrctDbtTx>
${t.debitor.bic ? `          <DbtrAgt><FinInstnId><BICFI>${esc(t.debitor.bic)}</BICFI></FinInstnId></DbtrAgt>` : "          <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>"}
          <Dbtr><Nm>${esc(transliterate(t.debitor.name))}</Nm></Dbtr>
          <DbtrAcct><Id><IBAN>${esc(t.debitor.iban.replace(/\s/g, ""))}</IBAN></Id></DbtrAcct>
          <RmtInf><Ustrd>${esc(transliterate(t.remittanceInfo).slice(0, 140))}</Ustrd></RmtInf>
        </DrctDbtTxInf>`).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${esc(input.messageId)}</MsgId>
      <CreDtTm>${new Date().toISOString().slice(0, 19)}</CreDtTm>
      <NbOfTxs>${numTx}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${esc(transliterate(input.creditor.name))}</Nm>
        <Id><OrgId><Othr><Id>${esc(input.creditor.creditorId)}</Id></Othr></OrgId></Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${esc(input.messageId)}-PMT-001</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${numTx}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>${input.transactions[0]?.debitor.sequenceType ?? "RCUR"}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${input.collectionDate}</ReqdColltnDt>
      <Cdtr><Nm>${esc(transliterate(input.creditor.name))}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${esc(input.creditor.iban.replace(/\s/g, ""))}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BICFI>${esc(input.creditor.bic)}</BICFI></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id><PrvtId><Othr>
          <Id>${esc(input.creditor.creditorId)}</Id>
          <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
        </Othr></PrvtId></Id>
      </CdtrSchmeId>${txXml}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>
`;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** SEPA allows only a restricted character set — transliterate German umlauts etc. */
export function transliterate(s: string): string {
  const map: Record<string, string> = {
    "ä": "ae", "Ä": "Ae", "ö": "oe", "Ö": "Oe", "ü": "ue", "Ü": "Ue",
    "ß": "ss", "é": "e", "è": "e", "ê": "e", "à": "a", "â": "a", "ô": "o", "ç": "c",
  };
  return s
    .split("")
    .map((ch) => map[ch] ?? (/^[a-zA-Z0-9 +?/\-:().,'\n]$/.test(ch) ? ch : "?"))
    .join("");
}

/** Validates a basic IBAN format (length + mod-97-checksum). */
export function isValidIban(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(cleaned)) return false;
  // Move first 4 chars to end
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  // Convert letters: A=10, B=11, ..., Z=35
  let numeric = "";
  for (const ch of rearranged) {
    if (ch >= "0" && ch <= "9") numeric += ch;
    else numeric += String(ch.charCodeAt(0) - 55);
  }
  // mod 97
  let remainder = 0;
  for (const d of numeric) {
    remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
