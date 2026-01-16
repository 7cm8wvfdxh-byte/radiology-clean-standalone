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
  return <div className="text-sm font-semibold text-slate-700 mb-2">{children}</div>;
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
          variant={value === o.key ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(o.key)}
          className="rounded-full"
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-slate-700">{children}</span>;
}

function kv(label: string, value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return "";
  return `${label}: ${value}`;
}

function joinNice(arr: string[]) {
  return arr.filter(Boolean).join(", ");
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

  const [thicknessMm, setThicknessMm] = useState<string>(""); // extraaxial thickness
  const [midlineShiftMm, setMidlineShiftMm] = useState<string>("");
  const [maxDiamCm, setMaxDiamCm] = useState<string>(""); // hematoma/lesion max diameter

  const [hasIVHExt, setHasIVHExt] = useState<boolean>(false);
  const [hasSAHExt, setHasSAHExt] = useState<boolean>(false);

  // Hemorrhage “age / signal” (quick tags – user asked earlier for mildly hyper etc; keep generic here)
  const [bloodAgeHint, setBloodAgeHint] = useState<string>(""); // optional free text

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
    return tags;
  }, [ctxTraumaHx, ctxAnticoag, ctxKnownCancer, ctxFeverSepsis, ctxImmunosupp]);

  // DDX + recommendations
  const ddx = useMemo(() => {
    let items: { title: string; why: string[]; level: "Yüksek" | "Orta" | "Düşük" }[] = [];

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
          if ((mode === "CT" || mode === "CTMR") && (ctPreset === "CTA" || ctPreset === "CECT")) {
            items.push({ title: "Hematoma genişleme riski (spot sign vb.)", why: ["CTA/kontrastlı BT bazı senaryolarda risk belirteci olabilir"], level: "Düşük" });
          }
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
      if (mode === "CT" || mode === "CTMR") why.push("Akut travmada non-kontrast BT temel tarama");
      if (traumaSkullFx) why.push("Kafatası fraktürü bulgusu/şüphesi");
      if (traumaBasilarFx) why.push("Baziler fraktür şüphesi");
      if (traumaDAI) why.push("DAI şüphesi (MR/SWI faydalı)");

      items.push({ title: "Travmatik beyin hasarı spektrumu", why, level: "Yüksek" });
      if (traumaDAI && (mode === "MR" || mode === "CTMR")) {
        items.push({ title: "Diffüz aksonal yaralanma", why: ["MR (özellikle SWI) ile daha iyi"], level: "Orta" });
      }
      if ((ctPreset === "CTA" || (mode === "CTMR" && ctPreset === "CTA")) && (traumaBasilarFx || ctNeckCTA)) {
        items.push({ title: "Travmatik vasküler yaralanma (seçilmiş olguda)", why: ["CTA ile değerlendirme düşünülebilir"], level: "Düşük" });
      }
    }

    if (flow === "MASS_INF") {
      // core reasoning
      const whyBase: string[] = [];
      if (ctxKnownCancer) whyBase.push("Bilinen malignite");
      if (ctxFeverSepsis) whyBase.push("Ateş/sepsis");
      if (ctxImmunosupp) whyBase.push("İmmünsüpresyon");
      if (mode === "MR" || mode === "CTMR") whyBase.push("MR kitle/enfeksiyonda daha duyarlı");
      if (mrContrast === "YES" && (mode === "MR" || mode === "CTMR")) whyBase.push("Kontrastlı MR");
      if (ringEnhancing) whyBase.push("Ring tutulum paterni");
      if (diffRestriction || restrictedStrong) whyBase.push("Difüzyon kısıtlılığı");
      if (hemorrhagicComponent) whyBase.push("Hemorajik komponent");
      if (lesionCount === "MULTIPLE") whyBase.push("Multipl lezyon");

      // DDX buckets
      // Metastaz
      if (ctxKnownCancer || lesionCount === "MULTIPLE") {
        items.push({
          title: "Metastaz",
          why: [...whyBase, ctxKnownCancer ? "Kanser öyküsü" : "Multipl lezyon paterni"],
          level: "Yüksek",
        });
      } else {
        items.push({ title: "Glial tümör spektrumu (GBM dahil)", why: [...whyBase], level: "Orta" });
      }

      // Abscess vs necrotic tumor
      if ((diffRestriction || restrictedStrong) && ringEnhancing) {
        items.push({
          title: "Beyin apsesi (özellikle pyogenic)",
          why: [...whyBase, "Ring + belirgin restriksiyon apses lehine"],
          level: ctxFeverSepsis || ctxImmunosupp ? "Yüksek" : "Orta",
        });
      } else if (ringEnhancing) {
        items.push({
          title: "Nekrotik tümör / metastaz / GBM",
          why: [...whyBase, "Ring tutulum; restriksiyon yoksa tümör olasılığı artar"],
          level: "Orta",
        });
      }

      // Meningioma strengthening (extraaxial)
      if (lesionCompartment === "EXTRAAXIAL") {
        const menWhy = [...whyBase];
        if (duralTail) menWhy.push("Dural tail");
        if (hyperostosis) menWhy.push("Hiperostozis");
        if (csfCleft) menWhy.push("CSF cleft");
        if (intenseHomEnh) menWhy.push("Belirgin homojen kontrastlanma");
        items.push({
          title: "Meningiom",
          why: menWhy,
          level: duralTail || hyperostosis || (intenseHomEnh && csfCleft) ? "Yüksek" : "Orta",
        });
      }

      // Lymphoma strengthening
      const lymphWhy = [...whyBase];
      if (deepPeriventricular) lymphWhy.push("Derin/periventriküler yerleşim");
      if (t2IsoHypo) lymphWhy.push("T2 izo/hipo eğilim");
      if (restrictedStrong) lymphWhy.push("Belirgin difüzyon kısıtlılığı");
      if (ctxImmunosupp) lymphWhy.push("İmmünsüpresyon (PCNSL/OPI)");
      const lymphLevel: "Yüksek" | "Orta" | "Düşük" =
        (restrictedStrong && (deepPeriventricular || ctxImmunosupp)) ? "Yüksek" : restrictedStrong ? "Orta" : "Düşük";
      items.push({
        title: "Lenfoma (PCNSL dahil)",
        why: lymphWhy,
        level: lymphLevel,
      });
    }

    // de-duplicate by title keeping highest level
    const order = { Yüksek: 3, Orta: 2, Düşük: 1 } as const;
    const map = new Map<string, { title: string; why: string[]; level: "Yüksek" | "Orta" | "Düşük" }>();
    for (const it of items) {
      const prev = map.get(it.title);
      if (!prev || order[it.level] > order[prev.level]) map.set(it.title, it);
    }
    const out = Array.from(map.values());
    out.sort((a, b) => order[b.level] - order[a.level]);
    return out.slice(0, 6);
  }, [
    flow,
    mode,
    ctPreset,
    ctNeckCTA,
    mrContrast,
    mrDWI,
    mrSWI,
    mrPerfusion,
    mrMRS,
    ctxTraumaHx,
    ctxAnticoag,
    ctxKnownCancer,
    ctxFeverSepsis,
    ctxImmunosupp,
    hemType,
    extraSubtype,
    intraSubtype,
    traumaSkullFx,
    traumaBasilarFx,
    traumaDAI,
    traumaContusion,
    traumaPneumocephalus,
    traumaHerniation,
    lesionCount,
    lesionCompartment,
    ringEnhancing,
    diffRestriction,
    restrictedStrong,
    markedEdema,
    hemorrhagicComponent,
    duralTail,
    hyperostosis,
    csfCleft,
    intenseHomEnh,
    t2IsoHypo,
    deepPeriventricular,
  ]);

  const recommendations = useMemo(() => {
    const rec: string[] = [];

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
      if ((mode === "MR" || mode === "CTMR") && mrPerfusion) {
        rec.push("Perfüzyon (DSC/DCE) seçilmiş olgularda tümör derecelendirme/tedavi yanıtı ayrımında yardımcı olabilir.");
      }
    }

    return rec.slice(0, 6);
  }, [
    flow,
    mode,
    ctPreset,
    ctxTraumaHx,
    ctxAnticoag,
    extraSubtype,
    intraSubtype,
    thicknessMm,
    midlineShiftMm,
    traumaDAI,
    traumaBasilarFx,
    traumaSkullFx,
    mrSWI,
    ringEnhancing,
    diffRestriction,
    restrictedStrong,
    lesionCompartment,
    duralTail,
    hyperostosis,
    deepPeriventricular,
    ctxImmunosupp,
    mrPerfusion,
  ]);

  const finalReport = useMemo(() => {
    const lines: string[] = [];

    // Protocol line
    lines.push(`Protokol: ${protocolSummary || "—"}.`);

    // Context
    if (ctxSummary.length) lines.push(`Klinik: ${ctxSummary.join(", ")}.`);

    if (flow === "HEMORRHAGE") {
      // Describe hemorrhage with location + measurements
      const parts: string[] = [];

      if (hemType === "EXTRAAXIAL") {
        const subtypeLabel =
          extraSubtype === "SDH" ? "Subdural hematom" :
          extraSubtype === "EDH" ? "Epidural hematom" :
          extraSubtype === "SAH" ? "Subaraknoid kanama" : "İntraventriküler kanama";

        const loc = extraSubtype === "SAH" ? "" : `(${extraLoc}, ${hemSide === "Bilateral" ? "bilateral" : hemSide === "Midline" ? "orta hat" : hemSide === "R" ? "sağ" : "sol"})`;
        parts.push(`${subtypeLabel} ${loc}`.trim());

        const m: string[] = [];
        if (thicknessMm) m.push(kv("maks kalınlık", `${thicknessMm} mm`));
        if (midlineShiftMm) m.push(kv("midline shift", `${midlineShiftMm} mm`));
        if (hasSAHExt) m.push("eşlik eden SAH");
        if (hasIVHExt) m.push("eşlik eden IVH");
        if (m.length) parts.push(`(${m.filter(Boolean).join(", ")})`);
      } else {
        const subtypeLabel =
          intraSubtype === "ICH" ? "İntraparenkimal hematom" :
          intraSubtype === "HEM_CONTUSION" ? "Hemorajik kontüzyon" :
          intraSubtype === "SAH" ? "Subaraknoid kanama" : "İntraventriküler kanama";

        const region = intraSubtype === "IVH" ? "ventriküler sistem" : `${hemRegion.toLowerCase()} bölgede`;
        const side = hemSide === "Bilateral" ? "bilateral" : hemSide === "Midline" ? "orta hat" : hemSide === "R" ? "sağ" : "sol";
        parts.push(`${side} ${region} ${subtypeLabel.toLowerCase()}`.trim());

        const m: string[] = [];
        if (maxDiamCm) m.push(kv("maks çap", `${maxDiamCm} cm`));
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
      if (ringEnhancing) parts.push("ring tutulum");
      if (diffRestriction || restrictedStrong) parts.push("difüzyon kısıtlılığı");
      if (markedEdema) parts.push("çevresel ödem");
      if (hemorrhagicComponent) parts.push("hemorajik komponent");

      lines.push(`${parts.join(", ")} ile uyumlu görünüm mevcuttur.`);
      if (lesionCompartment === "EXTRAAXIAL" && (duralTail || hyperostosis || csfCleft)) {
        lines.push("Dural bazlı lezyonda meningiom lehine işaretler (dural tail/hiperostozis/CSF cleft) mevcuttur.");
      }
      if ((restrictedStrong || diffRestriction) && (deepPeriventricular || ctxImmunosupp || t2IsoHypo)) {
        lines.push("Belirgin restriksiyon + derin/periventriküler yerleşim ve/veya T2 izo/hipo eğilim lenfoma olasılığını artırır.");
      }
    }

    if (incidental.trim()) {
      lines.push(`Ek/İnsidental: ${incidental.trim()}`);
    }

    return lines.join("\n");
  }, [
    protocolSummary,
    ctxSummary,
    flow,
    hemType,
    extraSubtype,
    intraSubtype,
    extraLoc,
    hemSide,
    hemRegion,
    thicknessMm,
    midlineShiftMm,
    maxDiamCm,
    hasIVHExt,
    hasSAHExt,
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
    duralTail,
    hyperostosis,
    csfCleft,
    deepPeriventricular,
    ctxImmunosupp,
    t2IsoHypo,
    incidental,
  ]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(finalReport);
      setCopyOk("Kopyalandı ✅");
      setTimeout(() => setCopyOk(""), 1200);
    } catch {
      setCopyOk("Kopyalanamadı");
      setTimeout(() => setCopyOk(""), 1200);
    }
  };

  const resetBrain = () => {
    setMode("CT");
    setFlow("HEMORRHAGE");
    setCtxTraumaHx(true);
    setCtxAnticoag(false);
    setCtxKnownCancer(false);
    setCtxFeverSepsis(false);
    setCtxImmunosupp(false);

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
    setHasIVHExt(false);
    setHasSAHExt(false);
    setBloodAgeHint("");

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
    // CT panel always available if CT is in mode
    return showCTPanel;
  }, [showCTPanel]);

  const mrPanelNeeded = useMemo(() => {
    // MR panel always available if MR is in mode
    return showMRPanel;
  }, [showMRPanel]);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">radiology-clean</h1>
              <p className="text-sm text-slate-600">
                Organ seçimi → ilgili modül açılır (Karaciğer ayrı route: <span className="font-mono">/liver</span>)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={resetBrain}>
                Sıfırla
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={copyAll}>
                Kopyala
              </Button>
            </div>
          </div>

          {/* Organ selector */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant={organ === "liver" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => {
                setOrgan("liver");
                goLiver();
              }}
            >
              Karaciğer
            </Button>
            <Button
              variant={organ === "brain" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setOrgan("brain")}
            >
              Beyin
            </Button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Inputs */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Beyin AI Yardımcı Modül</CardTitle>
                <div className="text-sm text-slate-600">
                  BT / MR / BT+MR seç → akış seç (travma/kanama/kitle-enfeksiyon) → alt seçimlerle rapor + ddx + öneri.
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Modality mode */}
                <div>
                  <SectionTitle>İnceleme tipi</SectionTitle>
                  <Segmented
                    value={mode}
                    onChange={(v) => setMode(v as ModalityMode)}
                    options={[
                      { key: "CT", label: "BT" },
                      { key: "MR", label: "MR" },
                      { key: "CTMR", label: "BT+MR" },
                    ]}
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Not: Beyinde “dinamik faz” yerine klinik olarak kullanılan protokol/sekans ekleri (CTA/CTV/CTP, perfüzyon, SWI vb.) modellenir.
                  </div>
                </div>

                {/* Protocol panels */}
                {ctPanelNeeded && (
                  <div className="rounded-xl border p-4">
                    <SectionTitle>BT Protokol</SectionTitle>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={ctPreset === "NCCT" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setCtPreset("NCCT")}
                      >
                        Non-kontrast BT
                      </Button>
                      <Button
                        size="sm"
                        variant={ctPreset === "CECT" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setCtPreset("CECT")}
                      >
                        Kontrastlı BT
                      </Button>
                      <Button
                        size="sm"
                        variant={ctPreset === "CTA" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setCtPreset("CTA")}
                      >
                        CTA
                      </Button>
                      <Button
                        size="sm"
                        variant={ctPreset === "CTV" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setCtPreset("CTV")}
                      >
                        CTV
                      </Button>
                      <Button
                        size="sm"
                        variant={ctPreset === "CTP" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setCtPreset("CTP")}
                      >
                        CTP
                      </Button>
                    </div>

                    {ctPreset === "CTA" && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium text-slate-800">CTA head+neck</div>
                          <div className="text-xs text-slate-500">Travma vasküler yaralanma şüphesi vb. seçilmiş olgularda.</div>
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
                          <div className="text-xs text-slate-500">Seçilmiş olgularda metabolik ipuçları.</div>
                        </div>
                        <Switch checked={mrMRS} onCheckedChange={setMrMRS} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Flow */}
                <div>
                  <SectionTitle>Akış</SectionTitle>
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
                  </div>
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
                          <div className="font-medium">Baziler fraktür şüphesi</div>
                          <div className="text-xs text-slate-500">Vasküler yaralanma açısından seçilmiş olguda CTA düşünülebilir</div>
                        </div>
                        <Switch checked={traumaBasilarFx} onCheckedChange={setTraumaBasilarFx} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Pnömosefali</div>
                          <div className="text-xs text-slate-500">Fraktür ile ilişkili olabilir</div>
                        </div>
                        <Switch checked={traumaPneumocephalus} onCheckedChange={setTraumaPneumocephalus} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Herniasyon bulgusu</div>
                          <div className="text-xs text-slate-500">Kitle etkisi/kompresyon</div>
                        </div>
                        <Switch checked={traumaHerniation} onCheckedChange={setTraumaHerniation} />
                      </div>
                    </div>
                  </div>
                )}

                {/* FLOW: HEMORRHAGE */}
                {flow === "HEMORRHAGE" && (
                  <div className="rounded-xl border p-4 space-y-4">
                    <SectionTitle>Kanama alt seçimler</SectionTitle>

                    <div>
                      <div className="text-sm font-medium text-slate-800 mb-2">Kompartman</div>
                      <Segmented
                        value={hemType}
                        onChange={(v) => setHemType(v as BrainHemType)}
                        options={[
                          { key: "INTRAAXIAL", label: "İntraaksiyel" },
                          { key: "EXTRAAXIAL", label: "Ekstraaksiyel" },
                        ]}
                      />
                    </div>

                    {hemType === "EXTRAAXIAL" ? (
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-slate-800 mb-2">Tip</div>
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Taraf</div>
                            <Segmented
                              value={hemSide}
                              onChange={(v) => setHemSide(v as Side)}
                              options={[
                                { key: "R", label: "Sağ" },
                                { key: "L", label: "Sol" },
                                { key: "Bilateral", label: "Bilat" },
                                { key: "Midline", label: "Orta" },
                              ]}
                            />
                          </div>

                          <div>
                            <div className="text-xs text-slate-500 mb-1">Yerleşim</div>
                            <Segmented
                              value={extraLoc}
                              onChange={(v) => setExtraLoc(v as ExtraAxialLocation)}
                              options={[
                                { key: "Convexity", label: "Konveksite" },
                                { key: "Falx", label: "Falx" },
                                { key: "Tentorium", label: "Tentoryum" },
                                { key: "Skull base", label: "Skull base" },
                                { key: "Diffuse", label: "Difüz" },
                              ]}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Maks kalınlık (mm)</div>
                            <Input value={thicknessMm} onChange={(e) => setThicknessMm(e.target.value)} placeholder="örn: 8" />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Midline shift (mm)</div>
                            <Input value={midlineShiftMm} onChange={(e) => setMidlineShiftMm(e.target.value)} placeholder="örn: 4" />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Maks çap (cm) (ops.)</div>
                            <Input value={maxDiamCm} onChange={(e) => setMaxDiamCm(e.target.value)} placeholder="örn: 3.2" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Eşlik eden SAH</div>
                              <div className="text-xs text-slate-500">Sulkal/sisternal yayılım</div>
                            </div>
                            <Switch checked={hasSAHExt} onCheckedChange={setHasSAHExt} />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Eşlik eden IVH</div>
                              <div className="text-xs text-slate-500">Ventriküler yayılım</div>
                            </div>
                            <Switch checked={hasIVHExt} onCheckedChange={setHasIVHExt} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-slate-800 mb-2">Tip</div>
                          <Segmented
                            value={intraSubtype}
                            onChange={(v) => setIntraSubtype(v as IntraAxialSubtype)}
                            options={[
                              { key: "ICH", label: "ICH" },
                              { key: "HEM_CONTUSION", label: "Hemorajik kontüzyon" },
                              { key: "SAH", label: "SAH" },
                              { key: "IVH", label: "IVH" },
                            ]}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Taraf</div>
                            <Segmented
                              value={hemSide}
                              onChange={(v) => setHemSide(v as Side)}
                              options={[
                                { key: "R", label: "Sağ" },
                                { key: "L", label: "Sol" },
                                { key: "Bilateral", label: "Bilat" },
                                { key: "Midline", label: "Orta" },
                              ]}
                            />
                          </div>

                          <div>
                            <div className="text-xs text-slate-500 mb-1">Bölge</div>
                            <Segmented
                              value={hemRegion}
                              onChange={(v) => setHemRegion(v as BrainRegion)}
                              options={[
                                { key: "Frontal", label: "Frontal" },
                                { key: "Parietal", label: "Parietal" },
                                { key: "Temporal", label: "Temporal" },
                                { key: "Occipital", label: "Occipital" },
                                { key: "Basal ganglia", label: "Bazal g." },
                                { key: "Thalamus", label: "Talamus" },
                                { key: "Brainstem", label: "Beyin sapı" },
                                { key: "Cerebellum", label: "Serebellum" },
                                { key: "Intraventricular", label: "IVH" },
                                { key: "Diffuse", label: "Difüz" },
                              ]}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Maks çap (cm)</div>
                            <Input value={maxDiamCm} onChange={(e) => setMaxDiamCm(e.target.value)} placeholder="örn: 2.5" />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Midline shift (mm)</div>
                            <Input value={midlineShiftMm} onChange={(e) => setMidlineShiftMm(e.target.value)} placeholder="örn: 6" />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Ek evre/sinyal ipucu (ops.)</div>
                            <Input value={bloodAgeHint} onChange={(e) => setBloodAgeHint(e.target.value)} placeholder="örn: subakut lehine" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Eşlik eden SAH</div>
                              <div className="text-xs text-slate-500">Sulkal/sisternal yayılım</div>
                            </div>
                            <Switch checked={hasSAHExt} onCheckedChange={setHasSAHExt} />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="text-sm">
                              <div className="font-medium">Eşlik eden IVH</div>
                              <div className="text-xs text-slate-500">Ventriküler yayılım</div>
                            </div>
                            <Switch checked={hasIVHExt} onCheckedChange={setHasIVHExt} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* FLOW: MASS/INFECTION */}
                {flow === "MASS_INF" && (
                  <div className="rounded-xl border p-4 space-y-4">
                    <SectionTitle>Kitle / Enfeksiyon alt seçimler</SectionTitle>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Lezyon sayısı</div>
                        <Segmented
                          value={lesionCount}
                          onChange={(v) => setLesionCount(v as any)}
                          options={[
                            { key: "SOLITARY", label: "Soliter" },
                            { key: "MULTIPLE", label: "Multipl" },
                          ]}
                        />
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 mb-1">Kompartman</div>
                        <Segmented
                          value={lesionCompartment}
                          onChange={(v) => setLesionCompartment(v as any)}
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
                          <div className="font-medium">Ring tutulum</div>
                          <div className="text-xs text-slate-500">GBM/met/apse ayrımı</div>
                        </div>
                        <Switch checked={ringEnhancing} onCheckedChange={setRingEnhancing} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Difüzyon kısıtlılığı</div>
                          <div className="text-xs text-slate-500">Apse/lenfoma vb.</div>
                        </div>
                        <Switch checked={diffRestriction} onCheckedChange={setDiffRestriction} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Belirgin restriksiyon (güçlü)</div>
                          <div className="text-xs text-slate-500">Lenfoma/apse lehine</div>
                        </div>
                        <Switch checked={restrictedStrong} onCheckedChange={setRestrictedStrong} />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="text-sm">
                          <div className="font-medium">Belirgin ödem</div>
                          <div className="text-xs text-slate-500">Kitle etkisi/vasojenik ödem</div>
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
                          <div className="text-sm font-semibold text-slate-700">Meningiom işaretleri</div>
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
                              <div className="font-medium">Hiperostozis</div>
                              <div className="text-xs text-slate-500">Komşu kemik değişikliği</div>
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
            <div className="sticky top-6 space-y-6">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">AI Çıktı</CardTitle>
                    <Button size="sm" className="rounded-full" onClick={copyAll}>
                      Kopyala
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500">
                    Seçimlere göre canlı güncellenir (kural tabanlı). {copyOk ? <span className="ml-2">{copyOk}</span> : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Final (tek metin)</div>
                    <pre className="whitespace-pre-wrap rounded-xl border p-3 text-sm leading-5">{finalReport}</pre>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-2">DDX (Top) + Why score</div>
                    <div className="space-y-2">
                      {ddx.length ? (
                        ddx.map((d) => (
                          <div key={d.title} className="rounded-xl border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-sm">{d.title}</div>
                              <Badge variant={d.level === "Yüksek" ? "default" : d.level === "Orta" ? "secondary" : "outline"}>
                                {d.level}
                              </Badge>
                            </div>
                            <ul className="mt-2 list-disc pl-5 text-xs text-slate-600 space-y-1">
                              {d.why.filter(Boolean).slice(0, 5).map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">Bu seçimlerle otomatik ddx oluşmadı.</div>
                      )}
                    </div>
                  </div>

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

              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Hızlı kontrol</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700 space-y-2">
                  <div>• BT / MR / BT+MR seçimi çalışıyor mu?</div>
                  <div>• Kanama → ölçüm alanları (kalınlık, MLS, çap) geliyor mu?</div>
                  <div>• Travma → alt seçimler dolu mu?</div>
                  <div>• Kitle/Enfeksiyon → BT’de de alt seçimler görünüyor mu?</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-8 text-xs text-slate-500">
          Kaynak uyumu (özet): Akut kanama/travmada BT temel; seçilmiş olguda CTA/CTV/CTP gibi ek protokoller klinik endikasyona göre kullanılır. :contentReference[oaicite:3]{index=3}
        </div>
      </div>
    </div>
  );
}
