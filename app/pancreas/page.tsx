"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * radiology-clean-standalone • PANCREAS module (/pancreas)
 * - Default modality: USG + BT + MR
 * - Default scope: Acute pancreatitis + complications + infection + solid/cystic mass
 * - Engines: feature-strength scoring, ddx, protocol assistant, report builder, hint boxes
 *
 * Not: Bu bir klinik karar destek iskeletidir; kurum protokolleri + klinik/lab korelasyonu esastır.
 */

// -----------------------------
// Helpers
// -----------------------------
type Likelihood = "Yüksek" | "Orta" | "Düşük";
type Urgency = "Acil" | "Öncelikli" | "Rutin";
type DdxItem = { name: string; likelihood: Likelihood; why?: string[]; score?: number };
type RecItem = { title: string; urgency?: Urgency; details?: string[]; autoApply?: () => void };

function toNum(x: string) {
  const v = Number(String(x || "").replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function joinNice(arr: string[]) {
  return arr.filter(Boolean).join(", ");
}
function bulletList(xs?: string[], max = 4) {
  const a = (xs || []).filter(Boolean).slice(0, max);
  if (!a.length) return null;
  return (
    <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
      {a.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
function LikelihoodBadge({ l }: { l: Likelihood }) {
  return <Badge variant={l === "Yüksek" ? "default" : l === "Orta" ? "secondary" : "outline"}>{l}</Badge>;
}
function UrgencyBadge({ u }: { u?: Urgency }) {
  if (!u) return null;
  return <Badge variant={u === "Acil" ? "default" : u === "Öncelikli" ? "secondary" : "outline"}>{u}</Badge>;
}

// -----------------------------
// Types
// -----------------------------
type Modality = "USG" | "BT" | "MR";
type ModalitySet = { USG: boolean; BT: boolean; MR: boolean };

type ContrastCT = "NCCT" | "CECT_PANCREAS_PROTOCOL" | "CTA_HEMORRHAGE";
type MRMode = "NONCONTRAST" | "DYNAMIC_CONTRAST";
type Scenario = "PANKREAS_PATOLOJILERI";

type APSeverity = "HAFIF" | "ORTA_AGIR" | "AGIR";
type APTime = "<48-72s" | ">=48-72s" | "Bilinmiyor";

type Complication =
  | "Yok"
  | "Nekroz_suspect"
  | "APFC" // acute peripancreatic fluid collection
  | "ANC" // acute necrotic collection
  | "Psodokist"
  | "WON"
  | "Enfekte_nekroz_abse"
  | "Kanama_pseudoanevrizma"
  | "Venoz_tromboz_splenik_portal_SMV"
  | "Biliyer_obstruksiyon_kolangit"
  | "Barsak_iskemisi_suspect";

type MassType = "Yok" | "Solid" | "Kistik";

type Location = "Bas" | "Govde" | "Kuyruk" | "Uncinate" | "Diffuz" | "Belirsiz";

type Enhancement = "Bilinmiyor" | "Hipoenhans" | "Arteriyel_hiper" | "Delayed_fibrotik";
type DuctSign = "Yok" | "Double_duct" | "Wirsung_dil" | "Cutoff";
type VesselContact = "Yok" | "Abutment" | "Encase";

type CystSubtype = "Belirsiz" | "Psodokist" | "IPMN" | "Seröz" | "Müsinöz" | "SPN";
type SolidSubtype = "Belirsiz" | "PDAC" | "NET" | "Fokal_pankreatit" | "AIP" | "Lenfoma" | "Metastaz";

type Feature = { key: string; label: string; weight: number };

// -----------------------------
// Main component
// -----------------------------
export default function Page() {
  // Header / nav
  const [scenario] = useState<Scenario>("PANKREAS_PATOLOJILERI");

  // Default modality: all selected
  const [mods, setMods] = useState<ModalitySet>({ USG: true, BT: true, MR: true });

  // Context
  const [ctxFeverSepsis, setCtxFeverSepsis] = useState(false);
  const [ctxImmunosupp, setCtxImmunosupp] = useState(false);
  const [ctxKnownMalignancy, setCtxKnownMalignancy] = useState(false);
  const [ctxTrauma, setCtxTrauma] = useState(false);
  const [ctxAlcohol, setCtxAlcohol] = useState(false);
  const [ctxHyperTG, setCtxHyperTG] = useState(false);
  const [ctxBiliarySuspected, setCtxBiliarySuspected] = useState(false);

  // CT / MR protocol states (assistant can auto-apply)
  const [ctPreset, setCtPreset] = useState<ContrastCT>("NCCT");
  const [mrMode, setMrMode] = useState<MRMode>("NONCONTRAST");
  const [mrDWI, setMrDWI] = useState(true); // core
  const [mrSWI, setMrSWI] = useState(false);
  const [mrMRCP, setMrMRCP] = useState(true); // core for pancreas module
  const [mrPerfusion, setMrPerfusion] = useState(false);
  const [mrMRS, setMrMRS] = useState(false);

  // Acute pancreatitis
  const [hasAP, setHasAP] = useState(true);
  const [apSeverity, setApSeverity] = useState<APSeverity>("HAFIF");
  const [apTime, setApTime] = useState<APTime>("Bilinmiyor");
  const [hasPeripancreaticStranding, setHasPeripancreaticStranding] = useState(true);
  const [hasFluidCollection, setHasFluidCollection] = useState(false);
  const [hasGasInCollection, setHasGasInCollection] = useState(false);

  // Complications
  const [complication, setComplication] = useState<Complication>("Yok");

  // Mass
  const [massType, setMassType] = useState<MassType>("Yok");
  const [massLoc, setMassLoc] = useState<Location>("Belirsiz");
  const [massSizeMm, setMassSizeMm] = useState("");
  const [enhancement, setEnhancement] = useState<Enhancement>("Bilinmiyor");
  const [ductSign, setDuctSign] = useState<DuctSign>("Yok");
  const [vesselContact, setVesselContact] = useState<VesselContact>("Yok");
  const [restrictedDiffusion, setRestrictedDiffusion] = useState(false);
  const [t2IsoHypo, setT2IsoHypo] = useState(false);
  const [calcifications, setCalcifications] = useState(false);
  const [atrophyUpstream, setAtrophyUpstream] = useState(false);
  const [solidSubtype, setSolidSubtype] = useState<SolidSubtype>("Belirsiz");

  // Cyst
  const [cystSubtype, setCystSubtype] = useState<CystSubtype>("Belirsiz");
  const [cystDuctCommunication, setCystDuctCommunication] = useState(false);
  const [cystMuralNodule, setCystMuralNodule] = useState(false);
  const [mainDuctMm, setMainDuctMm] = useState("");
  const [microcysticHoneycomb, setMicrocysticHoneycomb] = useState(false);

  // AIP hints
  const [aipCapsuleRim, setAipCapsuleRim] = useState(false);
  const [aipDiffuseSausage, setAipDiffuseSausage] = useState(false);

  // Free text
  const [incidental, setIncidental] = useState("");

  // Output style
  const [style, setStyle] = useState<"Kısa" | "Detaylı">("Detaylı");
  const [includeProbabilityLanguage, setIncludeProbabilityLanguage] = useState(true);
  const [includeRecommendationsLanguage, setIncludeRecommendationsLanguage] = useState(true);

  // -----------------------------
  // Feature-strength scoring
  // -----------------------------
  const features = useMemo(() => {
    const feats: Feature[] = [];

    // AP core
    if (hasAP) {
      feats.push({ key: "AP", label: "Akut pankreatit bulguları", weight: 2 });
      if (hasPeripancreaticStranding) feats.push({ key: "STR", label: "Peripankreatik inflamasyon/stranding", weight: 1 });
      if (hasFluidCollection) feats.push({ key: "COLL", label: "Koleksiyon/sıvı", weight: 1 });
      if (apSeverity === "AGIR") feats.push({ key: "SEV", label: "Ağır klinik/radyolojik seyir", weight: 2 });
      if (hasGasInCollection) feats.push({ key: "GAS", label: "Koleksiyonda gaz", weight: 3 });
    }

    // Biliary clues
    if (ctxBiliarySuspected) feats.push({ key: "BIL", label: "Biliyer etyoloji şüphesi", weight: 1 });

    // Mass clues
    if (massType === "Solid") {
      feats.push({ key: "SOL", label: "Solid kitle", weight: 2 });
      if (enhancement === "Hipoenhans") feats.push({ key: "HYPO", label: "Hipoenhans patern", weight: 2 });
      if (enhancement === "Arteriyel_hiper") feats.push({ key: "HYPER", label: "Arteriyel hipervasküler patern", weight: 2 });
      if (ductSign === "Double_duct") feats.push({ key: "DD", label: "Double-duct bulgusu", weight: 3 });
      if (ductSign === "Cutoff") feats.push({ key: "CUT", label: "Duktal cutoff", weight: 2 });
      if (atrophyUpstream) feats.push({ key: "ATR", label: "Upstream atrofi", weight: 2 });
      if (restrictedDiffusion) feats.push({ key: "DWI", label: "Restriksiyon", weight: 2 });
      if (vesselContact !== "Yok") feats.push({ key: "VASC", label: `Vasküler temas (${vesselContact})`, weight: 2 });
      if (ctxKnownMalignancy) feats.push({ key: "MAL", label: "Bilinen malignite", weight: 1 });
      if (ctxImmunosupp) feats.push({ key: "IMM", label: "İmmünsüpresyon", weight: 1 });
      if (t2IsoHypo) feats.push({ key: "T2", label: "T2 izo/hipo eğilim", weight: 1 });
    }

    if (massType === "Kistik") {
      feats.push({ key: "CYS", label: "Kistik lezyon", weight: 1 });
      if (cystDuctCommunication) feats.push({ key: "COMM", label: "Duktal iletişim", weight: 2 });
      const md = toNum(mainDuctMm);
      if (!Number.isNaN(md) && md >= 5) feats.push({ key: "MD", label: `Ana kanal dilatasyonu (${mainDuctMm} mm)`, weight: md >= 10 ? 3 : 2 });
      if (cystMuralNodule) feats.push({ key: "MN", label: "Mural nodül", weight: 3 });
      if (microcysticHoneycomb) feats.push({ key: "HCOMB", label: "Mikrokistik/honeycomb", weight: 2 });
      if (hasAP) feats.push({ key: "APCYS", label: "Pankreatit zemini (psödokist lehine)", weight: 1 });
    }

    // AIP
    if (aipCapsuleRim) feats.push({ key: "AIPRIM", label: "Kapsül-benzeri rim", weight: 2 });
    if (aipDiffuseSausage) feats.push({ key: "AIPSAU", label: "Diffuse ‘sausage-like’ görünüm", weight: 2 });
    if (enhancement === "Delayed_fibrotik") feats.push({ key: "DELAY", label: "Delayed/fibrotik tutulum paterni", weight: 2 });

    // Infection/sepsis
    if (ctxFeverSepsis) feats.push({ key: "SEPS", label: "Ateş/sepsis", weight: 2 });

    return feats;
  }, [
    hasAP,
    apSeverity,
    hasPeripancreaticStranding,
    hasFluidCollection,
    hasGasInCollection,
    ctxBiliarySuspected,
    massType,
    enhancement,
    ductSign,
    atrophyUpstream,
    restrictedDiffusion,
    vesselContact,
    ctxKnownMalignancy,
    ctxImmunosupp,
    t2IsoHypo,
    cystDuctCommunication,
    mainDuctMm,
    cystMuralNodule,
    microcysticHoneycomb,
    aipCapsuleRim,
    aipDiffuseSausage,
    ctxFeverSepsis,
  ]);

  // -----------------------------
  // DDX engine (weighted)
  // -----------------------------
  const ddx = useMemo<DdxItem[]>(() => {
    const out: DdxItem[] = [];

    const hasBT = mods.BT;
    const hasMR = mods.MR;
    const hasUSG = mods.USG;

    // --- Acute pancreatitis
    if (hasAP) {
      const score = 6 + (hasPeripancreaticStranding ? 2 : 0) + (hasFluidCollection ? 1 : 0) + (apSeverity === "AGIR" ? 2 : 0);
      out.push({
        name: "Akut pankreatit",
        likelihood: score >= 8 ? "Yüksek" : "Orta",
        score,
        why: [
          hasPeripancreaticStranding ? "Peripankreatik inflamasyon/stranding" : "",
          hasFluidCollection ? "Sıvı/koleksiyon eşlik ediyor" : "",
          apSeverity === "AGIR" ? "Ağır seyir/komplikasyon olasılığı" : "",
        ].filter(Boolean),
      });

      if (ctxBiliarySuspected) {
        out.push({
          name: "Biliyer etyoloji (safra taşına bağlı pankreatit)",
          likelihood: hasUSG || hasMR ? "Orta" : "Düşük",
          score: 5 + (ctxBiliarySuspected ? 2 : 0),
          why: ["Biliyer şüphe", "USG/MRCP ile koledok taş/dilatasyon korelasyonu değerli"],
        });
      }
      if (ctxAlcohol) {
        out.push({ name: "Alkole bağlı pankreatit", likelihood: "Orta", score: 4, why: ["Alkol öyküsü"] });
      }
      if (ctxHyperTG) {
        out.push({ name: "Hipertrigliseridemi ilişkili pankreatit", likelihood: "Orta", score: 4, why: ["HiperTG öyküsü/lab ile korelasyon"] });
      }
      if (ctxTrauma) {
        out.push({ name: "Travma ilişkili pankreatit", likelihood: "Orta", score: 4, why: ["Travma öyküsü"] });
      }
    }

    // --- Complications
    const addComp = (name: string, l: Likelihood, why: string[], score: number) => out.push({ name, likelihood: l, why, score });
    if (complication !== "Yok") {
      if (complication === "Nekroz_suspect") addComp("Nekrotizan pankreatit (şüphe)", "Orta", ["Klinik ağır seyir / kontrastlanmayan alan şüphesi"], 6);
      if (complication === "APFC") addComp("Akut peripankreatik sıvı koleksiyonu (APFC)", "Orta", ["Erken dönemde homojen sıvı koleksiyonu ile uyumlu olabilir"], 5);
      if (complication === "ANC") addComp("Akut nekrotik koleksiyon (ANC)", "Orta", ["Nekrotik debris içeren koleksiyon lehine"], 6);
      if (complication === "Psodokist") addComp("Psödokist", "Orta", [">4 hafta / kapsüllü koleksiyon lehine olabilir"], 5);
      if (complication === "WON") addComp("Walled-off necrosis (WON)", "Orta", ["Organize nekrotik koleksiyon lehine"], 6);
      if (complication === "Enfekte_nekroz_abse") addComp("Enfekte nekroz/apse", hasGasInCollection || ctxFeverSepsis ? "Yüksek" : "Orta", ["Koleksiyonda gaz ve/veya sepsis"], 8);
      if (complication === "Kanama_pseudoanevrizma") addComp("Psödoanevrizma/aktif kanama şüphesi", "Orta", ["Kanama/vasküler komplikasyon şüphesi"], 7);
      if (complication === "Venoz_tromboz_splenik_portal_SMV") addComp("Splenik/portal/SMV trombozu", "Orta", ["Pankreatit ilişkili venöz tromboz görülebilir"], 6);
      if (complication === "Biliyer_obstruksiyon_kolangit") addComp("Biliyer obstrüksiyon/kolanjit şüphesi", "Orta", ["Obstrüksiyon bulguları + klinik ile korelasyon"], 6);
      if (complication === "Barsak_iskemisi_suspect") addComp("Barsak iskemisi (komplikasyon şüphesi)", "Düşük", ["Ağır inflamasyon/vasküler etkilenim varlığında"], 4);
    }

    // --- Infection toggle (independent)
    if (ctxFeverSepsis || hasGasInCollection) {
      out.push({
        name: "Enfekte koleksiyon olasılığı",
        likelihood: hasGasInCollection ? "Yüksek" : "Orta",
        score: 7 + (hasGasInCollection ? 2 : 0),
        why: [hasGasInCollection ? "Koleksiyonda gaz" : "", ctxFeverSepsis ? "Ateş/sepsis" : "", ctxImmunosupp ? "İmmünsüpresyon" : ""].filter(Boolean),
      });
    }

    // --- Cystic mass
    if (massType === "Kistik") {
      const md = toNum(mainDuctMm);
      const mdHighRisk = !Number.isNaN(md) && md >= 10;

      out.push({ name: "Kistik pankreas lezyonu", likelihood: "Orta", score: 4, why: ["Duktal iletişim/mural nodül/kanal çapı ile ddx daralır"] });

      const ipmnScore = (cystDuctCommunication ? 4 : 0) + (!Number.isNaN(md) && md >= 5 ? 3 : 0) + (cystMuralNodule ? 4 : 0);
      if (cystSubtype === "IPMN" || cystDuctCommunication || ipmnScore >= 6) {
        out.push({
          name: "IPMN",
          likelihood: ipmnScore >= 8 || mdHighRisk || cystMuralNodule ? "Yüksek" : "Orta",
          score: 5 + ipmnScore,
          why: [
            cystDuctCommunication ? "Duktal iletişim" : "",
            !Number.isNaN(md) && md >= 5 ? `Ana kanal dilatasyonu (${mainDuctMm} mm)` : "",
            cystMuralNodule ? "Mural nodül" : "",
          ].filter(Boolean),
        });
      }

      if (cystSubtype === "Seröz" || microcysticHoneycomb) {
        out.push({
          name: "Seröz kistadenom",
          likelihood: microcysticHoneycomb ? "Yüksek" : "Orta",
          score: 7,
          why: [microcysticHoneycomb ? "Mikrokistik/honeycomb patern" : "Benign mikrokistik patern ile uyumlu olabilir"],
        });
      }

      if (cystSubtype === "Müsinöz") {
        out.push({
          name: "Müsinöz kistik neoplazi",
          likelihood: "Orta",
          score: 6,
          why: ["Makrokistik lezyon + duktal iletişimin olmaması lehine bulgular varsa"],
        });
      }

      if (cystSubtype === "SPN") {
        out.push({
          name: "Solid psödopapiller neoplazi (SPN)",
          likelihood: "Orta",
          score: 6,
          why: ["Solid-kistik komponent + kapsüllü görünüm ile düşünülebilir"],
        });
      }

      if (cystSubtype === "Psodokist" || hasAP) {
        out.push({
          name: "Psödokist",
          likelihood: hasAP ? "Orta" : "Düşük",
          score: hasAP ? 6 : 3,
          why: ["Pankreatit zemini ile ilişkili olabilir"],
        });
      }
    }

    // --- Solid mass
    if (massType === "Solid") {
      const size = toNum(massSizeMm);
      const pdacScore =
        (enhancement === "Hipoenhans" ? 4 : 0) +
        (ductSign === "Double_duct" ? 5 : 0) +
        (ductSign === "Cutoff" ? 3 : 0) +
        (atrophyUpstream ? 3 : 0) +
        (vesselContact !== "Yok" ? 3 : 0);

      out.push({
        name: "Pankreas duktal adenokarsinom (PDAC)",
        likelihood: pdacScore >= 10 || solidSubtype === "PDAC" ? "Yüksek" : "Orta",
        score: 5 + pdacScore,
        why: [
          enhancement === "Hipoenhans" ? "Hipovasküler/hipoenhans patern" : "",
          ductSign === "Double_duct" ? "Double-duct bulgusu" : "",
          ductSign === "Cutoff" ? "Duktal cutoff" : "",
          atrophyUpstream ? "Upstream atrofi" : "",
          vesselContact !== "Yok" ? `Vasküler temas: ${vesselContact}` : "",
          Number.isFinite(size) && size > 0 ? `Boyut: ${massSizeMm} mm` : "",
        ].filter(Boolean),
      });

      const netScore = (enhancement === "Arteriyel_hiper" ? 5 : 0) + (restrictedDiffusion ? 2 : 0);
      out.push({
        name: "Nöroendokrin tümör (NET)",
        likelihood: netScore >= 6 || solidSubtype === "NET" ? "Yüksek" : "Orta",
        score: 4 + netScore,
        why: [enhancement === "Arteriyel_hiper" ? "Arteriyel faz hipervasküler patern" : "", restrictedDiffusion ? "Restriksiyon eşlik edebilir" : ""].filter(Boolean),
      });

      const aipScore = (aipDiffuseSausage ? 4 : 0) + (aipCapsuleRim ? 4 : 0) + (enhancement === "Delayed_fibrotik" ? 3 : 0);
      if (aipScore >= 5 || solidSubtype === "AIP") {
        out.push({
          name: "Otoimmün pankreatit (AIP)",
          likelihood: aipScore >= 8 ? "Yüksek" : "Orta",
          score: 4 + aipScore,
          why: [
            aipDiffuseSausage ? "Diffuse ‘sausage-like’ görünüm" : "",
            aipCapsuleRim ? "Kapsül-benzeri rim" : "",
            enhancement === "Delayed_fibrotik" ? "Delayed/fibrotik tutulum" : "",
          ].filter(Boolean),
        });
      }

      const focScore = hasAP ? 5 : 2;
      out.push({
        name: "Fokal pankreatit / inflamatuar kitle",
        likelihood: hasAP ? "Orta" : "Düşük",
        score: focScore,
        why: [hasAP ? "Pankreatit zemini" : "Klinik/lab korelasyonu ile değerlendirilir"],
      });

      const lymphomaScore = (restrictedDiffusion ? 4 : 0) + (t2IsoHypo ? 2 : 0) + (ctxImmunosupp ? 2 : 0);
      if (lymphomaScore >= 5 || solidSubtype === "Lenfoma") {
        out.push({
          name: "Lenfoma",
          likelihood: lymphomaScore >= 7 ? "Orta" : "Düşük",
          score: 3 + lymphomaScore,
          why: [restrictedDiffusion ? "Belirgin restriksiyon" : "", t2IsoHypo ? "T2 izo/hipo eğilim" : "", ctxImmunosupp ? "İmmünsüpresyon" : ""].filter(Boolean),
        });
      }

      if (ctxKnownMalignancy || solidSubtype === "Metastaz") {
        out.push({
          name: "Metastaz",
          likelihood: ctxKnownMalignancy ? "Orta" : "Düşük",
          score: ctxKnownMalignancy ? 6 : 3,
          why: [ctxKnownMalignancy ? "Bilinen malignite öyküsü" : ""].filter(Boolean),
        });
      }
    }

    // Rank + cap
    const rank = (l: Likelihood) => (l === "Yüksek" ? 0 : l === "Orta" ? 1 : 2);
    return out
      .filter((x) => x.name)
      .sort((a, b) => rank(a.likelihood) - rank(b.likelihood) || (b.score || 0) - (a.score || 0))
      .slice(0, style === "Detaylı" ? 14 : 8);
  }, [
    mods.BT,
    mods.MR,
    mods.USG,
    hasAP,
    apSeverity,
    apTime,
    hasPeripancreaticStranding,
    hasFluidCollection,
    hasGasInCollection,
    complication,
    ctxBiliarySuspected,
    ctxAlcohol,
    ctxHyperTG,
    ctxTrauma,
    ctxFeverSepsis,
    ctxImmunosupp,
    massType,
    massLoc,
    massSizeMm,
    enhancement,
    ductSign,
    vesselContact,
    restrictedDiffusion,
    t2IsoHypo,
    atrophyUpstream,
    solidSubtype,
    cystSubtype,
    cystDuctCommunication,
    cystMuralNodule,
    mainDuctMm,
    microcysticHoneycomb,
    aipCapsuleRim,
    aipDiffuseSausage,
    ctxKnownMalignancy,
    style,
  ]);

  // -----------------------------
  // Smart protocol assistant + recommendations
  // -----------------------------
  const recs = useMemo<RecItem[]>(() => {
    const out: RecItem[] = [];
    const hasBT = mods.BT;
    const hasMR = mods.MR;
    const hasUSG = mods.USG;

    // Helper: auto-apply actions (like your brain protocol assistant)
    const applyCT_Pancreas = () => setCtPreset("CECT_PANCREAS_PROTOCOL");
    const applyCT_CTA = () => setCtPreset("CTA_HEMORRHAGE");
    const applyMR_Dynamic = () => setMrMode("DYNAMIC_CONTRAST");
    const applyMR_CoreTumor = () => {
      setMrDWI(true);
      setMrMRCP(true);
      setMrSWI(true);
      setMrPerfusion(true);
    };
    const applyMR_CoreInfection = () => {
      setMrDWI(true);
      setMrSWI(true);
      setMrMRCP(true);
      setMrPerfusion(false);
    };

    // Acute pancreatitis
    if (hasAP) {
      if (hasBT) {
        if (apSeverity === "HAFIF") {
          out.push({
            title: "Hafif akut pankreatitte erken BT rutin olmayabilir; klinik kötüleşme/komplike şüphede CECT tercih edilir",
            urgency: "Rutin",
            details: ["Klinik şiddete göre endikasyon", "Komplikasyon şüphesinde pankreas protokolü CECT"],
          });
        } else {
          out.push({
            title: "BT: Pankreas protokolü CECT öner",
            urgency: apSeverity === "AGIR" ? "Öncelikli" : "Rutin",
            details: [
              apTime === "<48-72s" ? "Erken dönemde nekroz değerlendirmesi sınırlı olabilir; klinik gereklilikle zamanlama" : "",
              apTime === ">=48-72s" ? "Nekroz/komplikasyon değerlendirmesi için 48–72s sonrası daha duyarlı" : "",
              "Portal venöz faz temel; komplikasyona göre arteriyel faz eklenebilir",
            ].filter(Boolean),
            autoApply: applyCT_Pancreas,
          });
        }
      }

      if (ctxBiliarySuspected) {
        if (hasUSG) {
          out.push({
            title: "USG: Safra kesesi/koledok taş ve dilatasyon değerlendirmesi",
            urgency: "Öncelikli",
            details: ["Biliyer etyolojide ilk basamak"],
          });
        }
        if (hasMR) {
          out.push({
            title: "MRCP öner (koledok taşı/striktür şüphesi)",
            urgency: "Öncelikli",
            details: ["ERCP endikasyonu klinikçe değerlendirilir"],
            autoApply: () => setMrMRCP(true),
          });
        }
      }
    }

    // Infection / infected necrosis
    const infectionLikely = ctxFeverSepsis || hasGasInCollection || complication === "Enfekte_nekroz_abse";
    if (infectionLikely) {
      if (hasBT) {
        out.push({
          title: "Enfekte nekroz/apse şüphesinde CECT + drenaj/örnekleme klinikçe değerlendir",
          urgency: "Acil",
          details: ["Koleksiyonda gaz / sepsis varsa"],
          autoApply: applyCT_Pancreas,
        });
      }
      if (hasMR) {
        out.push({
          title: "MR: DWI + SWI + MRCP (core) öner",
          urgency: "Öncelikli",
          details: ["Enfeksiyon/inflamasyon ayrımı ve komplikasyonlar için"],
          autoApply: applyMR_CoreInfection,
        });
      }
    }

    // Hemorrhage / pseudoaneurysm
    if (complication === "Kanama_pseudoanevrizma") {
      if (hasBT) {
        out.push({
          title: "BT: CTA (arteriyel faz) öner — psödoanevrizma/aktif kanama açısından",
          urgency: "Acil",
          details: ["IR/embolizasyon planlaması için"],
          autoApply: applyCT_CTA,
        });
      }
    }

    // Venous thrombosis
    if (complication === "Venoz_tromboz_splenik_portal_SMV") {
      out.push({
        title: "Portal venöz faz ile splenik/portal/SMV trombozu değerlendirmesi",
        urgency: "Öncelikli",
        details: ["Tromboz yaygınlığı ve komplikasyonlar için"],
      });
    }

    // Mass (solid/cystic) logic
    const massPresent = massType !== "Yok";
    if (massPresent) {
      // CT: if NCCT only and mass suspicion -> recommend CECT pancreas protocol
      if (hasBT && ctPreset === "NCCT") {
        out.push({
          title: "BT: NCCT seçili — kitle/enfeksiyon şüphesinde pankreas protokolü CECT öner",
          urgency: "Öncelikli",
          details: ["Kitle karakterizasyonu ve rezekabilite değerlendirmesi"],
          autoApply: applyCT_Pancreas,
        });
      }

      // MR core for mass
      if (hasMR) {
        out.push({
          title: "MR: DWI/SWI zorunlu + perfüzyon seçilmiş olguda öner",
          urgency: "Öncelikli",
          details: ["DWI/ADC tümör vs inflamasyon ayrımına katkı", "SWI hemorajik komponent ve vasküler yapı için", "Perfüzyon özellikle solid kitle karakterizasyonunda yardımcı olabilir"],
          autoApply: () => {
            setMrDWI(true);
            setMrSWI(true);
            setMrPerfusion(true);
          },
        });

        if (mrMode === "NONCONTRAST") {
          out.push({
            title: "MR: Dinamik kontrast (mümkünse) öner",
            urgency: "Öncelikli",
            details: ["PDAC (hipoenhans), NET (hipervasküler) gibi paternleri ayırmada kritik"],
            autoApply: applyMR_Dynamic,
          });
        }
      }

      // Cystic: MRCP emphasis
      if (massType === "Kistik" && hasMR && !mrMRCP) {
        out.push({
          title: "Kistik lezyonda MRCP öner",
          urgency: "Öncelikli",
          details: ["Duktal iletişim/IPMN risk stratifikasyonu için"],
          autoApply: () => setMrMRCP(true),
        });
      }

      // High-risk cystic features -> EUS
      const md = toNum(mainDuctMm);
      const highRiskCyst = (cystMuralNodule || (!Number.isNaN(md) && md >= 10)) && massType === "Kistik";
      if (highRiskCyst) {
        out.push({
          title: "Yüksek risk kistik bulgu: EUS ± örnekleme klinikçe değerlendir",
          urgency: "Öncelikli",
          details: ["Mural nodül / ana kanal belirgin dilatasyon vb."],
        });
      }

      // Solid suspicious for PDAC -> EUS
      if (massType === "Solid") {
        out.push({
          title: "Solid kitlede EUS ± biyopsi (klinikçe) değerlendir",
          urgency: "Öncelikli",
          details: ["Histopatolojik doğrulama / küçük lezyonlarda üstün"],
        });
      }
    }

    // AIP hint
    const aipStrong = (aipDiffuseSausage || aipCapsuleRim) && enhancement === "Delayed_fibrotik";
    if (aipStrong) {
      out.push({
        title: "AIP lehine patern: IgG4/otoimmün korelasyon öner",
        urgency: "Rutin",
        details: ["Klinik + seroloji + diğer organ bulguları ile"],
      });
    }

    // Deduplicate titles
    const uniq = new Map<string, RecItem>();
    out.forEach((r) => {
      if (!uniq.has(r.title)) uniq.set(r.title, r);
    });

    const rank = (u?: Urgency) => (u === "Acil" ? 0 : u === "Öncelikli" ? 1 : 2);
    return [...uniq.values()].sort((a, b) => rank(a.urgency) - rank(b.urgency));
  }, [
    mods.BT,
    mods.MR,
    mods.USG,
    hasAP,
    apSeverity,
    apTime,
    ctxBiliarySuspected,
    ctxFeverSepsis,
    ctxImmunosupp,
    massType,
    ctPreset,
    mrMode,
    mrMRCP,
    mainDuctMm,
    cystMuralNodule,
    complication,
    hasGasInCollection,
    aipDiffuseSausage,
    aipCapsuleRim,
    enhancement,
  ]);

  // -----------------------------
  // Pattern support box (high-yield)
  // -----------------------------
  const patternSupport = useMemo(() => {
    const list: { title: string; tag: "Yüksek olasılık" | "İpucu"; bullets: string[]; score: number }[] = [];

    // PDAC
    {
      const s =
        (enhancement === "Hipoenhans" ? 3 : 0) +
        (ductSign === "Double_duct" ? 3 : 0) +
        (ductSign === "Cutoff" ? 2 : 0) +
        (atrophyUpstream ? 2 : 0) +
        (vesselContact !== "Yok" ? 2 : 0);
      list.push({
        title: "PDAC (adenokarsinom) patern",
        tag: s >= 6 ? "Yüksek olasılık" : "İpucu",
        score: s,
        bullets: ["Hipoenhans kitle", "Duktal cutoff / double-duct", "Upstream atrofi", "Vasküler temas (abutment/encase)"],
      });
    }

    // NET
    {
      const s = (enhancement === "Arteriyel_hiper" ? 4 : 0) + (restrictedDiffusion ? 1 : 0);
      list.push({
        title: "NET patern",
        tag: s >= 4 ? "Yüksek olasılık" : "İpucu",
        score: s,
        bullets: ["Arteriyel faz hipervasküler", "Küçük lezyonda EUS katkısı yüksek", "DWI/ADC yardımcı olabilir"],
      });
    }

    // IPMN / high risk
    {
      const md = toNum(mainDuctMm);
      const s = (cystDuctCommunication ? 3 : 0) + (cystMuralNodule ? 4 : 0) + (!Number.isNaN(md) && md >= 10 ? 4 : !Number.isNaN(md) && md >= 5 ? 2 : 0);
      list.push({
        title: "IPMN risk patern",
        tag: s >= 7 ? "Yüksek olasılık" : "İpucu",
        score: s,
        bullets: ["Duktal iletişim", "Ana kanal dilatasyonu", "Mural nodül (yüksek risk)", "MRCP ile haritalama"],
      });
    }

    // Serous cystadenoma
    {
      const s = microcysticHoneycomb ? 4 : 0;
      list.push({
        title: "Seröz kistadenom patern",
        tag: s >= 4 ? "Yüksek olasılık" : "İpucu",
        score: s,
        bullets: ["Mikrokistik/honeycomb", "Genellikle benign davranış", "MR’de septasyon belirginleşebilir"],
      });
    }

    // Infected necrosis
    {
      const s = (hasGasInCollection ? 5 : 0) + (ctxFeverSepsis ? 3 : 0);
      list.push({
        title: "Enfekte nekroz/apse patern",
        tag: s >= 5 ? "Yüksek olasılık" : "İpucu",
        score: s,
        bullets: ["Koleksiyonda gaz", "Ateş/sepsis", "CECT ile değerlendirme + drenaj klinikçe"],
      });
    }

    // AIP
    {
      const s = (aipDiffuseSausage ? 3 : 0) + (aipCapsuleRim ? 3 : 0) + (enhancement === "Delayed_fibrotik" ? 3 : 0);
      list.push({
        title: "Otoimmün pankreatit (AIP) patern",
        tag: s >= 6 ? "Yüksek olasılık" : "İpucu",
        score: s,
        bullets: ["Diffuse ‘sausage-like’", "Kapsül-benzeri rim", "Delayed/fibrotik tutulum", "IgG4 korelasyonu"],
      });
    }

    return list.sort((a, b) => b.score - a.score).slice(0, 4);
  }, [
    enhancement,
    ductSign,
    atrophyUpstream,
    vesselContact,
    restrictedDiffusion,
    cystDuctCommunication,
    cystMuralNodule,
    mainDuctMm,
    microcysticHoneycomb,
    hasGasInCollection,
    ctxFeverSepsis,
    aipDiffuseSausage,
    aipCapsuleRim,
  ]);

  // -----------------------------
  // Report builder
  // -----------------------------
  const protocolSummary = useMemo(() => {
    const active = (Object.entries(mods) as [Modality, boolean][]).filter(([, v]) => v).map(([k]) => k);
    const a: string[] = [];
    a.push(`Modality: ${active.length ? active.join("+") : "—"}`);
    a.push(`CT: ${ctPreset.replaceAll("_", " ")}`);
    a.push(`MR: ${mrMode === "DYNAMIC_CONTRAST" ? "Dinamik kontrast" : "Kontrastsız"} • DWI:${mrDWI ? "✓" : "—"} SWI:${mrSWI ? "✓" : "—"} MRCP:${mrMRCP ? "✓" : "—"} Perf:${mrPerfusion ? "✓" : "—"}`);
    if (hasAP) a.push(`AP: ${apSeverity.replaceAll("_", " ")} • ${apTime}`);
    if (massType !== "Yok") a.push(`Kitle: ${massType} • ${massLoc} • ${massSizeMm ? massSizeMm + " mm" : ""}`.trim());
    if (complication !== "Yok") a.push(`Kompl: ${complication.replaceAll("_", " ")}`);
    return a.filter(Boolean).join(" • ");
  }, [mods, ctPreset, mrMode, mrDWI, mrSWI, mrMRCP, mrPerfusion, hasAP, apSeverity, apTime, massType, massLoc, massSizeMm, complication]);

  const finalSentence = useMemo(() => {
    const bits: string[] = [];

    // Acute pancreatitis
    if (hasAP) {
      const ap: string[] = [];
      ap.push("Pankreasta akut pankreatit ile uyumlu bulgular izlenmektedir");
      if (hasPeripancreaticStranding) ap.push("peripankreatik inflamasyon/stranding eşlik ediyor");
      if (hasFluidCollection) ap.push("sıvı/koleksiyon eşlik ediyor");
      if (hasGasInCollection) ap.push("koleksiyonlarda gaz izlenmesi enfekte koleksiyon lehine olabilir");
      bits.push(ap.join(", ") + ".");
    }

    // Mass
    if (massType === "Solid") {
      const m: string[] = ["Pankreasta solid kitle lezyonu izlenmektedir"];
      if (massLoc !== "Belirsiz") m.push(`(${massLoc.toLowerCase()} yerleşimli)`);
      if (massSizeMm) m.push(`${massSizeMm} mm`);
      if (enhancement !== "Bilinmiyor") m.push(enhancement === "Hipoenhans" ? "hipoenhans patern" : enhancement === "Arteriyel_hiper" ? "arteriyel fazda hipervasküler patern" : "delayed/fibrotik patern");
      if (ductSign !== "Yok") m.push(`duktal bulgu: ${ductSign.replaceAll("_", " ").toLowerCase()}`);
      if (vesselContact !== "Yok") m.push(`vasküler temas: ${vesselContact.toLowerCase()}`);
      bits.push(m.join(" ") + ".");
    }

    if (massType === "Kistik") {
      const c: string[] = ["Pankreasta kistik lezyon izlenmektedir"];
      if (massLoc !== "Belirsiz") c.push(`(${massLoc.toLowerCase()} yerleşimli)`);
      if (massSizeMm) c.push(`${massSizeMm} mm`);
      if (cystDuctCommunication) c.push("duktal iletişim lehine");
      if (cystMuralNodule) c.push("mural nodül eşlik ediyor");
      const md = toNum(mainDuctMm);
      if (!Number.isNaN(md) && md > 0) c.push(`ana kanal: ${mainDuctMm} mm`);
      bits.push(c.join(" ") + ".");
    }

    // Complication mention
    if (complication !== "Yok") {
      bits.push(`Komplikasyon açısından: ${complication.replaceAll("_", " ").toLowerCase()} düşünülebilir.`);
    }

    // Incidental
    if (incidental.trim()) bits.push(`Ek/İnsidental: ${incidental.trim()}.`);

    // DDX
    if (includeProbabilityLanguage && ddx.length) {
      const high = ddx.filter((d) => d.likelihood === "Yüksek").map((d) => d.name);
      const mid = ddx.filter((d) => d.likelihood === "Orta").map((d) => d.name);
      const low = ddx.filter((d) => d.likelihood === "Düşük").map((d) => d.name);

      const dd: string[] = [];
      if (high.length) dd.push(`Öncelikle ${high.join(", ")}`);
      if (mid.length) dd.push(`ayırıcıda ${mid.join(", ")}`);
      if (style === "Detaylı" && low.length) dd.push(`daha düşük olasılıkla ${low.join(", ")}`);
      if (dd.length) bits.push(dd.join("; ") + ".");
    }

    // Recommendations
    if (includeRecommendationsLanguage && recs.length) {
      const rank = (u?: Urgency) => (u === "Acil" ? 0 : u === "Öncelikli" ? 1 : 2);
      const top = [...recs].sort((a, b) => rank(a.urgency) - rank(b.urgency)).slice(0, style === "Detaylı" ? 5 : 3);
      const recText = top
        .map((r) => {
          const pref = r.urgency ? `${r.urgency}: ` : "";
          const detail = r.details?.length ? ` (${r.details.join("; ")})` : "";
          return `${pref}${r.title}${detail}`;
        })
        .join(" | ");
      bits.push(`Öneri: ${recText}.`);
    }

    let out = bits.join(" ").replace(/\s+/g, " ").trim();
    if (!out) out = "Pankreas için seçilen parametrelerle uyumlu belirgin bulgu belirtilmedi.";
    if (!/[.!?]$/.test(out)) out += ".";
    return out;
  }, [
    hasAP,
    hasPeripancreaticStranding,
    hasFluidCollection,
    hasGasInCollection,
    massType,
    massLoc,
    massSizeMm,
    enhancement,
    ductSign,
    vesselContact,
    cystDuctCommunication,
    cystMuralNodule,
    mainDuctMm,
    complication,
    incidental,
    includeProbabilityLanguage,
    ddx,
    includeRecommendationsLanguage,
    recs,
    style,
  ]);

  const copyAll = async () => {
    try {
      await navigator.clipboard?.writeText(finalSentence);
    } catch {}
  };

  // -----------------------------
  // UI helpers
  // -----------------------------
  const toggleMod = (m: Modality) => setMods((p) => ({ ...p, [m]: !p[m] }));

  const resetAll = () => {
    setMods({ USG: true, BT: true, MR: true });

    setCtxFeverSepsis(false);
    setCtxImmunosupp(false);
    setCtxKnownMalignancy(false);
    setCtxTrauma(false);
    setCtxAlcohol(false);
    setCtxHyperTG(false);
    setCtxBiliarySuspected(false);

    setCtPreset("NCCT");
    setMrMode("NONCONTRAST");
    setMrDWI(true);
    setMrSWI(false);
    setMrMRCP(true);
    setMrPerfusion(false);
    setMrMRS(false);

    setHasAP(true);
    setApSeverity("HAFIF");
    setApTime("Bilinmiyor");
    setHasPeripancreaticStranding(true);
    setHasFluidCollection(false);
    setHasGasInCollection(false);

    setComplication("Yok");

    setMassType("Yok");
    setMassLoc("Belirsiz");
    setMassSizeMm("");
    setEnhancement("Bilinmiyor");
    setDuctSign("Yok");
    setVesselContact("Yok");
    setRestrictedDiffusion(false);
    setT2IsoHypo(false);
    setCalcifications(false);
    setAtrophyUpstream(false);
    setSolidSubtype("Belirsiz");

    setCystSubtype("Belirsiz");
    setCystDuctCommunication(false);
    setCystMuralNodule(false);
    setMainDuctMm("");
    setMicrocysticHoneycomb(false);

    setAipCapsuleRim(false);
    setAipDiffuseSausage(false);

    setIncidental("");
    setStyle("Detaylı");
    setIncludeProbabilityLanguage(true);
    setIncludeRecommendationsLanguage(true);
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Top bar */}
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">radiology-clean • Pankreas</h1>
                <p className="text-sm text-muted-foreground">
                  USG+BT+MR • Akut pankreatit + komplikasyon + enfeksiyon • Solid/Kistik kitle • DDX + öneri motoru • ipucu kutusu
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/" className="text-sm underline text-muted-foreground">
                  Ana sayfa
                </Link>
                <Badge variant="outline">/pancreas</Badge>
                <Button variant="outline" size="sm" className="rounded-full" onClick={resetAll}>
                  Sıfırla
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Modality (default: hepsi)</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["USG", "BT", "MR"] as Modality[]).map((m) => (
                        <Button
                          key={m}
                          variant={mods[m] ? "default" : "outline"}
                          size="sm"
                          className="rounded-full"
                          onClick={() => toggleMod(m)}
                        >
                          {m}
                        </Button>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">Seçimlere göre protokol önerileri otomatik güncellenir.</div>
                  </div>

                  <div className="space-y-2">
                    <Label>Senaryo</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="default" size="sm" className="rounded-full">
                        Pankreas Patolojileri (Default)
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">Akut pankreatit + komplikasyon + kitle (solid/kistik) + enfeksiyon.</div>
                  </div>

                  <div className="space-y-2">
                    <Label>Çıktı stili</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={style === "Detaylı"} onCheckedChange={(v) => setStyle(v ? "Detaylı" : "Kısa")} />
                        <span className="text-sm">Detaylı</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={includeProbabilityLanguage} onCheckedChange={setIncludeProbabilityLanguage} />
                        <span className="text-sm">Olasılık dili</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={includeRecommendationsLanguage} onCheckedChange={setIncludeRecommendationsLanguage} />
                        <span className="text-sm">Öneri dili</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid gap-4 md:grid-cols-2">
                  {/* LEFT */}
                  <div className="space-y-4">
                    {/* Protocol Controls */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">Protokol / Sekans</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>BT preset</Label>
                            <select
                              className="w-full rounded-md border px-3 py-2 text-sm"
                              value={ctPreset}
                              onChange={(e) => setCtPreset(e.target.value as ContrastCT)}
                            >
                              <option value="NCCT">NCCT</option>
                              <option value="CECT_PANCREAS_PROTOCOL">CECT (pankreas protokolü)</option>
                              <option value="CTA_HEMORRHAGE">CTA (kanama/pseudoanevrizma)</option>
                            </select>
                            <div className="text-xs text-muted-foreground">Kitle/komplike/enfeksiyon şüphesinde CECT tercih edilir.</div>
                          </div>

                          <div className="space-y-2">
                            <Label>MR modu</Label>
                            <select
                              className="w-full rounded-md border px-3 py-2 text-sm"
                              value={mrMode}
                              onChange={(e) => setMrMode(e.target.value as MRMode)}
                            >
                              <option value="NONCONTRAST">Kontrastsız</option>
                              <option value="DYNAMIC_CONTRAST">Dinamik kontrast</option>
                            </select>
                            <div className="text-xs text-muted-foreground">Dinamik kontrast: PDAC vs NET paternleri için kritik.</div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label>DWI</Label>
                            <Switch checked={mrDWI} onCheckedChange={setMrDWI} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>SWI</Label>
                            <Switch checked={mrSWI} onCheckedChange={setMrSWI} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>MRCP</Label>
                            <Switch checked={mrMRCP} onCheckedChange={setMrMRCP} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>Perfüzyon</Label>
                            <Switch checked={mrPerfusion} onCheckedChange={setMrPerfusion} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>MRS</Label>
                            <Switch checked={mrMRS} onCheckedChange={setMrMRS} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Clinical context */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">Klinik bağlam</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label>Ateş / Sepsis</Label>
                            <Switch checked={ctxFeverSepsis} onCheckedChange={setCtxFeverSepsis} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>İmmünsüpresyon</Label>
                            <Switch checked={ctxImmunosupp} onCheckedChange={setCtxImmunosupp} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>Bilinen malignite</Label>
                            <Switch checked={ctxKnownMalignancy} onCheckedChange={setCtxKnownMalignancy} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>Travma öyküsü</Label>
                            <Switch checked={ctxTrauma} onCheckedChange={setCtxTrauma} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>Alkol</Label>
                            <Switch checked={ctxAlcohol} onCheckedChange={setCtxAlcohol} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <Label>HiperTG</Label>
                            <Switch checked={ctxHyperTG} onCheckedChange={setCtxHyperTG} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <Label>Biliyer etyoloji şüphesi</Label>
                          <Switch checked={ctxBiliarySuspected} onCheckedChange={setCtxBiliarySuspected} />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Acute pancreatitis */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">Akut pankreatit</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label>Akut pankreatit var</Label>
                          <Switch checked={hasAP} onCheckedChange={setHasAP} />
                        </div>

                        {hasAP ? (
                          <>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Şiddet</Label>
                                <select
                                  className="w-full rounded-md border px-3 py-2 text-sm"
                                  value={apSeverity}
                                  onChange={(e) => setApSeverity(e.target.value as APSeverity)}
                                >
                                  <option value="HAFIF">Hafif</option>
                                  <option value="ORTA_AGIR">Orta-Ağır</option>
                                  <option value="AGIR">Ağır</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label>Zamanlama</Label>
                                <select
                                  className="w-full rounded-md border px-3 py-2 text-sm"
                                  value={apTime}
                                  onChange={(e) => setApTime(e.target.value as APTime)}
                                >
                                  <option value="Bilinmiyor">Bilinmiyor</option>
                                  <option value="<48-72s">&lt;48–72s</option>
                                  <option value=">=48-72s">&ge;48–72s</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="flex items-center justify-between gap-3">
                                <Label>Peripankreatik stranding</Label>
                                <Switch checked={hasPeripancreaticStranding} onCheckedChange={setHasPeripancreaticStranding} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <Label>Koleksiyon/sıvı</Label>
                                <Switch checked={hasFluidCollection} onCheckedChange={setHasFluidCollection} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <Label>Koleksiyonda gaz</Label>
                                <Switch checked={hasGasInCollection} onCheckedChange={setHasGasInCollection} />
                              </div>
                            </div>
                          </>
                        ) : null}

                        <div className="space-y-2">
                          <Label>Komplikasyon</Label>
                          <select
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={complication}
                            onChange={(e) => setComplication(e.target.value as Complication)}
                          >
                            <option value="Yok">Yok</option>
                            <option value="Nekroz_suspect">Nekroz şüphesi</option>
                            <option value="APFC">APFC</option>
                            <option value="ANC">ANC</option>
                            <option value="Psodokist">Psödokist</option>
                            <option value="WON">WON</option>
                            <option value="Enfekte_nekroz_abse">Enfekte nekroz/apse</option>
                            <option value="Kanama_pseudoanevrizma">Kanama/psödoanevrizma</option>
                            <option value="Venoz_tromboz_splenik_portal_SMV">Venöz tromboz (splenik/portal/SMV)</option>
                            <option value="Biliyer_obstruksiyon_kolangit">Biliyer obstrüksiyon/kolanjit</option>
                            <option value="Barsak_iskemisi_suspect">Barsak iskemisi şüphesi</option>
                          </select>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Mass */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">Kitle / Lezyon</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label>Lezyon tipi</Label>
                          <select
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={massType}
                            onChange={(e) => setMassType(e.target.value as MassType)}
                          >
                            <option value="Yok">Yok</option>
                            <option value="Solid">Solid</option>
                            <option value="Kistik">Kistik</option>
                          </select>
                        </div>

                        {massType !== "Yok" ? (
                          <>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Yerleşim</Label>
                                <select
                                  className="w-full rounded-md border px-3 py-2 text-sm"
                                  value={massLoc}
                                  onChange={(e) => setMassLoc(e.target.value as Location)}
                                >
                                  <option value="Belirsiz">Belirsiz</option>
                                  <option value="Bas">Baş</option>
                                  <option value="Govde">Gövde</option>
                                  <option value="Kuyruk">Kuyruk</option>
                                  <option value="Uncinate">Uncinate</option>
                                  <option value="Diffuz">Diffüz</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label>Boyut (mm)</Label>
                                <Input value={massSizeMm} onChange={(e) => setMassSizeMm(e.target.value)} placeholder="örn 18" />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Kontrast paterni (BT/MR)</Label>
                              <select
                                className="w-full rounded-md border px-3 py-2 text-sm"
                                value={enhancement}
                                onChange={(e) => setEnhancement(e.target.value as Enhancement)}
                              >
                                <option value="Bilinmiyor">Bilinmiyor</option>
                                <option value="Hipoenhans">Hipoenhans</option>
                                <option value="Arteriyel_hiper">Arteriyel hiper</option>
                                <option value="Delayed_fibrotik">Delayed/fibrotik</option>
                              </select>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Duktal bulgu</Label>
                                <select className="w-full rounded-md border px-3 py-2 text-sm" value={ductSign} onChange={(e) => setDuctSign(e.target.value as DuctSign)}>
                                  <option value="Yok">Yok</option>
                                  <option value="Double_duct">Double-duct</option>
                                  <option value="Wirsung_dil">Wirsung dilatasyonu</option>
                                  <option value="Cutoff">Cutoff</option>
                                </select>
                              </div>

                              <div className="space-y-2">
                                <Label>Vasküler temas</Label>
                                <select className="w-full rounded-md border px-3 py-2 text-sm" value={vesselContact} onChange={(e) => setVesselContact(e.target.value as VesselContact)}>
                                  <option value="Yok">Yok</option>
                                  <option value="Abutment">Abutment</option>
                                  <option value="Encase">Encase</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="flex items-center justify-between gap-3">
                                <Label>Restriksiyon (DWI)</Label>
                                <Switch checked={restrictedDiffusion} onCheckedChange={setRestrictedDiffusion} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <Label>T2 izo/hipo eğilim</Label>
                                <Switch checked={t2IsoHypo} onCheckedChange={setT2IsoHypo} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <Label>Upstream atrofi</Label>
                                <Switch checked={atrophyUpstream} onCheckedChange={setAtrophyUpstream} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <Label>Kalsifikasyon</Label>
                                <Switch checked={calcifications} onCheckedChange={setCalcifications} />
                              </div>
                            </div>

                            {massType === "Solid" ? (
                              <Card className="border">
                                <CardContent className="p-3 space-y-3">
                                  <div className="text-sm font-semibold">Solid alt ipuçları</div>
                                  <div className="space-y-2">
                                    <Label>Alt tip (opsiyonel)</Label>
                                    <select className="w-full rounded-md border px-3 py-2 text-sm" value={solidSubtype} onChange={(e) => setSolidSubtype(e.target.value as SolidSubtype)}>
                                      <option value="Belirsiz">Belirsiz</option>
                                      <option value="PDAC">PDAC</option>
                                      <option value="NET">NET</option>
                                      <option value="Fokal_pankreatit">Fokal pankreatit</option>
                                      <option value="AIP">AIP</option>
                                      <option value="Lenfoma">Lenfoma</option>
                                      <option value="Metastaz">Metastaz</option>
                                    </select>
                                  </div>

                                  <Separator />

                                  <div className="text-sm font-semibold">AIP ipuçları</div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <Label>Kapsül-benzeri rim</Label>
                                      <Switch checked={aipCapsuleRim} onCheckedChange={setAipCapsuleRim} />
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <Label>Diffuse sausage-like</Label>
                                      <Switch checked={aipDiffuseSausage} onCheckedChange={setAipDiffuseSausage} />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : null}

                            {massType === "Kistik" ? (
                              <Card className="border">
                                <CardContent className="p-3 space-y-3">
                                  <div className="text-sm font-semibold">Kistik alt ipuçları</div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label>Alt tip</Label>
                                      <select className="w-full rounded-md border px-3 py-2 text-sm" value={cystSubtype} onChange={(e) => setCystSubtype(e.target.value as CystSubtype)}>
                                        <option value="Belirsiz">Belirsiz</option>
                                        <option value="Psodokist">Psödokist</option>
                                        <option value="IPMN">IPMN</option>
                                        <option value="Seröz">Seröz</option>
                                        <option value="Müsinöz">Müsinöz</option>
                                        <option value="SPN">SPN</option>
                                      </select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Ana kanal (mm)</Label>
                                      <Input value={mainDuctMm} onChange={(e) => setMainDuctMm(e.target.value)} placeholder="örn 6" />
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <Label>Duktal iletişim</Label>
                                      <Switch checked={cystDuctCommunication} onCheckedChange={setCystDuctCommunication} />
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <Label>Mural nodül</Label>
                                      <Switch checked={cystMuralNodule} onCheckedChange={setCystMuralNodule} />
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <Label>Mikrokistik/honeycomb</Label>
                                      <Switch checked={microcysticHoneycomb} onCheckedChange={setMicrocysticHoneycomb} />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : null}
                          </>
                        ) : null}
                      </CardContent>
                    </Card>

                    {/* Incidental */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">Ek / İnsidental</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Textarea value={incidental} onChange={(e) => setIncidental(e.target.value)} placeholder="Serbest metin..." />
                      </CardContent>
                    </Card>
                  </div>

                  {/* RIGHT (sticky output panel) */}
                  <div className="space-y-4 md:sticky md:top-6 self-start">
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>Canlı Çıktı</span>
                          <Badge variant="secondary">Live</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-xs text-muted-foreground">{protocolSummary}</div>

                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" className="rounded-full" onClick={copyAll}>
                                Kopyala
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Tek-cümlelik final raporu panoya kopyalar</TooltipContent>
                          </Tooltip>
                        </div>

                        <div className="rounded-lg border p-3 text-sm leading-relaxed">{finalSentence}</div>

                        <Separator />

                        <ScrollArea className="h-[420px] pr-2">
                          <div className="space-y-4">
                            {/* Hint box */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">İpucu Kutusu</Badge>
                                <span className="text-xs text-muted-foreground">yüksek-yield paternler</span>
                              </div>
                              <div className="grid gap-2">
                                {patternSupport.map((p) => (
                                  <Card key={p.title} className="border">
                                    <CardContent className="p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="font-medium">{p.title}</div>
                                        <Badge variant={p.tag === "Yüksek olasılık" ? "default" : "outline"}>{p.tag}</Badge>
                                      </div>
                                      {bulletList(p.bullets, 4)}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>

                            {/* DDX */}
                            {ddx.length ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge>Ayırıcı Tanı</Badge>
                                  <span className="text-xs text-muted-foreground">feature-strength + ipucu tabanlı</span>
                                </div>
                                <div className="grid gap-2">
                                  {ddx.map((d) => (
                                    <Card key={d.name} className="border">
                                      <CardContent className="p-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="font-medium">{d.name}</div>
                                          <LikelihoodBadge l={d.likelihood} />
                                        </div>
                                        {bulletList(d.why, 3)}
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {/* Recs + protocol assistant */}
                            {recs.length ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge>Öneriler</Badge>
                                  <span className="text-xs text-muted-foreground">koşullu otomatik</span>
                                </div>
                                <div className="grid gap-2">
                                  {recs.map((r, idx) => (
                                    <Card key={idx} className="border">
                                      <CardContent className="p-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="font-medium">{r.title}</div>
                                          <UrgencyBadge u={r.urgency} />
                                        </div>
                                        {bulletList(r.details, 4)}
                                        {r.autoApply ? (
                                          <div className="mt-2">
                                            <Button size="sm" className="rounded-full" onClick={r.autoApply}>
                                              Uygula
                                            </Button>
                                          </div>
                                        ) : null}
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </ScrollArea>

                        <Separator />
                        <div className="text-xs text-muted-foreground">
                          Not: DDX/öneriler “kılavuz” amaçlıdır; kesin tanı için dinamik patern + klinik/lab korelasyonu gerekir.
                        </div>
                      </CardContent>
                    </Card>

                    <div className="text-xs text-muted-foreground">radiology-clean • pankreas modülü • var/yok → koşullu derinleşme • canlı çıktı paneli</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Footer note */}
            <div className="text-xs text-muted-foreground mt-3">
              Pankreas route hazır. Ana sayfaya buton eklemek için home `app/page.tsx` içine `/pancreas` linki ekleyeceğiz.
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
