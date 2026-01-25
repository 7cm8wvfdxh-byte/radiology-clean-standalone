"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * radiology-clean-standalone
 * Home page:
 * - Organ selector: Karaciğer (route /liver) vs Beyin (inline module)
 * - Brain module: BT / MR / BT+MR
 * - Flow: Travma / Kanama / Kitle-Enfeksiyon
 *
 * Notes:
 * - Brain “dynamic phases” in classic liver sense are not typical; we model clinically meaningful brain add-ons:
 *   CT: Non-contrast CT / CECT / CTA / CTV / CTP
 *   MR: Contrast yes/no + add-on sequences (DWI, SWI, Perfusion DSC/DCE, MRS)
 * - Hemorrhage: location + measurement fields (thickness, midline shift, max diameter)
 */

// -----------------------------
// Small UI helpers
// -----------------------------
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-500 to-purple-600" />
      <span className="text-sm font-semibold text-slate-800">{children}</span>
    </div>
  );
}

type TriToggleProps = {
  value: string;
  options: { key: string; label: string }[];
  onChange: (v: string) => void;
};

function Segmented({ value, options, onChange }: TriToggleProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button
          key={o.key}
          size="sm"
          variant={value === o.key ? "default" : "outline"}
          className="rounded-full"
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function kv(label: string, value?: string) {
  if (!value) return "";
  return `${label}: ${value}`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-slate-700">{children}</span>;
}

function toggleInArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

// -----------------------------
// Types
// -----------------------------
type Organ = "liver" | "brain";
type ModalityMode = "CT" | "MR" | "CTMR";
type BrainFlow = "TRAUMA" | "HEMORRHAGE" | "MASS_INF";

type CTPreset = "NCCT" | "CECT" | "CTA" | "CTV" | "CTP";

type MRIContrast = "NO" | "YES";

type BrainHemType = "EXTRAAXIAL" | "INTRAAXIAL";
type ExtraAxialSubtype = "SDH" | "EDH" | "SAH" | "IVH";
type IntraAxialSubtype = "ICH" | "HEM_CONTUSION" | "SAH" | "IVH";

type BrainRegion =
  | "Frontal"
  | "Parietal"
  | "Temporal"
  | "Occipital"
  | "Insula"
  | "Basal ganglia"
  | "Thalamus"
  | "Brainstem"
  | "Cerebellum"
  | "Intraventricular"
  | "Diffuse"
  | "Other";

type ExtraAxialLocation = "Convexity" | "Falx" | "Tentorium" | "Skull base" | "Diffuse";
type Side = "R" | "L" | "Bilateral" | "Midline";

// CVST (dural venous sinus thrombosis)
type VenousSinus =
  | "Superior sagittal sinus"
  | "Straight sinus"
  | "Transverse sinus"
  | "Sigmoid sinus"
  | "Internal jugular vein"
  | "Deep venous system"
  | "Cortical veins";
type CVSTOcclusion = "Partial" | "Complete";
type CVSTLaterality = "R" | "L" | "Bilateral" | "Midline";

// -----------------------------
// Main Page
// -----------------------------
export default function Page() {
  const [organ, setOrgan] = useState<Organ>("brain"); // default brain for current sprint
  const [copyOk, setCopyOk] = useState<string>("");

  // Brain state
  const [mode, setMode] = useState<ModalityMode>("CT"); // CT / MR / CTMR
  const [flow, setFlow] = useState<BrainFlow>("HEMORRHAGE");

  // Clinical context (shared)
  const [ctxTraumaHx, setCtxTraumaHx] = useState<boolean>(true);
  const [ctxAnticoag, setCtxAnticoag] = useState<boolean>(false);
  const [ctxKnownCancer, setCtxKnownCancer] = useState<boolean>(false);
  const [ctxFeverSepsis, setCtxFeverSepsis] = useState<boolean>(false);
  const [ctxImmunosupp, setCtxImmunosupp] = useState<boolean>(false);

  // CVST suspicion (e.g., headache/papilledema, postpartum/OCP, hypercoagulable state)
  const [ctxCVSTSusp, setCtxCVSTSusp] = useState<boolean>(false);

  // CT protocol (brain)
  const [ctPreset, setCtPreset] = useState<CTPreset>("NCCT");
  const [ctNeckCTA, setCtNeckCTA] = useState<boolean>(false); // head+neck CTA toggle

  // MR protocol (brain)
  const [mrContrast, setMrContrast] = useState<MRIContrast>("YES");
  const [mrDWI, setMrDWI] = useState<boolean>(true);
  const [mrSWI, setMrSWI] = useState<boolean>(true);
  const [mrPerfusion, setMrPerfusion] = useState<boolean>(false); // DSC/DCE
  const [mrMRS, setMrMRS] = useState<boolean>(false); // spectroscopy

  // -------------------------
  // Trauma sub-selections
  // -------------------------
  const [traumaSkullFx, setTraumaSkullFx] = useState<boolean>(false);
  const [traumaBasilarFx, setTraumaBasilarFx] = useState<boolean>(false);
  const [traumaDAI, setTraumaDAI] = useState<boolean>(false);
  const [traumaContusion, setTraumaContusion] = useState<boolean>(true);
  const [traumaPneumocephalus, setTraumaPneumocephalus] = useState<boolean>(false);
  const [traumaHerniation, setTraumaHerniation] = useState<boolean>(false);

  // -------------------------
  // Hemorrhage sub-selections + measurements
  // -------------------------
  const [hemType, setHemType] = useState<BrainHemType>("INTRAAXIAL");
  const [extraSubtype, setExtraSubtype] = useState<ExtraAxialSubtype>("SDH");
  const [intraSubtype, setIntraSubtype] = useState<IntraAxialSubtype>("ICH");
  const [hemSide, setHemSide] = useState<Side>("R");
  const [hemRegion, setHemRegion] = useState<BrainRegion>("Temporal");
  const [extraLoc, setExtraLoc] = useState<ExtraAxialLocation>("Convexity");

  const [thicknessMm, setThicknessMm] = useState<string>(""); // for SDH/EDH thickness
  const [midlineShiftMm, setMidlineShiftMm] = useState<string>(""); // MLS
  const [maxDiamCm, setMaxDiamCm] = useState<string>(""); // for ICH/contusion max diameter

  // ABC/2 volume (optional)
  const [abcAcm, setAbcAcm] = useState<string>("");
  const [abcBcm, setAbcBcm] = useState<string>("");
  const [abcCcm, setAbcCcm] = useState<string>("");

  const abcVolumeMl = useMemo(() => {
    const A = Number(abcAcm);
    const B = Number(abcBcm);
    const C = Number(abcCcm);
    if (!A || !B || !C) return "";
    const vol = (A * B * C) / 2; // cm^3 ~ mL
    if (!Number.isFinite(vol)) return "";
    return vol.toFixed(1);
  }, [abcAcm, abcBcm, abcCcm]);

  const [hasIVHExt, setHasIVHExt] = useState<boolean>(false);
  const [hasSAHExt, setHasSAHExt] = useState<boolean>(false);

  // Hemorrhage “age / signal”
  const [bloodAgeHint, setBloodAgeHint] = useState<string>(""); // optional free text

  // -------------------------
  // CVST (dural venous sinus thrombosis) detail (CTV/MRV)
  // -------------------------
  const [cvstSinuses, setCvstSinuses] = useState<VenousSinus[]>(["Superior sagittal sinus"]);
  const [cvstLaterality, setCvstLaterality] = useState<CVSTLaterality>("Midline");
  const [cvstOcclusion, setCvstOcclusion] = useState<CVSTOcclusion>("Partial");
  const [cvstCorticalVeinInvolvement, setCvstCorticalVeinInvolvement] = useState<boolean>(false);
  const [cvstVenousInfarct, setCvstVenousInfarct] = useState<boolean>(false);
  const [cvstHemorrhagicVenousInfarct, setCvstHemorrhagicVenousInfarct] = useState<boolean>(false);
  const [cvstHintDenseSinus, setCvstHintDenseSinus] = useState<boolean>(false);
  const [cvstHintEmptyDelta, setCvstHintEmptyDelta] = useState<boolean>(false);

  // -------------------------
  // Mass / Infection sub-selections
  // -------------------------
  const [lesionCount, setLesionCount] = useState<"SOLITARY" | "MULTIPLE">("SOLITARY");
  const [lesionCompartment, setLesionCompartment] = useState<"EXTRAAXIAL" | "INTRAAXIAL">("INTRAAXIAL");
  const [ringEnhancing, setRingEnhancing] = useState<boolean>(false);
  const [diffRestriction, setDiffRestriction] = useState<boolean>(false);
  const [markedEdema, setMarkedEdema] = useState<boolean>(true);
  const [hemorrhagicComponent, setHemorrhagicComponent] = useState<boolean>(false);

  // Meningioma / lymphoma strengthening
  const [duralTail, setDuralTail] = useState<boolean>(false);
  const [hyperostosis, setHyperostosis] = useState<boolean>(false);
  const [csfCleft, setCsfCleft] = useState<boolean>(false);
  const [intenseHomEnh, setIntenseHomEnh] = useState<boolean>(false);

  const [t2IsoHypo, setT2IsoHypo] = useState<boolean>(false); // lymphoma can be relatively T2 iso/hypo
  const [deepPeriventricular, setDeepPeriventricular] = useState<boolean>(false);
  const [restrictedStrong, setRestrictedStrong] = useState<boolean>(false);

  // Pattern “high likelihood” helpers (quick support box)
  const meningiomaScore = useMemo(() => {
    return [duralTail, hyperostosis, csfCleft, intenseHomEnh].filter(Boolean).length;
  }, [duralTail, hyperostosis, csfCleft, intenseHomEnh]);

  const lymphomaScore = useMemo(() => {
    return [restrictedStrong, t2IsoHypo, deepPeriventricular, ctxImmunosupp].filter(Boolean).length;
  }, [restrictedStrong, t2IsoHypo, deepPeriventricular, ctxImmunosupp]);

  const meningiomaHigh = meningiomaScore >= 3;
  const lymphomaHigh = lymphomaScore >= 3;

  // Free text
  const [incidental, setIncidental] = useState<string>("");

  // -------------------------
  // Organ navigation
  // -------------------------
  const goLiver = () => {
    // Keep liver module in /liver route
    window.location.href = "/liver";
  };

  // -------------------------
  // Rules / Output engine (light but useful)
  // -------------------------
  const protocolSummary = useMemo(() => {
    const parts: string[] = [];
    if (mode === "CT" || mode === "CTMR") {
      parts.push(`BT: ${ctPreset === "NCCT" ? "Non-kontrast BT" : ctPreset === "CECT" ? "Kontrastlı BT" : ctPreset}`);
      if (ctPreset === "CTA" && ctNeckCTA) parts.push("CTA head+neck");
    }
    if (mode === "MR" || mode === "CTMR") {
      const seq: string[] = [];
      if (mrDWI) seq.push("DWI/ADC");
      if (mrSWI) seq.push("SWI/T2*");
      if (mrPerfusion) seq.push("Perfüzyon (DSC/DCE)");
      if (mrMRS) seq.push("MRS");
      parts.push(`MR: ${mrContrast === "YES" ? "Kontrastlı" : "Kontrastsız"}${seq.length ? ` + ${seq.join(" + ")}` : ""}`);
    }
    return parts.join(" | ");
  }, [mode, ctPreset, ctNeckCTA, mrContrast, mrDWI, mrSWI, mrPerfusion, mrMRS]);

  const ctxSummary = useMemo(() => {
    const tags: string[] = [];
    if (ctxTraumaHx) tags.push("Travma öyküsü");
    if (ctxAnticoag) tags.push("Antikoagülan/antiagregan");
    if (ctxKnownCancer) tags.push("Bilinen malignite");
    if (ctxFeverSepsis) tags.push("Ateş/sepsis");
    if (ctxImmunosupp) tags.push("İmmünsüpresyon");
    if (ctxCVSTSusp) tags.push("CVST şüphesi");
    return tags;
  }, [ctxTraumaHx, ctxAnticoag, ctxKnownCancer, ctxFeverSepsis, ctxImmunosupp, ctxCVSTSusp]);

  // DDX + recommendations
  const ddx = useMemo(() => {
    let items: { title: string; why: string[]; level: "Yüksek" | "Orta" | "Düşük" }[] = [];

    // CVST can coexist with hemorrhage/venous infarct; treat as parallel track
    if (ctxCVSTSusp) {
      const why: string[] = ["Klinik olarak CVST şüphesi"];
      if (mode === "CT" || mode === "CTMR") why.push("CTV ile değerlendirme planı");
      if (mode === "MR" || mode === "CTMR") why.push("MR (gerekirse MRV) ile değerlendirme");
      const level: "Yüksek" | "Orta" | "Düşük" = (mode === "CT" || mode === "CTMR") && ctPreset === "CTV" ? "Yüksek" : "Orta";
      items.push({ title: "Dural venöz sinüs trombozu (CVST)", why, level });
    }

    if (flow === "HEMORRHAGE") {
      const why: string[] = [];
      if (mode === "CT" || mode === "CTMR") why.push("BT ile kanama değerlendirmesi uygun");
      if (ctxAnticoag) why.push("Antikoagülan/antiagregan kullanımı");
      if (ctxTraumaHx) why.push("Travma öyküsü");

      // subtype-guided
      if (hemType === "EXTRAAXIAL") {
        if (extraSubtype === "SDH") {
          items.push({ title: "Subdural hematom", why: [...why, "Ekstraaksiyel kanama paterni (SDH)"], level: "Yüksek" });
        } else if (extraSubtype === "EDH") {
          items.push({ title: "Epidural hematom", why: [...why, "Ekstraaksiyel kanama paterni (EDH)"], level: "Yüksek" });
        } else if (extraSubtype === "SAH") {
          items.push({ title: "Subaraknoid kanama", why: [...why, "SAH paterni"], level: ctxTraumaHx ? "Orta" : "Yüksek" });
          if (!ctxTraumaHx && (ctPreset === "CTA" || mode === "CTMR")) {
            items.push({ title: "Anevrizmal SAH olasılığı", why: ["Travma yok + SAH paterni", "CTA ile anevrizma taraması değerlendirilebilir"], level: "Orta" });
          }
        } else if (extraSubtype === "IVH") {
          items.push({ title: "İntraventriküler kanama", why: [...why, "IVH paterni"], level: "Orta" });
        }
      } else {
        if (intraSubtype === "ICH") {
          items.push({ title: "İntraparenkimal hematom", why: [...why, "İntraaksiyel kanama paterni"], level: "Yüksek" });
        } else if (intraSubtype === "HEM_CONTUSION") {
          items.push({ title: "Hemorajik kontüzyon", why: [...why, "Travma ile ilişkili intraaksiyel kanama"], level: ctxTraumaHx ? "Yüksek" : "Orta" });
        } else if (intraSubtype === "SAH") {
          items.push({ title: "Subaraknoid kanama", why: [...why, "SAH paterni"], level: ctxTraumaHx ? "Orta" : "Yüksek" });
        } else if (intraSubtype === "IVH") {
          items.push({ title: "İntraventriküler kanama", why: [...why, "IVH paterni"], level: "Orta" });
        }
      }
    }

    if (flow === "TRAUMA") {
      const why: string[] = [];
      if (ctxTraumaHx) why.push("Travma öyküsü");
      if (traumaSkullFx) why.push("Kafatası fraktürü şüphesi");
      if (traumaBasilarFx) why.push("Baziler fraktür şüphesi");
      if (traumaDAI) why.push("DAI şüphesi");
      if (traumaContusion) why.push("Kontüzyon paterni");
      if (why.length) items.push({ title: "Travmatik beyin hasarı", why, level: "Orta" });
    }

    if (flow === "MASS_INF") {
      const whyBase: string[] = [];
      if (ctxKnownCancer) whyBase.push("Bilinen malignite");
      if (ctxFeverSepsis) whyBase.push("Ateş/sepsis");
      if (ctxImmunosupp) whyBase.push("İmmünsüpresyon");
      if (lesionCount === "MULTIPLE") {
        items.push({
          title: "Metastaz",
          why: [...whyBase, ctxKnownCancer ? "Kanser öyküsü" : "Multipl lezyon paterni"],
          level: ctxKnownCancer ? "Yüksek" : "Orta",
        });
      }
      if (ringEnhancing && (diffRestriction || restrictedStrong)) {
        items.push({
          title: "Beyin absesi",
          why: [...whyBase, "Ring-enhancing + restriksiyon"],
          level: ctxFeverSepsis ? "Yüksek" : "Orta",
        });
      }
      // Meningioma strengthening
      if (lesionCompartment === "EXTRAAXIAL" && meningiomaScore >= 2) {
        items.push({
          title: "Meningiom",
          why: ["Ekstraaksiyel/dural bazlı", `Skor ${meningiomaScore}/4 (dural tail/hiperostoz/CSF cleft/homojen kontrast)`],
          level: meningiomaHigh ? "Yüksek" : "Orta",
        });
      }
      // Lymphoma strengthening
      if ((restrictedStrong || diffRestriction) && (deepPeriventricular || ctxImmunosupp || t2IsoHypo)) {
        const lymphWhy: string[] = [];
        if (restrictedStrong || diffRestriction) lymphWhy.push("Belirgin restriksiyon");
        if (t2IsoHypo) lymphWhy.push("T2 izo/hipo eğilim");
        if (deepPeriventricular) lymphWhy.push("Derin/periventriküler yerleşim");
        if (ctxImmunosupp) lymphWhy.push("İmmünsüpresyon (PCNSL/OPI)");
        items.push({
          title: "Santral sinir sistemi lenfoması (PCNSL)",
          why: lymphWhy,
          level: lymphomaHigh ? "Yüksek" : "Orta",
        });
      }
    }

    // Dedupe by title (keep highest level)
    const order = { Yüksek: 3, Orta: 2, Düşük: 1 } as const;
    const map = new Map<string, { title: string; why: string[]; level: "Yüksek" | "Orta" | "Düşük" }>();
    for (const it of items) {
      const prev = map.get(it.title);
      if (!prev || order[it.level] > order[prev.level]) map.set(it.title, it);
    }
    return Array.from(map.values());
  }, [
    ctxCVSTSusp,
    mode,
    ctPreset,
    flow,
    hemType,
    extraSubtype,
    intraSubtype,
    ctxAnticoag,
    ctxTraumaHx,
    traumaSkullFx,
    traumaBasilarFx,
    traumaDAI,
    traumaContusion,
    ctxKnownCancer,
    ctxFeverSepsis,
    ctxImmunosupp,
    lesionCount,
    lesionCompartment,
    ringEnhancing,
    diffRestriction,
    restrictedStrong,
    meningiomaScore,
    meningiomaHigh,
    lymphomaHigh,
    deepPeriventricular,
    t2IsoHypo,
  ]);

  const recommendations = useMemo(() => {
    const rec: string[] = [];

    // CVST
    if (ctxCVSTSusp) {
      if (mode === "CT" || mode === "CTMR") {
        rec.push("CVST şüphesinde dural venöz sinüslerin CTV ile değerlendirilmesi (alternatif: MRV) önerilebilir.");
      }
      if (mode === "MR" || mode === "CTMR") {
        rec.push("MR yapılacaksa venografi (MRV) + DWI/ADC + SWI/T2* eklenmesi faydalıdır.");
      }
      if (cvstVenousInfarct) {
        rec.push("Venöz infarkt şüphesinde hemorajik dönüşüm açısından SWI/T2* ve yakın klinik takip önerilir.");
      }
    }

    // Flow-based protocol suggestions
    if (flow === "HEMORRHAGE") {
      if ((mode === "CT" || mode === "CTMR") && ctPreset === "NCCT") {
        if (!ctxTraumaHx && (extraSubtype === "SAH" || intraSubtype === "SAH")) {
          rec.push("Travma öyküsü yoksa SAH paterni için CTA ile anevrizma değerlendirmesi düşünülebilir.");
        }
        if (ctxAnticoag) rec.push("Antikoagülan/antiagregan varlığında kanama progresyonu açısından klinik takip + gerekirse kontrol BT önerilir.");
      }
      if ((midlineShiftMm && Number(midlineShiftMm) >= 5) || (thicknessMm && Number(thicknessMm) >= 10)) {
        rec.push("Kitle etkisi belirgin ölçümlerde (midline shift/kalınlık) nöroşirürji görüşü önerilir.");
      }
    }

    if (flow === "TRAUMA") {
      if (mode === "MR" || mode === "CTMR") {
        if (traumaDAI && !mrSWI) rec.push("DAI şüphesinde SWI/T2* eklenmesi faydalıdır.");
      }
      if ((mode === "CT" || mode === "CTMR") && (traumaBasilarFx || traumaSkullFx)) {
        if (ctPreset !== "CTA") rec.push("Vasküler yaralanma şüphesinde seçilmiş olguda CTA değerlendirilebilir.");
      }
    }

    if (flow === "MASS_INF") {
      if (mode === "CT") rec.push("Kitle/enfeksiyon ayrımı için imkan varsa kontrastlı MR (DWI/SWI ± perfüzyon) daha uygundur.");
      if ((mode === "MR" || mode === "CTMR") && ringEnhancing && (diffRestriction || restrictedStrong)) {
        rec.push("Ring + restriksiyon varlığında apse lehine: uygun klinikte acil enfeksiyon konsültasyonu + tedavi planı önerilir.");
      }
      if ((mode === "MR" || mode === "CTMR") && lesionCompartment === "EXTRAAXIAL" && (duralTail || hyperostosis)) {
        rec.push("Ekstraaksiyel dural bazlı lezyonda meningiom lehine bulgular: cerrahi planlama için nöroşirürji değerlendirmesi önerilir.");
      }
      if ((mode === "MR" || mode === "CTMR") && (restrictedStrong || diffRestriction) && (deepPeriventricular || ctxImmunosupp)) {
        rec.push("Belirgin restriksiyon + derin/periventriküler yerleşimde lenfoma olasılığı: steroid başlamadan önce tanısal plan (biyopsi) klinikle değerlendirilmelidir.");
      }
    }

    return rec;
  }, [
    ctxCVSTSusp,
    cvstVenousInfarct,
    mode,
    flow,
    ctPreset,
    ctxTraumaHx,
    extraSubtype,
    intraSubtype,
    ctxAnticoag,
    midlineShiftMm,
    thicknessMm,
    traumaDAI,
    mrSWI,
    traumaBasilarFx,
    traumaSkullFx,
    ringEnhancing,
    diffRestriction,
    restrictedStrong,
    lesionCompartment,
    duralTail,
    hyperostosis,
    deepPeriventricular,
    ctxImmunosupp,
  ]);

  const finalReport = useMemo(() => {
    const lines: string[] = [];

    // Protocol line
    lines.push(`Protokol: ${protocolSummary || "—"}.`);

    // Context
    if (ctxSummary.length) lines.push(`Klinik: ${ctxSummary.join(", ")}.`);

    // CVST (report-ready) — independent of flow; often coexists with hemorrhage/venous infarct
    if (ctxCVSTSusp) {
      const hasCTV = (mode === "CT" || mode === "CTMR") && ctPreset === "CTV";
      const sideTxt =
        cvstLaterality === "Bilateral" ? "bilateral" : cvstLaterality === "R" ? "sağ" : cvstLaterality === "L" ? "sol" : "orta hat";
      const occlTxt = cvstOcclusion === "Complete" ? "tam" : "parsiyel";

      const sinusShort: Record<VenousSinus, string> = {
        "Superior sagittal sinus": "SSS",
        "Straight sinus": "straight sinüs",
        "Transverse sinus": "transvers sinüs",
        "Sigmoid sinus": "sigmoid sinüs",
        "Internal jugular vein": "internal juguler ven",
        "Deep venous system": "derin venöz sistem",
        "Cortical veins": "kortikal venler",
      };
      const sinTxt = cvstSinuses.length ? cvstSinuses.map((s) => sinusShort[s]).join(", ") : "dural venöz sinüsler";

      const extras: string[] = [];
      if (cvstCorticalVeinInvolvement) extras.push("kortikal ven tutulumu");
      if (cvstVenousInfarct) extras.push(cvstHemorrhagicVenousInfarct ? "hemorajik venöz infarkt" : "venöz infarkt");
      if (cvstHintDenseSinus) extras.push("NCCT'de dense sinus/cord sign");
      if (cvstHintEmptyDelta) extras.push("kontrastlı incelemede empty delta/dolum defekti");

      lines.push(
        `${hasCTV ? "CTV'de" : "Klinik CVST şüphesi kapsamında"} ${sideTxt} ${sinTxt} düzeyinde ${occlTxt} dolum defekti/tromboz ile uyumlu görünüm izlenmektedir${
          extras.length ? ` (${extras.join(", ")}).` : "."
        }`
      );
    }

    if (flow === "HEMORRHAGE") {
      // Describe hemorrhage with location + measurements
      const parts: string[] = [];

      if (hemType === "EXTRAAXIAL") {
        const subtypeLabel =
          extraSubtype === "SDH"
            ? "Subdural hematom"
            : extraSubtype === "EDH"
            ? "Epidural hematom"
            : extraSubtype === "SAH"
            ? "Subaraknoid kanama"
            : "İntraventriküler kanama";

        const loc =
          extraSubtype === "SAH"
            ? ""
            : `(${extraLoc}, ${hemSide === "Bilateral" ? "bilateral" : hemSide === "Midline" ? "orta hat" : hemSide === "R" ? "sağ" : "sol"})`;
        parts.push(`${subtypeLabel} ${loc}`.trim());

        const m: string[] = [];
        if (thicknessMm) m.push(kv("maks kalınlık", `${thicknessMm} mm`));
        if (midlineShiftMm) m.push(kv("midline shift", `${midlineShiftMm} mm`));
        if (hasSAHExt) m.push("eşlik eden SAH");
        if (hasIVHExt) m.push("eşlik eden IVH");
        if (m.length) parts.push(`(${m.filter(Boolean).join(", ")})`);
      } else {
        const subtypeLabel =
          intraSubtype === "ICH"
            ? "İntraparenkimal hematom"
            : intraSubtype === "HEM_CONTUSION"
            ? "Hemorajik kontüzyon"
            : intraSubtype === "SAH"
            ? "Subaraknoid kanama"
            : "İntraventriküler kanama";

        const region = intraSubtype === "IVH" ? "ventriküler sistem" : `${hemRegion.toLowerCase()} bölgede`;
        const side = hemSide === "Bilateral" ? "bilateral" : hemSide === "Midline" ? "orta hat" : hemSide === "R" ? "sağ" : "sol";
        parts.push(`${side} ${region} ${subtypeLabel.toLowerCase()}`.trim());

        const m: string[] = [];
        if (maxDiamCm) m.push(kv("maks çap", `${maxDiamCm} cm`));
        if (abcVolumeMl) m.push(kv("ABC/2 hacim", `${abcVolumeMl} mL`));
        if (midlineShiftMm) m.push(kv("midline shift", `${midlineShiftMm} mm`));
        if (hasSAHExt) m.push("eşlik eden SAH");
        if (hasIVHExt) m.push("eşlik eden IVH");
        if (m.length) parts.push(`(${m.filter(Boolean).join(", ")})`);
      }

      if (bloodAgeHint) parts.push(`(Evre/sinyal ipucu: ${bloodAgeHint})`);
      lines.push(`${parts.join(" ")} izlenmektedir.`);

      // Conditional negative
      lines.push("Belirgin yeni iskemik enfarkt bulgusu izlenmemektedir (mevcut protokol sınırlarında).");
    }

    if (flow === "TRAUMA") {
      const t: string[] = [];
      if (traumaContusion) t.push("kontüzyon açısından değerlendirme");
      if (traumaDAI) t.push("DAI şüphesi");
      if (traumaSkullFx) t.push("kafatası fraktürü şüphesi");
      if (traumaBasilarFx) t.push("baziler fraktür şüphesi");
      if (traumaPneumocephalus) t.push("pnömosefali");
      if (traumaHerniation) t.push("herniasyon bulguları");

      lines.push(`Travma akışı seçildi: ${t.length ? t.join(", ") : "standart travma değerlendirmesi"}.`);
      lines.push("Akut kanama/kitle etkisi açısından bulgular klinik ile birlikte yorumlanmalıdır.");
    }

    if (flow === "MASS_INF") {
      const parts: string[] = [];
      parts.push(lesionCount === "MULTIPLE" ? "Multipl lezyon paterni" : "Soliter lezyon paterni");
      parts.push(lesionCompartment === "EXTRAAXIAL" ? "ekstraaksiyel/dural bazlı" : "intraaksiyel");

      const flags: string[] = [];
      if (ringEnhancing) flags.push("ring-enhancing");
      if (diffRestriction || restrictedStrong) flags.push("restriksiyon");
      if (markedEdema) flags.push("belirgin ödem");
      if (hemorrhagicComponent) flags.push("hemorajik komponent");
      if (flags.length) parts.push(`(${flags.join(", ")})`);

      lines.push(`${parts.join(" ")} izlenmektedir. Ayırıcı tanılar klinik ve protokol ile birlikte değerlendirilmelidir.`);
      lines.push("Gerekirse kontrastlı MR + DWI/SWI ile ileri karakterizasyon önerilir.");
    }

    if (incidental.trim()) lines.push(`Ek/İnsidental: ${incidental.trim()}`);

    return lines.join("\n");
  }, [
    protocolSummary,
    ctxSummary,
    ctxCVSTSusp,
    mode,
    ctPreset,
    cvstLaterality,
    cvstOcclusion,
    cvstSinuses,
    cvstCorticalVeinInvolvement,
    cvstVenousInfarct,
    cvstHemorrhagicVenousInfarct,
    cvstHintDenseSinus,
    cvstHintEmptyDelta,
    flow,
    hemType,
    extraSubtype,
    intraSubtype,
    extraLoc,
    hemSide,
    thicknessMm,
    midlineShiftMm,
    hasSAHExt,
    hasIVHExt,
    hemRegion,
    maxDiamCm,
    abcVolumeMl,
    bloodAgeHint,
    traumaContusion,
    traumaDAI,
    traumaSkullFx,
    traumaBasilarFx,
    traumaPneumocephalus,
    traumaHerniation,
    lesionCount,
    lesionCompartment,
    ringEnhancing,
    diffRestriction,
    restrictedStrong,
    markedEdema,
    hemorrhagicComponent,
    incidental,
  ]);

  const resetBrain = () => {
    setMode("CT");
    setFlow("HEMORRHAGE");
    setCtxTraumaHx(true);
    setCtxAnticoag(false);
    setCtxKnownCancer(false);
    setCtxFeverSepsis(false);
    setCtxImmunosupp(false);
    setCtxCVSTSusp(false);

    setCtPreset("NCCT");
    setCtNeckCTA(false);

    setMrContrast("YES");
    setMrDWI(true);
    setMrSWI(true);
    setMrPerfusion(false);
    setMrMRS(false);

    setTraumaSkullFx(false);
    setTraumaBasilarFx(false);
    setTraumaDAI(false);
    setTraumaContusion(true);
    setTraumaPneumocephalus(false);
    setTraumaHerniation(false);

    setHemType("INTRAAXIAL");
    setExtraSubtype("SDH");
    setIntraSubtype("ICH");
    setHemSide("R");
    setHemRegion("Temporal");
    setExtraLoc("Convexity");
    setThicknessMm("");
    setMidlineShiftMm("");
    setMaxDiamCm("");
    setAbcAcm("");
    setAbcBcm("");
    setAbcCcm("");
    setHasIVHExt(false);
    setHasSAHExt(false);
    setBloodAgeHint("");

    setCvstSinuses(["Superior sagittal sinus"]);
    setCvstLaterality("Midline");
    setCvstOcclusion("Partial");
    setCvstCorticalVeinInvolvement(false);
    setCvstVenousInfarct(false);
    setCvstHemorrhagicVenousInfarct(false);
    setCvstHintDenseSinus(false);
    setCvstHintEmptyDelta(false);

    setLesionCount("SOLITARY");
    setLesionCompartment("INTRAAXIAL");
    setRingEnhancing(false);
    setDiffRestriction(false);
    setRestrictedStrong(false);
    setMarkedEdema(true);
    setHemorrhagicComponent(false);

    setDuralTail(false);
    setHyperostosis(false);
    setCsfCleft(false);
    setIntenseHomEnh(false);

    setT2IsoHypo(false);
    setDeepPeriventricular(false);
    setIncidental("");
  };

  // Which protocol UI panels should be shown?
  const showCTPanel = mode === "CT" || mode === "CTMR";
  const showMRPanel = mode === "MR" || mode === "CTMR";

  const ctPanelNeeded = useMemo(() => {
    return showCTPanel;
  }, [showCTPanel]);

  const mrPanelNeeded = useMemo(() => {
    return showMRPanel;
  }, [showMRPanel]);

  // Copy output
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(finalReport);
      setCopyOk("Kopyalandı");
      setTimeout(() => setCopyOk(""), 1200);
    } catch {
      setCopyOk("Kopyalama başarısız");
      setTimeout(() => setCopyOk(""), 1500);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 p-6 mb-6 shadow-lg shadow-violet-200/50">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
          <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-white">
              <div className="text-violet-200 text-sm font-medium mb-1">Beyin Modülü</div>
              <h1 className="text-2xl font-bold tracking-tight">Radiology Assistant</h1>
              <p className="text-violet-100 text-sm mt-1">Travma • Kanama • Kitle/Enfeksiyon analizi</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="rounded-full bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
                onClick={resetBrain}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sıfırla
              </Button>
            </div>
          </div>
        </div>

        {copyOk ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {copyOk}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Inputs */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl shadow-md border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-slate-800">Değerlendirme Parametreleri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Mode */}
                <div className="rounded-xl border p-4">
                  <SectionTitle>Görüntüleme</SectionTitle>
                  <Segmented
                    value={mode}
                    onChange={(v) => setMode(v as ModalityMode)}
                    options={[
                      { key: "CT", label: "BT" },
                      { key: "MR", label: "MR" },
                      { key: "CTMR", label: "BT + MR" },
                    ]}
                  />
                </div>

                {/* Flow */}
                <div className="rounded-xl border p-4">
                  <SectionTitle>Klinik soru / akış</SectionTitle>
                  <Segmented
                    value={flow}
                    onChange={(v) => setFlow(v as BrainFlow)}
                    options={[
                      { key: "TRAUMA", label: "Travma" },
                      { key: "HEMORRHAGE", label: "Kanama" },
                      { key: "MASS_INF", label: "Kitle / Enfeksiyon" },
                    ]}
                  />
                </div>

                {/* Clinical context */}
                <div className="rounded-xl border p-4">
                  <SectionTitle>Klinik zemin / bağlam</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <div className="font-medium">Travma öyküsü</div>
                        <div className="text-xs text-slate-500">Travma akışını güçlendirir</div>
                      </div>
                      <Switch checked={ctxTraumaHx} onCheckedChange={setCtxTraumaHx} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <div className="font-medium">Antikoagülan / antiagregan</div>
                        <div className="text-xs text-slate-500">Kanama riski</div>
                      </div>
                      <Switch checked={ctxAnticoag} onCheckedChange={setCtxAnticoag} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <div className="font-medium">Bilinen malignite</div>
                        <div className="text-xs text-slate-500">Metastaz olasılığı</div>
                      </div>
                      <Switch checked={ctxKnownCancer} onCheckedChange={setCtxKnownCancer} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <div className="font-medium">Ateş / sepsis</div>
                        <div className="text-xs text-slate-500">Enfeksiyon lehine</div>
                      </div>
                      <Switch checked={ctxFeverSepsis} onCheckedChange={setCtxFeverSepsis} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <div className="font-medium">İmmünsüpresyon</div>
                        <div className="text-xs text-slate-500">Lenfoma + oportunistik enf.</div>
                      </div>
                      <Switch checked={ctxImmunosupp} onCheckedChange={setCtxImmunosupp} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <div className="font-medium">CVST şüphesi</div>
                        <div className="text-xs text-slate-500">Baş ağrısı/papilödem, postpartum/OCP, trombofili...</div>
                      </div>
                      <Switch checked={ctxCVSTSusp} onCheckedChange={setCtxCVSTSusp} />
                    </div>
                  </div>
                </div>

                {/* CT/MR protocol */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ctPanelNeeded && (
                    <div className="rounded-xl border p-4">
                      <SectionTitle>BT Protokol</SectionTitle>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(["NCCT", "CECT", "CTA", "CTV", "CTP"] as CTPreset[]).map((p) => (
                          <Button
                            key={p}
                            size="sm"
                            variant={ctPreset === p ? "default" : "outline"}
                            className="rounded-full"
                            onClick={() => setCtPreset(p)}
                          >
                            {p === "NCCT" ? "Non-kontrast" : p === "CECT" ? "Kontrastlı" : p}
                          </Button>
                        ))}
                      </div>

                      {(ctPreset === "CTA" || ctPreset === "CTP") && (
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="text-sm">
                            <div className="font-medium">CTA head+neck</div>
                            <div className="text-xs text-slate-500">Diseksiyon vb. şüphede</div>
                          </div>
                          <Switch checked={ctNeckCTA} onCheckedChange={setCtNeckCTA} />
                        </div>
                      )}
                    </div>
                  )}

                  {mrPanelNeeded && (
                    <div className="rounded-xl border p-4">
                      <SectionTitle>MR Protokol</SectionTitle>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Pill>Kontrast</Pill>
                        <Button
                          size="sm"
                          variant={mrContrast === "YES" ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => setMrContrast("YES")}
                        >
                          Var
                        </Button>
                        <Button
                          size="sm"
                          variant={mrContrast === "NO" ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => setMrContrast("NO")}
                        >
                          Yok
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="text-sm">
                            <div className="font-medium">DWI/ADC</div>
                            <div className="text-xs text-slate-500">Enfeksiyon/lenfoma/iskemi vb.</div>
                          </div>
                          <Switch checked={mrDWI} onCheckedChange={setMrDWI} />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="text-sm">
                            <div className="font-medium">SWI/T2*</div>
                            <div className="text-xs text-slate-500">Mikrokanama, DAI, hemorajik komponent.</div>
                          </div>
                          <Switch checked={mrSWI} onCheckedChange={setMrSWI} />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="text-sm">
                            <div className="font-medium">Perfüzyon (DSC/DCE)</div>
                            <div className="text-xs text-slate-500">Seçilmiş tümör olgularında yardımcı.</div>
                          </div>
                          <Switch checked={mrPerfusion} onCheckedChange={setMrPerfusion} />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="text-sm">
                            <div className="font-medium">MRS</div>
                            <div className="text-xs text-slate-500">Seçilmiş olguda</div>
                          </div>
                          <Switch checked={mrMRS} onCheckedChange={setMrMRS} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* FLOW: TRAUMA */}
                {flow === "TRAUMA" && (
                  <div className="rounded-xl border p-4 space-y-3">
                    <SectionTitle>Travma alt seçimler</SectionTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Kontüzyon</div>
                          <div className="text-xs text-slate-500">Kortikal contusion odakları</div>
                        </div>
                        <Switch checked={traumaContusion} onCheckedChange={setTraumaContusion} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">DAI şüphesi</div>
                          <div className="text-xs text-slate-500">MR/SWI ile güçlenir</div>
                        </div>
                        <Switch checked={traumaDAI} onCheckedChange={setTraumaDAI} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Kafatası fraktürü</div>
                          <div className="text-xs text-slate-500">Skalp hematomu vb.</div>
                        </div>
                        <Switch checked={traumaSkullFx} onCheckedChange={setTraumaSkullFx} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Baziler fraktür</div>
                          <div className="text-xs text-slate-500">Kafa tabanı bulguları</div>
                        </div>
                        <Switch checked={traumaBasilarFx} onCheckedChange={setTraumaBasilarFx} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Pnömosefali</div>
                          <div className="text-xs text-slate-500">Kafa tabanı fx ile ilişkili</div>
                        </div>
                        <Switch checked={traumaPneumocephalus} onCheckedChange={setTraumaPneumocephalus} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Herniasyon</div>
                          <div className="text-xs text-slate-500">Kitle etkisi bulguları</div>
                        </div>
                        <Switch checked={traumaHerniation} onCheckedChange={setTraumaHerniation} />
                      </div>
                    </div>
                  </div>
                )}

                {/* FLOW: HEMORRHAGE */}
                {flow === "HEMORRHAGE" && (
                  <div className="rounded-xl border p-4 space-y-3">
                    <SectionTitle>Kanama değerlendirme</SectionTitle>

                    <div className="flex flex-wrap items-center gap-2">
                      <Pill>Kompartman</Pill>
                      <Button
                        size="sm"
                        variant={hemType === "INTRAAXIAL" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setHemType("INTRAAXIAL")}
                      >
                        İntraaksiyel
                      </Button>
                      <Button
                        size="sm"
                        variant={hemType === "EXTRAAXIAL" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setHemType("EXTRAAXIAL")}
                      >
                        Ekstraaksiyel
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border p-3 space-y-3">
                        <div className="text-sm font-semibold text-slate-700">Tip / Yer</div>

                        <div className="flex flex-wrap gap-2">
                          <Pill>Taraf</Pill>
                          <Segmented
                            value={hemSide}
                            onChange={(v) => setHemSide(v as Side)}
                            options={[
                              { key: "R", label: "Sağ" },
                              { key: "L", label: "Sol" },
                              { key: "Bilateral", label: "Bilateral" },
                              { key: "Midline", label: "Orta hat" },
                            ]}
                          />
                        </div>

                        {hemType === "EXTRAAXIAL" ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Pill>Alt tip</Pill>
                              <Segmented
                                value={extraSubtype}
                                onChange={(v) => setExtraSubtype(v as ExtraAxialSubtype)}
                                options={[
                                  { key: "SDH", label: "SDH" },
                                  { key: "EDH", label: "EDH" },
                                  { key: "SAH", label: "SAH" },
                                  { key: "IVH", label: "IVH" },
                                ]}
                              />
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Pill>Uzanım</Pill>
                              <Segmented
                                value={extraLoc}
                                onChange={(v) => setExtraLoc(v as ExtraAxialLocation)}
                                options={[
                                  { key: "Convexity", label: "Konveksite" },
                                  { key: "Falx", label: "Falx" },
                                  { key: "Tentorium", label: "Tentoryum" },
                                  { key: "Skull base", label: "Kafa tabanı" },
                                  { key: "Diffuse", label: "Diffüz" },
                                ]}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Pill>Alt tip</Pill>
                              <Segmented
                                value={intraSubtype}
                                onChange={(v) => setIntraSubtype(v as IntraAxialSubtype)}
                                options={[
                                  { key: "ICH", label: "ICH" },
                                  { key: "HEM_CONTUSION", label: "Hemor. kontüzyon" },
                                  { key: "SAH", label: "SAH" },
                                  { key: "IVH", label: "IVH" },
                                ]}
                              />
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Pill>Bölge</Pill>
                              <Segmented
                                value={hemRegion}
                                onChange={(v) => setHemRegion(v as BrainRegion)}
                                options={[
                                  { key: "Frontal", label: "Frontal" },
                                  { key: "Parietal", label: "Parietal" },
                                  { key: "Temporal", label: "Temporal" },
                                  { key: "Occipital", label: "Occipital" },
                                  { key: "Basal ganglia", label: "BG" },
                                  { key: "Thalamus", label: "Talamus" },
                                  { key: "Brainstem", label: "Beyin sapı" },
                                  { key: "Cerebellum", label: "Serebellum" },
                                  { key: "Intraventricular", label: "IV" },
                                  { key: "Other", label: "Diğer" },
                                ]}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div className="rounded-xl border p-3 space-y-3">
                        <div className="text-sm font-semibold text-slate-700">Ölçümler / eşlik</div>

                        {hemType === "EXTRAAXIAL" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs font-medium text-slate-600 mb-1">Maks kalınlık (mm)</div>
                              <Input value={thicknessMm} onChange={(e) => setThicknessMm(e.target.value)} placeholder="örn: 8" />
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-600 mb-1">Midline shift (mm)</div>
                              <Input value={midlineShiftMm} onChange={(e) => setMidlineShiftMm(e.target.value)} placeholder="örn: 4" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div className="text-xs font-medium text-slate-600 mb-1">Maks çap (cm)</div>
                                <Input value={maxDiamCm} onChange={(e) => setMaxDiamCm(e.target.value)} placeholder="örn: 3.2" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-slate-600 mb-1">Midline shift (mm)</div>
                                <Input value={midlineShiftMm} onChange={(e) => setMidlineShiftMm(e.target.value)} placeholder="örn: 6" />
                              </div>
                            </div>

                            <div className="rounded-lg border p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">ABC/2 (yaklaşık hacim)</div>
                                <Badge variant="secondary">{abcVolumeMl ? `${abcVolumeMl} mL` : "—"}</Badge>
                              </div>
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                <div>
                                  <div className="text-[11px] text-slate-500 mb-1">A (cm)</div>
                                  <Input value={abcAcm} onChange={(e) => setAbcAcm(e.target.value)} placeholder="A" />
                                </div>
                                <div>
                                  <div className="text-[11px] text-slate-500 mb-1">B (cm)</div>
                                  <Input value={abcBcm} onChange={(e) => setAbcBcm(e.target.value)} placeholder="B" />
                                </div>
                                <div>
                                  <div className="text-[11px] text-slate-500 mb-1">C (cm)</div>
                                  <Input value={abcCcm} onChange={(e) => setAbcCcm(e.target.value)} placeholder="C" />
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                Not: ABC/2 yaklaşık hacim verir; slice thickness & slice sayısından C hesaplanabilir.
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Eşlik eden IVH</div>
                              <div className="text-xs text-slate-500">Ventrikül içine açılım</div>
                            </div>
                            <Switch checked={hasIVHExt} onCheckedChange={setHasIVHExt} />
                          </div>

                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Eşlik eden SAH</div>
                              <div className="text-xs text-slate-500">Sulkal/cisternal</div>
                            </div>
                            <Switch checked={hasSAHExt} onCheckedChange={setHasSAHExt} />
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-slate-600 mb-1">Evre / sinyal ipucu (opsiyonel)</div>
                          <Input value={bloodAgeHint} onChange={(e) => setBloodAgeHint(e.target.value)} placeholder="örn: subakut lehine" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FLOW: MASS/INF */}
                {flow === "MASS_INF" && (
                  <div className="rounded-xl border p-4 space-y-4">
                    <SectionTitle>Kitle / Enfeksiyon</SectionTitle>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-2">Lezyon sayısı</div>
                        <Segmented
                          value={lesionCount}
                          onChange={(v) => setLesionCount(v as "SOLITARY" | "MULTIPLE")}
                          options={[
                            { key: "SOLITARY", label: "Soliter" },
                            { key: "MULTIPLE", label: "Multipl" },
                          ]}
                        />
                      </div>

                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-2">Kompartman</div>
                        <Segmented
                          value={lesionCompartment}
                          onChange={(v) => setLesionCompartment(v as "EXTRAAXIAL" | "INTRAAXIAL")}
                          options={[
                            { key: "INTRAAXIAL", label: "İntraaksiyel" },
                            { key: "EXTRAAXIAL", label: "Ekstraaksiyel" },
                          ]}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Ring-enhancing</div>
                          <div className="text-xs text-slate-500">Metastaz/apse/nekrotik tümör</div>
                        </div>
                        <Switch checked={ringEnhancing} onCheckedChange={setRingEnhancing} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Belirgin restriksiyon</div>
                          <div className="text-xs text-slate-500">Apse/lenfoma vb.</div>
                        </div>
                        <Switch checked={diffRestriction} onCheckedChange={setDiffRestriction} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Çok belirgin restriksiyon</div>
                          <div className="text-xs text-slate-500">PCNSL/Apse lehine güçlendirir</div>
                        </div>
                        <Switch checked={restrictedStrong} onCheckedChange={setRestrictedStrong} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Belirgin ödem</div>
                          <div className="text-xs text-slate-500">Metastaz/GBM vb.</div>
                        </div>
                        <Switch checked={markedEdema} onCheckedChange={setMarkedEdema} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Hemorajik komponent</div>
                          <div className="text-xs text-slate-500">Metastaz/GBM vb.</div>
                        </div>
                        <Switch checked={hemorrhagicComponent} onCheckedChange={setHemorrhagicComponent} />
                      </div>
                    </div>

                    {/* Meningioma block */}
                    {lesionCompartment === "EXTRAAXIAL" && (
                      <div className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-700">Meningiom lehine ipuçları</div>
                          <Badge variant="secondary">Güçlendirme</Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Dural tail</div>
                              <div className="text-xs text-slate-500">Dural uzanım</div>
                            </div>
                            <Switch checked={duralTail} onCheckedChange={setDuralTail} />
                          </div>

                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Hiperostoz</div>
                              <div className="text-xs text-slate-500">Kemiğe reaksiyon</div>
                            </div>
                            <Switch checked={hyperostosis} onCheckedChange={setHyperostosis} />
                          </div>

                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">CSF cleft</div>
                              <div className="text-xs text-slate-500">Ekstraaksiyel ayrım</div>
                            </div>
                            <Switch checked={csfCleft} onCheckedChange={setCsfCleft} />
                          </div>

                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Belirgin homojen kontrastlanma</div>
                              <div className="text-xs text-slate-500">Dural bazlı kitle</div>
                            </div>
                            <Switch checked={intenseHomEnh} onCheckedChange={setIntenseHomEnh} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lymphoma block */}
                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-700">Lenfoma (PCNSL) lehine ipuçları</div>
                        <Badge variant="secondary">Güçlendirme</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="text-sm">
                            <div className="font-medium">Derin / periventriküler yerleşim</div>
                            <div className="text-xs text-slate-500">PCNSL eğilimi</div>
                          </div>
                          <Switch checked={deepPeriventricular} onCheckedChange={setDeepPeriventricular} />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="text-sm">
                            <div className="font-medium">T2 izo/hipo eğilim</div>
                            <div className="text-xs text-slate-500">Seçilmiş olguda</div>
                          </div>
                          <Switch checked={t2IsoHypo} onCheckedChange={setT2IsoHypo} />
                        </div>
                      </div>
                    </div>

                    {/* Helpful hint when CT-only */}
                    {mode === "CT" && (
                      <div className="text-xs text-slate-500">
                        İpucu: Kitle/enfeksiyonda MR daha duyarlı olsa da BT’de kontrastlı BT (CECT) seçimi bazı senaryolarda değerlendirilebilir.
                      </div>
                    )}
                  </div>
                )}

                {/* CVST details (CTV/MRV) */}
                {(ctxCVSTSusp || (showCTPanel && ctPreset === "CTV")) && (
                  <div className="rounded-xl border p-4 space-y-3">
                    <SectionTitle>CVST (venöz sinüs trombozu) detayları</SectionTitle>
                    <div className="text-xs text-slate-500">
                      Bu alan, CVST şüphesi veya CTV seçili olduğunda rapora "nereden nereye" şeklinde anatomik uzanımı otomatik yazdırmak için kullanılır.
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-600">Tutulum sinüs(ler)i (çoklu seçim)</div>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            "Superior sagittal sinus",
                            "Straight sinus",
                            "Transverse sinus",
                            "Sigmoid sinus",
                            "Internal jugular vein",
                            "Deep venous system",
                            "Cortical veins",
                          ] as VenousSinus[]
                        ).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={cvstSinuses.includes(s) ? "default" : "outline"}
                            className="rounded-full"
                            onClick={() => setCvstSinuses((prev) => toggleInArray(prev, s))}
                          >
                            {s === "Superior sagittal sinus"
                              ? "SSS"
                              : s === "Straight sinus"
                              ? "Straight"
                              : s === "Transverse sinus"
                              ? "Transvers"
                              : s === "Sigmoid sinus"
                              ? "Sigmoid"
                              : s === "Internal jugular vein"
                              ? "IJV"
                              : s === "Deep venous system"
                              ? "Derin sistem"
                              : "Kortikal ven"}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <div className="text-xs font-medium text-slate-600 mb-2">Laterality</div>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { key: "Midline", label: "Orta hat" },
                            { key: "R", label: "Sağ" },
                            { key: "L", label: "Sol" },
                            { key: "Bilateral", label: "Bilateral" },
                          ] as { key: CVSTLaterality; label: string }[]).map((o) => (
                            <Button
                              key={o.key}
                              size="sm"
                              variant={cvstLaterality === o.key ? "default" : "outline"}
                              className="rounded-full"
                              onClick={() => setCvstLaterality(o.key)}
                            >
                              {o.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="text-xs font-medium text-slate-600 mb-2">Dolum defekti / oklüzyon</div>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { key: "Partial", label: "Parsiyel" },
                            { key: "Complete", label: "Tam" },
                          ] as { key: CVSTOcclusion; label: string }[]).map((o) => (
                            <Button
                              key={o.key}
                              size="sm"
                              variant={cvstOcclusion === o.key ? "default" : "outline"}
                              className="rounded-full"
                              onClick={() => setCvstOcclusion(o.key)}
                            >
                              {o.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Kortikal ven tutulumu</div>
                          <div className="text-xs text-slate-500">Seçilmiş olgularda</div>
                        </div>
                        <Switch checked={cvstCorticalVeinInvolvement} onCheckedChange={setCvstCorticalVeinInvolvement} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Venöz infarkt</div>
                          <div className="text-xs text-slate-500">± hemorajik dönüşüm</div>
                        </div>
                        <Switch checked={cvstVenousInfarct} onCheckedChange={setCvstVenousInfarct} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Hemorajik venöz infarkt</div>
                          <div className="text-xs text-slate-500">Venöz infarkt seçiliyse anlamlı</div>
                        </div>
                        <Switch
                          checked={cvstHemorrhagicVenousInfarct}
                          onCheckedChange={(v) => {
                            setCvstHemorrhagicVenousInfarct(v);
                            if (v) setCvstVenousInfarct(true);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Dense sinus / cord sign</div>
                          <div className="text-xs text-slate-500">NCCT ipucu</div>
                        </div>
                        <Switch checked={cvstHintDenseSinus} onCheckedChange={setCvstHintDenseSinus} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Empty delta / dolum defekti</div>
                          <div className="text-xs text-slate-500">Kontrast/CTV ipucu</div>
                        </div>
                        <Switch checked={cvstHintEmptyDelta} onCheckedChange={setCvstHintEmptyDelta} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Incidental */}
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Ek / İnsidental bulgular</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={incidental}
                      onChange={(e) => setIncidental(e.target.value)}
                      placeholder="Serbest metin ekle; final çıktıya eklenir."
                      className="min-h-[90px]"
                    />
                    <div className="mt-2 text-xs text-slate-500">
                      Not: Bu modül karar destek amaçlıdır; kesin tanı/tedavi için klinik korelasyon gereklidir.
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          {/* Right: Sticky output */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-b from-white to-slate-50/80 backdrop-blur-sm">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <CardTitle className="text-lg font-semibold text-slate-800">Rapor Çıktısı</CardTitle>
                    </div>
                    <Button size="sm" className="rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-sm" onClick={copyAll}>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Kopyala
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-2">Final rapor metni</div>
                    <Textarea value={finalReport} readOnly className="min-h-[220px] bg-white" />
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-2">Ayırıcı tanılar</div>
                    <div className="space-y-2">
                      {ddx.length ? (
                        ddx.map((d) => (
                          <div key={d.title} className="rounded-xl border p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-slate-800">{d.title}</div>
                              <Badge variant={d.level === "Yüksek" ? "default" : d.level === "Orta" ? "secondary" : "outline"}>
                                {d.level}
                              </Badge>
                            </div>
                            {d.why?.length ? (
                              <ul className="mt-2 list-disc pl-5 text-xs text-slate-600 space-y-1">
                                {d.why.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">Bu seçimlerle otomatik ddx oluşmadı.</div>
                      )}
                    </div>
                  </div>

                  {/* Quick pattern support box (mass/infection) */}
                  {organ === "brain" && flow === "MASS_INF" && (
                    <div>
                      <div className="text-xs text-slate-500 mb-2">İpucu / Pattern destek</div>
                      <div className="rounded-xl border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Meningiom</div>
                          <Badge variant={meningiomaHigh ? "default" : "outline"}>
                            {meningiomaHigh ? "Yüksek olasılık" : `Skor ${meningiomaScore}/4`}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600">
                          Dural tail + hiperostoz + CSF cleft + homojen kontrast → meningiom lehine.
                        </div>
                        <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                          <li className={duralTail ? "font-medium" : ""}>Dural tail</li>
                          <li className={hyperostosis ? "font-medium" : ""}>Hiperostoz</li>
                          <li className={csfCleft ? "font-medium" : ""}>CSF cleft</li>
                          <li className={intenseHomEnh ? "font-medium" : ""}>Belirgin homojen kontrast</li>
                        </ul>

                        <div className="h-px bg-slate-100" />

                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Lenfoma (PCNSL)</div>
                          <Badge variant={lymphomaHigh ? "default" : "outline"}>
                            {lymphomaHigh ? "Yüksek olasılık" : `Skor ${lymphomaScore}/4`}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600">
                          Belirgin restriksiyon + T2 izo/hipo + derin/periventriküler + immünsüpresyon → PCNSL lehine.
                        </div>
                        <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                          <li className={restrictedStrong ? "font-medium" : ""}>Belirgin restriksiyon</li>
                          <li className={t2IsoHypo ? "font-medium" : ""}>T2 izo/hipo eğilim</li>
                          <li className={deepPeriventricular ? "font-medium" : ""}>Derin / periventriküler</li>
                          <li className={ctxImmunosupp ? "font-medium" : ""}>İmmünsüpresyon</li>
                        </ul>

                        <div className="h-px bg-slate-100" />

                        <div className="text-xs text-slate-600 space-y-1">
                          <div className="font-medium text-slate-700">Hızlı ayırıcı (mini)</div>
                          <div>• Ring-enhancing + restriksiyon → abse lehine (klinik/CRP ile).</div>
                          <div>• Çoklu kortiko-subkortikal lezyon + ödem → metastaz düşün.</div>
                          <div>• Kelebek (CC üzerinden) + heterojen/nekrotik → GBM lehine.</div>
                          <div>• CPA kitle + IAC genişleme → schwannom lehine.</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CVST hint box */}
                  {organ === "brain" && (ctxCVSTSusp || ((mode === "CT" || mode === "CTMR") && ctPreset === "CTV")) && (
                    <div>
                      <div className="text-xs text-slate-500 mb-2">İpucu / CVST pattern destek</div>
                      <div className="rounded-xl border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">CVST (dural venöz sinüs trombozu)</div>
                          <Badge variant={((mode === "CT" || mode === "CTMR") && ctPreset === "CTV") ? "default" : "outline"}>
                            {((mode === "CT" || mode === "CTMR") && ctPreset === "CTV") ? "CTV seçili" : "Klinik şüphe"}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600">
                          Dense sinus/cord sign (NCCT) + CTV'de dolum defekti/empty delta + venöz infarkt (± hemorajik) ipucu olabilir.
                        </div>
                        <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                          <li className={cvstHintDenseSinus ? "font-medium" : ""}>NCCT: dense sinus / cord sign</li>
                          <li className={cvstHintEmptyDelta ? "font-medium" : ""}>CECT/CTV: empty delta / dolum defekti</li>
                          <li className={cvstVenousInfarct ? "font-medium" : ""}>Venöz infarkt (hemorajik dönüşüm olabilir)</li>
                          <li>Konveksite SAH / hemorajik venöz infarkt eşlik edebilir</li>
                        </ul>
                        <div className="text-xs text-slate-600">
                          Önerilen: CTV (alternatif: MRV) + DWI/ADC + SWI/T2*.
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-slate-500 mb-2">Öneriler</div>
                    <div className="space-y-2">
                      {recommendations.length ? (
                        recommendations.map((r, i) => (
                          <div key={i} className="rounded-xl border p-3 text-sm text-slate-700">
                            {r}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">Bu seçimlerle otomatik öneri oluşmadı.</div>
                      )}
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500">
                      Bu sistem kural tabanlı karar destektir; görüntüler ve klinik ile birlikte değerlendirilmelidir.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-md border-0 bg-slate-800 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Hızlı Kontrol
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300 space-y-2">
                  <div className="flex items-start gap-2"><span className="text-violet-400">•</span> BT / MR / BT+MR seçimi</div>
                  <div className="flex items-start gap-2"><span className="text-violet-400">•</span> Kanama ölçümleri (kalınlık, MLS)</div>
                  <div className="flex items-start gap-2"><span className="text-violet-400">•</span> Travma alt seçimleri</div>
                  <div className="flex items-start gap-2"><span className="text-violet-400">•</span> Kitle/Enfeksiyon parametreleri</div>
                  <div className="flex items-start gap-2"><span className="text-violet-400">•</span> CVST sinüs seçimi</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-8 rounded-xl bg-slate-100/80 border border-slate-200 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">Not:</span> Akut kanama/travmada BT temel görüntüleme yöntemidir. Seçilmiş olgularda CTA/CTV/CTP gibi ek protokoller klinik endikasyona göre değerlendirilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
