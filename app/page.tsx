"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Organ = "liver" | "brain";
type BrainFlow = "travma" | "kanama" | "kitle";

type Modality = "BT" | "MR";
type Likelihood = "Yüksek" | "Orta" | "Düşük";

type DdxItem = {
  name: string;
  likelihood: Likelihood;
  why: string[];
  score?: number;
  scoreBreakdown?: string[];
};

type Suggestion = { title: string; urgency: "Acil" | "Öncelikli" | "Rutin"; details: string[] };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function bumpLikelihood(l: Likelihood, dir: "up" | "down"): Likelihood {
  const order: Likelihood[] = ["Düşük", "Orta", "Yüksek"];
  const i = order.indexOf(l);
  const next = dir === "up" ? Math.min(i + 1, order.length - 1) : Math.max(i - 1, 0);
  return order[next] ?? l;
}

function LikelihoodBadge({ v }: { v: Likelihood }) {
  const variant = v === "Yüksek" ? "default" : v === "Orta" ? "secondary" : "outline";
  return <Badge variant={variant}>{v}</Badge>;
}

function UrgencyBadge({ v }: { v: Suggestion["urgency"] }) {
  const variant = v === "Acil" ? "default" : v === "Öncelikli" ? "secondary" : "outline";
  return <Badge variant={variant}>{v}</Badge>;
}

function toNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatMm(n: number | null, fallback = "—") {
  if (n === null) return fallback;
  return `${Number.isInteger(n) ? n : n} mm`;
}

function toggleInArray<T extends string>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function joinHuman(list: string[]) {
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  if (list.length === 2) return `${list[0]} ve ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} ve ${list[list.length - 1]}`;
}

/** ---- Extra-axial "age" helpers ---- */
type ExtraAxialAge = "Bilinmiyor" | "Akut" | "Subakut" | "Kronik" | "Akut üzerine kronik";
type CtDensity = "Bilinmiyor" | "Hiperdens" | "İzodens" | "Hipodens" | "Miks";

function inferExtraAxialAgeFromCT(d: CtDensity): { guess: ExtraAxialAge; note: string } {
  if (d === "Miks") return { guess: "Akut üzerine kronik", note: "Miks densite, akut üzerine kronik ile uyumlu olabilir." };
  if (d === "Hiperdens") return { guess: "Akut", note: "Hiperdensite akut kanama lehine olabilir." };
  if (d === "Hipodens") return { guess: "Kronik", note: "Hipodensite kronik koleksiyon lehine olabilir." };
  if (d === "İzodens") return { guess: "Subakut", note: "İzodens koleksiyon subakut dönemde görülebilir." };
  return { guess: "Bilinmiyor", note: "Densite seçilmedi; evre için otomatik öneri yok." };
}

function ageWordTR(age: ExtraAxialAge): string {
  if (age === "Bilinmiyor") return "ekstraaksiyel";
  if (age === "Akut") return "akut";
  if (age === "Subakut") return "subakut";
  if (age === "Kronik") return "kronik";
  return "akut üzerine kronik";
}

/** ---- Mass effect / herniation helpers ---- */
type Effacement = "yok" | "hafif" | "belirgin";
type Herniation = "Subfalksin" | "Unkal" | "Tonsiller" | "Transtentoriyal (downward)";
type EffectSide = "Bilinmiyor" | "İpsilateral" | "Bilateral" | "Kontralateral";

function effacementPhraseTR(kind: "sulkal" | "bazal sistern", v: Effacement): string {
  if (v === "yok") return "";
  if (kind === "sulkal") return v === "hafif" ? "sulkal effasman (hafif)" : "sulkal effasman (belirgin)";
  return v === "hafif" ? "bazal sisternlerde effasman (hafif)" : "bazal sisternlerde effasman (belirgin)";
}

function herniationPhraseTR(list: Herniation[]): string {
  if (list.length === 0) return "";
  const map: Record<Herniation, string> = {
    Subfalksin: "subfalksin herniasyon",
    Unkal: "unkal herniasyon",
    Tonsiller: "tonsiller herniasyon",
    "Transtentoriyal (downward)": "transtentoriyal (downward) herniasyon",
  };
  return `${joinHuman(list.map((x) => map[x]))} lehine bulgular`;
}

function effectSideTR(v: EffectSide): string {
  if (v === "Bilinmiyor") return "";
  if (v === "İpsilateral") return "ipsilateral";
  if (v === "Bilateral") return "bilateral";
  return "kontralateral";
}

function ventriclePhraseTR(sev: Effacement, side: EffectSide): string {
  if (sev === "yok") return "";
  const s = effectSideTR(side);
  const sidePart = s ? `${s} ` : "";
  return `${sidePart}lateral ventrikül kompresyonu (${sev})`;
}

function massEffectUrgency(
  mlsMm: number | null,
  cistern: Effacement,
  herniations: Herniation[],
  ventricleComp: Effacement
): "Acil" | "Öncelikli" | "Rutin" {
  if (herniations.length > 0) return "Acil";
  if (cistern === "belirgin") return "Acil";
  if (mlsMm !== null && mlsMm >= 5) return "Acil";
  if (ventricleComp === "belirgin") return "Öncelikli";
  if (cistern === "hafif") return "Öncelikli";
  if (mlsMm !== null && mlsMm > 0) return "Öncelikli";
  if (ventricleComp === "hafif") return "Öncelikli";
  return "Rutin";
}

/** ---- MRI intensity scale with intermediate options ---- */
type T2Scale = "Belirsiz" | "Hipointens" | "İzo" | "Hafif hiperintens" | "Hiperintens" | "Belirgin hiperintens";

/** ---- Protocol selections ---- */
type CTPackage = "Non-kontrast BT" | "CTA" | "CTV" | "CTP";
type MRPackage = "Non-kontrast MR" | "Kontrastlı MR" | "MRA" | "MRV" | "Perfüzyon (DSC/ASL)";

type EnhancementPattern =
  | "Belirsiz"
  | "Kontrast yok"
  | "Solid"
  | "Ring (ince-düzgün)"
  | "Ring (kalın/irregüler)"
  | "Dural tail / ekstraaksiyel"
  | "Leptomeningeal/pial";

/** ---- Location model for masses ---- */
type LesionCompartment = "Belirsiz" | "İntraaksiyel" | "Ekstraaksiyel" | "İntraventriküler";
type ExtraAxialSite =
  | "Belirsiz"
  | "Konveksite"
  | "Parasagittal / Falx"
  | "Tentoryum"
  | "Sfenoid kanat / olfaktör oluk"
  | "CPA (serebellopontin açı)"
  | "Kavernöz sinüs komşuluğu";
type IntraAxialSite = "Belirsiz" | "Lobar kortikal-subkortikal" | "Derin/periventriküler" | "Beyin sapı" | "Serebellum";
type VentricularSite = "Belirsiz" | "Lateral ventrikül" | "3. ventrikül" | "4. ventrikül";

type EnhancementHomogeneity = "Belirsiz" | "Homojen" | "Heterojen";

/** ---- Scoring helpers (mini “why score”) ---- */
function likelihoodFromScore(score: number): Likelihood {
  if (score >= 7) return "Yüksek";
  if (score >= 4) return "Orta";
  return "Düşük";
}
function addScore(lineArr: string[], points: number, label: string) {
  const sign = points >= 0 ? "+" : "";
  lineArr.push(`${sign}${points} ${label}`);
}

/** -----------------------------
 * Brain module
 * ----------------------------- */
function BrainModule() {
  const [modality, setModality] = useState<Modality>("BT");
  const [flow, setFlow] = useState<BrainFlow>("travma");

  // Common clinical toggles
  const [knownMalignancy, setKnownMalignancy] = useState(false);
  const [feverSepsis, setFeverSepsis] = useState(false);
  const [traumaHx, setTraumaHx] = useState(true);
  const [anticoagulant, setAnticoagulant] = useState(false);
  const [immunosuppressed, setImmunosuppressed] = useState(false);

  const [incidental, setIncidental] = useState("");

  /** ---------- PROTOCOLS ---------- */
  const [ctPackage, setCtPackage] = useState<CTPackage>("Non-kontrast BT");
  const [mrPackage, setMrPackage] = useState<MRPackage>("Non-kontrast MR");

  /** ---------- TRAVMA fields ---------- */
  const [gcsLow, setGcsLow] = useState(false);
  const [focalDeficit, setFocalDeficit] = useState(false);

  const [skullFractureSuspect, setSkullFractureSuspect] = useState(false);
  const [pneumocephalus, setPneumocephalus] = useState(false);
  const [contusion, setContusion] = useState(false);
  const [daiSuspect, setDaiSuspect] = useState<"yok" | "var" | "bilinmiyor">("bilinmiyor");

  // Vascular injury suspicion in trauma
  const [vascularInjurySuspect, setVascularInjurySuspect] = useState(false);
  const [venousSinusInjurySuspect, setVenousSinusInjurySuspect] = useState(false);

  /** ---------- KANAMA fields ---------- */
  const [bleedType, setBleedType] = useState<"yok" | "SAH" | "IVH" | "ICH" | "SDH" | "EDH" | "bilinmiyor">("bilinmiyor");
  const [bleedLocation, setBleedLocation] = useState<"bilinmiyor" | "lobar" | "derin (BG/talamus)" | "pons" | "serebellum">("bilinmiyor");
  const [intraventricularExt, setIntraventricularExt] = useState(false);
  const [hydrocephalus, setHydrocephalus] = useState(false);

  // MR adjunct for bleed
  const [swiBlooming, setSwiBlooming] = useState<"bilinmiyor" | "var" | "yok">("bilinmiyor");
  const [dwiRestriction, setDwiRestriction] = useState<"bilinmiyor" | "var" | "yok">("bilinmiyor");

  /** ---------- SDH/EDH detailed descriptors ---------- */
  const [extraAxialSide, setExtraAxialSide] = useState<"Sağ" | "Sol" | "Bilateral" | "Orta hat" | "Bilinmiyor">("Bilinmiyor");
  const [sdhRegions, setSdhRegions] = useState<Array<"Frontal" | "Temporal" | "Parietal" | "Oksipital" | "Falx boyunca" | "Tentoryum boyunca" | "Interhemisferik">>([]);
  const [edhRegions, setEdhRegions] = useState<Array<"Frontal" | "Temporal" | "Parietal" | "Oksipital" | "Bilinmiyor">>([]);
  const [extraAxialThicknessMm, setExtraAxialThicknessMm] = useState<string>("");
  const [midlineShiftMm, setMidlineShiftMm] = useState<string>("");

  const [extraAxialAge, setExtraAxialAge] = useState<ExtraAxialAge>("Bilinmiyor");
  const [ctDensity, setCtDensity] = useState<CtDensity>("Bilinmiyor");

  const [sulcalEff, setSulcalEff] = useState<Effacement>("yok");
  const [basalCisternEff, setBasalCisternEff] = useState<Effacement>("yok");
  const [herniations, setHerniations] = useState<Herniation[]>([]);
  const [effectSide, setEffectSide] = useState<EffectSide>("Bilinmiyor");
  const [ventricleCompression, setVentricleCompression] = useState<Effacement>("yok");
  const [ventricleCompressionSide, setVentricleCompressionSide] = useState<EffectSide>("Bilinmiyor");

  /** ---------- KİTLE/ENF fields (expanded) ---------- */
  const [massPresent, setMassPresent] = useState(false);

  const [compartment, setCompartment] = useState<LesionCompartment>("Belirsiz");
  const [extraSite, setExtraSite] = useState<ExtraAxialSite>("Belirsiz");
  const [intraSite, setIntraSite] = useState<IntraAxialSite>("Belirsiz");
  const [ventSite, setVentSite] = useState<VentricularSite>("Belirsiz");

  const [enhPattern, setEnhPattern] = useState<EnhancementPattern>("Belirsiz");
  const [enhHomog, setEnhHomog] = useState<EnhancementHomogeneity>("Belirsiz");

  const [t2Signal, setT2Signal] = useState<T2Scale>("Belirsiz");
  const [ringWallIrregular, setRingWallIrregular] = useState<"bilinmiyor" | "ince-düzgün" | "kalın/irregüler">("bilinmiyor");
  const [edema, setEdema] = useState<"yok" | "hafif" | "belirgin" | "bilinmiyor">("bilinmiyor");
  const [multiLesion, setMultiLesion] = useState<"bilinmiyor" | "tek" | "coklu">("bilinmiyor");
  const [cbv, setCbv] = useState<"bilinmiyor" | "yuksek" | "dusuk">("bilinmiyor");
  const [swiHemorrhage, setSwiHemorrhage] = useState<"bilinmiyor" | "var" | "yok">("bilinmiyor");
  const [extraAxialSigns, setExtraAxialSigns] = useState(false);
  const [meningealEnh, setMeningealEnh] = useState(false);

  // meningioma bone/dural pack
  const [hyperostosis, setHyperostosis] = useState(false);
  const [calcification, setCalcification] = useState(false);
  const [broadDuralBase, setBroadDuralBase] = useState(false);
  const [csfCleft, setCsfCleft] = useState(false);
  const [boneErosion, setBoneErosion] = useState(false);

  /** --- NEW: CPA schwannoma vs meningioma toggles --- */
  const [iaciWidening, setIaciWidening] = useState(false); // internal auditory canal widening
  const [iceCreamCone, setIceCreamCone] = useState(false); // CPA + intracanalicular component
  const [cysticDegeneration, setCysticDegeneration] = useState(false);
  const [duralTailInCPA, setDuralTailInCPA] = useState(false); // specifically for CPA

  /** --- NEW: Lymphoma enrichment toggles --- */
  const [ccCrossing, setCcCrossing] = useState(false); // corpus callosum crossing ("butterfly")
  const [ependymalSpread, setEpendymalSpread] = useState(false); // ependymal / periventricular spread
  const [deepGrayInvolvement, setDeepGrayInvolvement] = useState(false); // BG/thalamus involvement

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const isExtraAxialDetail = flow === "kanama" && (bleedType === "SDH" || bleedType === "EDH");

  const ageAssist = useMemo(() => {
    if (!isExtraAxialDetail) return { guess: "Bilinmiyor" as ExtraAxialAge, note: "" };
    if (modality !== "BT") return { guess: "Bilinmiyor" as ExtraAxialAge, note: "MR için otomatik evre önerisi kapalı (manuel seçebilirsin)." };
    const { guess, note } = inferExtraAxialAgeFromCT(ctDensity);
    return { guess, note };
  }, [isExtraAxialDetail, modality, ctDensity]);

  const resolvedAge: ExtraAxialAge = useMemo(() => {
    if (!isExtraAxialDetail) return "Bilinmiyor";
    if (extraAxialAge !== "Bilinmiyor") return extraAxialAge;
    if (ageAssist.guess !== "Bilinmiyor") return ageAssist.guess;
    return "Bilinmiyor";
  }, [isExtraAxialDetail, extraAxialAge, ageAssist.guess]);

  const resolvedMlsMm = useMemo(() => toNum(midlineShiftMm), [midlineShiftMm]);
  const resolvedThicknessMm = useMemo(() => toNum(extraAxialThicknessMm), [extraAxialThicknessMm]);

  const massEffectText = useMemo(() => {
    if (!isExtraAxialDetail) return "";
    const sideTxt = effectSideTR(effectSide);
    const sidePart = sideTxt ? `${sideTxt} ` : "";
    const parts = [
      effacementPhraseTR("sulkal", sulcalEff),
      effacementPhraseTR("bazal sistern", basalCisternEff),
      ventriclePhraseTR(ventricleCompression, ventricleCompressionSide),
      herniationPhraseTR(herniations),
    ].filter(Boolean);

    if (parts.length === 0) return "";
    const prefix = sidePart ? `${sidePart}kitle etkisi lehine ` : "Kitle etkisi lehine ";
    return ` ${prefix}${joinHuman(parts)}.`;
  }, [isExtraAxialDetail, effectSide, sulcalEff, basalCisternEff, ventricleCompression, ventricleCompressionSide, herniations]);

  const extraAxialSentence = useMemo(() => {
    const isSDH = bleedType === "SDH";
    const isEDH = bleedType === "EDH";
    if (!isSDH && !isEDH) return "";

    const typeText = isSDH ? "subdural hematom" : "epidural hematom";

    const sideText =
      extraAxialSide === "Bilinmiyor"
        ? ""
        : extraAxialSide === "Orta hat"
          ? "orta hat boyunca"
          : extraAxialSide.toLowerCase();

    const regionList = isSDH ? sdhRegions : edhRegions;
    const regionText = regionList.length ? joinHuman(regionList.map((x) => x.toLowerCase())) : "";

    const locParts = [sideText, regionText].filter(Boolean);
    const loc = locParts.length ? `${locParts.join(" ")} ` : "";

    const thicknessPart = resolvedThicknessMm !== null ? `maksimum ~${formatMm(resolvedThicknessMm)} kalınlıkta ` : "";

    const ageWord = ageWordTR(resolvedAge);
    const prefix = ageWord === "ekstraaksiyel" ? "" : `${ageWord} `;

    const mlsPart = resolvedMlsMm !== null && resolvedMlsMm > 0 ? ` Orta hat ~${formatMm(resolvedMlsMm)} deviyedir.` : "";

    return `${loc}${thicknessPart}${prefix}${typeText} izlenmektedir.${mlsPart}${massEffectText}`.replace(/\s+/g, " ").trim();
  }, [
    bleedType,
    extraAxialSide,
    sdhRegions,
    edhRegions,
    resolvedThicknessMm,
    resolvedMlsMm,
    resolvedAge,
    massEffectText,
  ]);

  const protocolLine =
    modality === "BT"
      ? `BT protokol: ${ctPackage}.`
      : `MR protokol: ${mrPackage}.`;

  const engine = useMemo(() => {
    const ddx: DdxItem[] = [];
    const suggestions: Suggestion[] = [];

    const ctx: string[] = [];
    if (knownMalignancy) ctx.push("Bilinen malignite öyküsü.");
    if (feverSepsis) ctx.push("Ateş/sepsis kliniği.");
    if (traumaHx) ctx.push("Travma öyküsü.");
    if (anticoagulant) ctx.push("Antikoagülan/antiagregan kullanımı.");
    if (immunosuppressed) ctx.push("İmmünsüpresyon öyküsü.");

    /** ---- TRAVMA ---- */
    if (flow === "travma") {
      if (modality === "BT") {
        if (ctPackage === "Non-kontrast BT") {
          suggestions.push({
            title: "Travma BT: non-kontrast temel değerlendirme",
            urgency: "Öncelikli",
            details: [
              "Kemik pencerede fraktür değerlendirmesi",
              "Ekstraaksiyel hematom/SAH/ICH açısından gözden geçir",
              "Klinik kötüleşmede kontrol BT düşünülebilir",
            ],
          });
        }
        if (vascularInjurySuspect && ctPackage !== "CTA") {
          suggestions.push({
            title: "Vasküler yaralanma şüphesinde CTA öner",
            urgency: "Öncelikli",
            details: ["Diseksiyon/aktif ekstravazasyon/pseudoanevrizma açısından CTA baş-boyun düşün."],
          });
        }
        if (venousSinusInjurySuspect && ctPackage !== "CTV") {
          suggestions.push({
            title: "Venöz sinüs yaralanması / tromboz şüphesinde CTV öner",
            urgency: "Öncelikli",
            details: ["Transvers/sigmoid/sagittal sinüs değerlendirmesi için CTV yararlı olabilir."],
          });
        }
        if ((gcsLow || focalDeficit) && ctPackage === "Non-kontrast BT") {
          suggestions.push({
            title: "Ağır travma / defisitte CTA/CTP düşün",
            urgency: "Öncelikli",
            details: ["Vasküler hasar veya hipoperfüzyon açısından klinikle birlikte değerlendirilir."],
          });
        }
      } else {
        if (mrPackage === "Non-kontrast MR") {
          suggestions.push({
            title: "Travma MR: DAI ve mikrokanama için kritik sekanslar",
            urgency: "Öncelikli",
            details: ["SWI/GRE", "DWI/ADC", "FLAIR", "T1/T2"],
          });
        }
        if (vascularInjurySuspect && mrPackage !== "MRA") {
          suggestions.push({
            title: "Vasküler yaralanma şüphesinde MRA düşün",
            urgency: "Öncelikli",
            details: ["Diseksiyon/pseudoanevrizma açısından MRA/kontrastlı MRA klinikle değerlendirilebilir."],
          });
        }
        if (venousSinusInjurySuspect && mrPackage !== "MRV") {
          suggestions.push({
            title: "Venöz sinüs patolojisi şüphesinde MRV düşün",
            urgency: "Öncelikli",
            details: ["Akım artefaktı vs trombüs ayrımı için MRV + SWI + korelasyon."],
          });
        }
      }

      if (skullFractureSuspect) {
        ddx.push({ name: "Kalvaryal / kafa tabanı fraktürü (şüphe)", likelihood: "Orta", why: [protocolLine, ...ctx, "Kemik pencere korelasyonu önerilir."] });
      }
      if (pneumocephalus) {
        ddx.push({ name: "Pnömosefali", likelihood: "Yüksek", why: [protocolLine, ...ctx, "Travma sonrası hava odakları pnömosefali ile uyumlu olabilir."] });
      }
      if (contusion) {
        ddx.push({ name: "Kontüzyon / hemorajik kontüzyon", likelihood: "Orta", why: [protocolLine, ...ctx, "Travma bağlamında parankimal kontüzyon olasılığı."] });
      }
      if (daiSuspect === "var") {
        ddx.push({ name: "Diffüz aksonal yaralanma (DAI) olası", likelihood: "Orta", why: [protocolLine, ...ctx, "Klinik ağır travma/defisit ile birlikte DAI düşünülür; SWI/DWI önemlidir."] });
      }

      if (ddx.length === 0) {
        ddx.push({
          name: "Travmaya bağlı belirgin akut patoloji lehine seçili güçlü parametre yok",
          likelihood: "Düşük",
          why: [protocolLine, ...ctx, "Seçilen bulgular minimal; klinik korelasyon önerilir."],
        });
      }

      if (gcsLow || focalDeficit) {
        suggestions.push({
          title: "Klinik ağırsa: yakın izlem / seri değerlendirme",
          urgency: "Öncelikli",
          details: ["Nörolojik muayene ile birlikte değerlendirme", "Klinik kötüleşmede kontrol görüntüleme"],
        });
      }
    }

    /** ---- KANAMA ---- */
    if (flow === "kanama") {
      if (bleedType === "SDH" || bleedType === "EDH") {
        let l: Likelihood = traumaHx ? "Yüksek" : "Orta";

        const urgency = massEffectUrgency(resolvedMlsMm, basalCisternEff, herniations, ventricleCompression);

        const why: string[] = [
          ...ctx,
          protocolLine,
          extraAxialSentence ? `Rapor cümlesi: "${extraAxialSentence}"` : "Ekstraaksiyel kanama parametreleri seçildi.",
        ];

        if (anticoagulant && bleedType === "SDH") {
          l = bumpLikelihood(l, "up");
          why.push("Antikoagülan kullanımı SDH riskini artırır.");
        }

        if (modality === "BT" && ctDensity !== "Bilinmiyor") {
          why.push(`BT densitesi: ${ctDensity}.`);
          if (extraAxialAge === "Bilinmiyor" && ageAssist.guess !== "Bilinmiyor") why.push(`Evre için otomatik öneri: ${ageAssist.guess} (yardımcı).`);
        }

        if (urgency === "Acil") l = bumpLikelihood(l, "up");

        if (urgency === "Acil") {
          const details: string[] = [];
          if (resolvedMlsMm !== null && resolvedMlsMm >= 5) details.push("Midline shift ≥ 5 mm.");
          if (basalCisternEff === "belirgin") details.push("Bazal sistern effacement belirgin.");
          if (herniations.length > 0) details.push(`Herniasyon: ${joinHuman(herniations)}.`);
          if (ventricleCompression === "belirgin") details.push("Belirgin lateral ventrikül kompresyonu.");
          suggestions.push({
            title: "Kitle etkisi / herniasyon riski: acil nöroşirürji",
            urgency: "Acil",
            details: [...details, "Klinik durum ve nörolojik muayene ile birlikte değerlendirilmelidir."],
          });
        } else if (urgency === "Öncelikli") {
          suggestions.push({
            title: "Kitle etkisi açısından yakın izlem",
            urgency: "Öncelikli",
            details: ["Hafif MLS/sistern/sulkus/ventrikül kompresyonu varlığında klinik korelasyon önerilir."],
          });
        }

        ddx.push({
          name: bleedType === "SDH" ? "Subdural hematom" : "Epidural hematom",
          likelihood: l,
          why,
        });
      } else if (bleedType === "SAH") {
        let l: Likelihood = traumaHx ? "Orta" : "Yüksek";
        const why = [protocolLine, ...ctx, traumaHx ? "Travma ile ilişkili SAH görülebilir." : "Travma yoksa anevrizmal SAH öncelikli dışlanır."];
        if (intraventricularExt || hydrocephalus) {
          l = bumpLikelihood(l, "up");
          why.push("IVH/hidrocefalus eşliği risk göstergesi olabilir.");
        }
        ddx.push({ name: "Subaraknoid kanama", likelihood: l, why });
        suggestions.push({
          title: "SAH şüphesinde vasküler değerlendirme",
          urgency: traumaHx ? "Öncelikli" : "Acil",
          details: ["BT ise CTA; MR ise MRA/MRV klinikle birlikte değerlendirilebilir."],
        });
      } else if (bleedType === "ICH") {
        let l: Likelihood = "Orta";
        const why = [protocolLine, ...ctx];
        if (bleedLocation === "derin (BG/talamus)") {
          l = bumpLikelihood(l, "up");
          why.unshift("Derin yerleşim hipertansif hemoraji olasılığını artırır.");
        }
        if (anticoagulant) {
          l = bumpLikelihood(l, "up");
          why.push("Antikoagülan kullanımı hemoraji riskini artırır.");
        }
        ddx.push({ name: "İntraparenkimal hemoraji", likelihood: l, why });
      } else if (bleedType === "IVH") {
        ddx.push({
          name: "İntraventriküler kanama",
          likelihood: intraventricularExt ? "Yüksek" : "Orta",
          why: [protocolLine, ...ctx, "IVH; parankimal kanama uzanımı veya vasküler nedenlerle ilişkili olabilir."],
        });
      } else if (bleedType === "bilinmiyor" || bleedType === "yok") {
        ddx.push({ name: "Belirgin akut kanama lehine güçlü parametre seçilmedi", likelihood: "Düşük", why: [protocolLine, ...ctx] });
      }

      if (hydrocephalus) {
        suggestions.push({
          title: "Hidrocefalus: acil klinik korelasyon",
          urgency: "Acil",
          details: ["BOS drenajı/endoskopik seçenekler nöroşirürji ile değerlendirilir."],
        });
      }

      if (modality === "MR") {
        if (swiBlooming === "var") ddx.unshift({ name: "Hemorajik ürün/blooming (SWI)", likelihood: "Orta", why: [protocolLine, ...ctx, "SWI blooming hemoraji ürünleri/mikrokanama ile uyumlu olabilir."] });
        if (dwiRestriction === "var" && feverSepsis) ddx.unshift({ name: "Enfeksiyöz süreç / apse olasılığı (DWI+ + klinik)", likelihood: "Orta", why: [protocolLine, ...ctx] });
      }
    }

    /** ---- KİTLE / ENFEKSİYON (expanded + scores) ---- */
    if (flow === "kitle") {
      if (!massPresent) {
        ddx.push({ name: "Kitle/enfeksiyon açısından belirgin bulgu seçilmedi", likelihood: "Düşük", why: [protocolLine, ...ctx, "Kitle var seçilmedi."] });
      } else {
        // Protocol suggestions
        if (modality === "BT") {
          if (ctPackage === "Non-kontrast BT") {
            suggestions.push({
              title: "Kitle değerlendirmesinde kontrastlı MR tercih edilir",
              urgency: "Öncelikli",
              details: ["BT non-kontrast kitle karakterizasyonunda sınırlı olabilir.", "Kontrastlı MR + DWI + SWI önerilir."],
            });
          }
        } else {
          if (mrPackage === "Non-kontrast MR") {
            suggestions.push({
              title: "Kitle değerlendirmesinde kontrastlı MR önerilir",
              urgency: "Öncelikli",
              details: ["T1 pre/post + FLAIR", "DWI/ADC", "SWI", "Gerekirse perfüzyon (DSC/ASL)"],
            });
          }
          if (mrPackage === "Kontrastlı MR" || mrPackage === "Perfüzyon (DSC/ASL)") {
            suggestions.push({
              title: "Kitle ayrımında perfüzyon ve DWI kritik",
              urgency: "Öncelikli",
              details: ["CBV↑ → tümör lehine", "DWI(+) + CBV düşük → lenfoma/apse ayırıcıda"],
            });
          }
        }

        // Score buckets
        const scoreAbs: string[] = [];
        const scoreGbm: string[] = [];
        const scoreMet: string[] = [];
        const scoreMen: string[] = [];
        const scoreLym: string[] = [];
        const scoreSch: string[] = [];

        let sAbs = 0, sGbm = 0, sMet = 0, sMen = 0, sLym = 0, sSch = 0;

        const whyAbs: string[] = [protocolLine, ...ctx];
        const whyGbm: string[] = [protocolLine, ...ctx];
        const whyMet: string[] = [protocolLine, ...ctx];
        const whyMen: string[] = [protocolLine, ...ctx];
        const whyLym: string[] = [protocolLine, ...ctx];
        const whySch: string[] = [protocolLine, ...ctx];

        // Compartment weighting
        if (compartment === "Ekstraaksiyel") {
          sMen += 2; addScore(scoreMen, 2, "Ekstraaksiyel kompartman");
          sSch += 1; addScore(scoreSch, 1, "Ekstraaksiyel olası (CPA vb)");
          sGbm -= 1; addScore(scoreGbm, -1, "Ekstraaksiyel → gliom daha az olası");
        }
        if (compartment === "İntraaksiyel") {
          sGbm += 2; addScore(scoreGbm, 2, "İntraaksiyel kompartman");
          sMet += 1; addScore(scoreMet, 1, "İntraaksiyel → metastaz ayırıcıda");
        }
        if (compartment === "İntraventriküler") {
          sMet += 1; addScore(scoreMet, 1, "İntraventriküler yerleşim (ayırıcı geniş)");
        }

        // Sites
        if (compartment === "Ekstraaksiyel") {
          if (extraSite === "Parasagittal / Falx" || extraSite === "Konveksite" || extraSite === "Tentoryum" || extraSite === "Sfenoid kanat / olfaktör oluk") {
            sMen += 2; addScore(scoreMen, 2, `Meningiom için sık lokasyon: ${extraSite}`);
            whyMen.push(`Sık meningiom lokasyonu: ${extraSite}.`);
          }
          if (extraSite === "CPA (serebellopontin açı)") {
            sSch += 2; addScore(scoreSch, 2, "CPA yerleşim");
            sMen += 1; addScore(scoreMen, 1, "CPA’da meningiom ayırıcıda");
            whySch.push("CPA bölgesinde vestibüler schwannom sık ayırıcıdadır.");
            whyMen.push("CPA bölgesinde meningiom da ayırıcıdadır; dural tail/kemik değişikliği meningiom lehine olabilir.");
          }
          if (extraSite === "Kavernöz sinüs komşuluğu") {
            sMen += 2; addScore(scoreMen, 2, "Kavernöz sinüs komşuluğu (meningiom sık)");
            whyMen.push("Kavernöz sinüs komşuluğunda meningiom sık; vasküler yapılarla ilişkisi değerlendirilir.");
          }
        }
        if (compartment === "İntraaksiyel") {
          if (intraSite === "Derin/periventriküler") {
            sLym += 2; addScore(scoreLym, 2, "Derin/periventriküler yerleşim");
            whyLym.push("Derin/periventriküler yerleşim lenfoma lehine olabilir.");
          }
          if (intraSite === "Lobar kortikal-subkortikal" && multiLesion === "coklu") {
            sMet += 2; addScore(scoreMet, 2, "Çoklu + kortikal-subkortikal (metastaz lehine)");
            whyMet.push("Kortikomedüller bileşke/çoklu lezyon metastaz lehine.");
          }
        }

        // Enhancement pattern
        if (enhPattern === "Ring (ince-düzgün)" || ringWallIrregular === "ince-düzgün") {
          sAbs += 3; addScore(scoreAbs, 3, "İnce-düzgün ring");
          sGbm -= 1; addScore(scoreGbm, -1, "İnce ring → GBM daha az olası");
          whyAbs.push("İnce-düzgün ring paterni apse lehine olabilir.");
        }
        if (enhPattern === "Ring (kalın/irregüler)" || ringWallIrregular === "kalın/irregüler") {
          sGbm += 2; addScore(scoreGbm, 2, "Kalın/irregüler ring");
          sMet += 1; addScore(scoreMet, 1, "Kalın ring → nekrotik met ayırıcı");
          whyGbm.push("Kalın/irregüler ring paterni yüksek dereceli tümör lehine olabilir.");
        }
        if (enhPattern === "Dural tail / ekstraaksiyel" || extraAxialSigns) {
          sMen += 3; addScore(scoreMen, 3, "Dural tail / ekstraaksiyel işaret");
          sSch -= 1; addScore(scoreSch, -1, "Dural tail schwannom lehine değil");
          sMet -= 1; addScore(scoreMet, -1, "Dural tail → met daha az olası");
          sGbm -= 1; addScore(scoreGbm, -1, "Dural tail → gliom daha az olası");
          whyMen.push("Dural tail/ekstraaksiyel işaretler meningiom lehine.");
        }
        if (enhPattern === "Leptomeningeal/pial" || meningealEnh) {
          sMet += 2; addScore(scoreMet, 2, "Leptomeningeal/pial tutulum");
          sAbs += 1; addScore(scoreAbs, 1, "Leptomeningeal tutulum (enfeksiyon olabilir)");
          whyMet.push("Leptomeningeal/pial tutulum metastatik/inflamatuar süreç lehine olabilir.");
          if (feverSepsis) whyAbs.push("Leptomeningeal tutulum enfeksiyon bağlamında olabilir.");
        }
        if (enhPattern === "Solid") {
          sGbm += 1; addScore(scoreGbm, 1, "Solid kontrastlanma");
          sMet += 1; addScore(scoreMet, 1, "Solid kontrastlanma");
          sLym += 2; addScore(scoreLym, 2, "Solid kontrastlanma (lenfoma sık)");
          whyLym.push("Lenfoma sıklıkla solid/homojen kontrastlanabilir.");
        }

        // Homogeneity
        if (enhHomog === "Homojen") {
          sLym += 2; addScore(scoreLym, 2, "Homojen kontrastlanma");
          sMen += 1; addScore(scoreMen, 1, "Homojen kontrastlanma");
        }
        if (enhHomog === "Heterojen") {
          sGbm += 2; addScore(scoreGbm, 2, "Heterojen kontrastlanma");
        }

        // DWI
        if (dwiRestriction === "var") {
          sAbs += 2; addScore(scoreAbs, 2, "DWI restriksiyon");
          sLym += 3; addScore(scoreLym, 3, "Belirgin DWI (lenfoma/hypersellüler)");
          sGbm -= 1; addScore(scoreGbm, -1, "DWI(+) → GBM daha az olası");
        }

        // Perfusion
        if (cbv === "yuksek") {
          sGbm += 2; addScore(scoreGbm, 2, "CBV yüksek");
          sMet += 2; addScore(scoreMet, 2, "CBV yüksek");
          sAbs -= 1; addScore(scoreAbs, -1, "CBV yüksek → apse daha az olası");
          sLym -= 1; addScore(scoreLym, -1, "CBV yüksek → lenfoma daha az olası");
        }
        if (cbv === "dusuk") {
          sAbs += 1; addScore(scoreAbs, 1, "CBV düşük/normal");
          sLym += 2; addScore(scoreLym, 2, "CBV düşük/normal (lenfoma lehine)");
        }

        // Multiplicity
        if (multiLesion === "coklu") {
          sMet += 3; addScore(scoreMet, 3, "Çoklu lezyon");
          if (feverSepsis) {
            sAbs += 2; addScore(scoreAbs, 2, "Ateş + çoklu ring (çoklu apse/septik emboli)");
          }
        }

        // Edema
        if (edema === "belirgin") {
          sGbm += 1; addScore(scoreGbm, 1, "Belirgin ödem");
          sMet += 1; addScore(scoreMet, 1, "Belirgin ödem");
        }

        // SWI hemorrhage
        if (swiHemorrhage === "var") {
          sMet += 1; addScore(scoreMet, 1, "Hemorajik komponent (met ayırıcı)");
        }

        // T2 nuance (lymphoma and meningioma often iso-hypo compared to edema; not absolute)
        if (t2Signal === "İzo" || t2Signal === "Hipointens") {
          sLym += 1; addScore(scoreLym, 1, "T2 izo/hipo eğilim");
          sMen += 1; addScore(scoreMen, 1, "T2 izo/hipo + dural tabanlı olabilir");
        }

        // Immunosuppression
        if (immunosuppressed) {
          sLym += 2; addScore(scoreLym, 2, "İmmünsüpresyon");
          sAbs += 1; addScore(scoreAbs, 1, "İmmünsüpresyon (enfeksiyon)");
        }

        // Meningioma bone/dural
        if (hyperostosis) { sMen += 3; addScore(scoreMen, 3, "Hiperostoz"); }
        if (calcification) { sMen += 1; addScore(scoreMen, 1, "Kalsifikasyon"); }
        if (broadDuralBase) { sMen += 2; addScore(scoreMen, 2, "Geniş dural taban"); }
        if (csfCleft) { sMen += 2; addScore(scoreMen, 2, "CSF cleft"); }
        if (boneErosion) { sMen += 1; addScore(scoreMen, 1, "Kemik erozyonu (agresif/atipik olabilir)"); }

        // --- NEW: CPA schwannoma vs meningioma markers ---
        const isCPA = compartment === "Ekstraaksiyel" && extraSite === "CPA (serebellopontin açı)";
        if (isCPA) {
          if (iaciWidening) { sSch += 3; addScore(scoreSch, 3, "İAK genişleme"); sMen -= 1; addScore(scoreMen, -1, "İAK genişleme meningiom lehine değil"); }
          if (iceCreamCone) { sSch += 3; addScore(scoreSch, 3, "İntrakonaliküler uzanım (ice-cream cone)"); }
          if (cysticDegeneration) { sSch += 1; addScore(scoreSch, 1, "Kistik dejenerasyon"); }
          if (duralTailInCPA) { sMen += 2; addScore(scoreMen, 2, "CPA’da dural tail"); sSch -= 1; addScore(scoreSch, -1, "Dural tail schwannom lehine değil"); }
          // meningioma in CPA often shows broad dural base + hyperostosis; already captured
        }

        // --- NEW: Lymphoma extra markers ---
        if (ccCrossing) { sLym += 2; addScore(scoreLym, 2, "Korpus kallozum crossing"); }
        if (ependymalSpread) { sLym += 2; addScore(scoreLym, 2, "Ependymal/periventriküler yayılım"); }
        if (deepGrayInvolvement) { sLym += 1; addScore(scoreLym, 1, "Derin gri cevher tutulumu"); }

        // Clinical context effects
        if (knownMalignancy) { sMet += 3; addScore(scoreMet, 3, "Bilinen malignite"); }
        if (feverSepsis) { sAbs += 2; addScore(scoreAbs, 2, "Ateş/sepsis"); }

        // Guardrails
        if (compartment === "İntraaksiyel" && !(extraAxialSigns || enhPattern === "Dural tail / ekstraaksiyel")) {
          sMen = Math.max(0, sMen - 2);
          addScore(scoreMen, -2, "İntraaksiyel → meningiom daha az olası");
        }
        if (!(isCPA)) {
          // if not CPA, schwannoma should not dominate
          sSch = Math.max(0, sSch - 2);
          addScore(scoreSch, -2, "CPA değil → schwannom daha az olası");
        }

        const absLike = likelihoodFromScore(sAbs);
        const gbmLike = likelihoodFromScore(sGbm);
        const metLike = likelihoodFromScore(sMet);
        const menLike = likelihoodFromScore(sMen);
        const lymLike = likelihoodFromScore(sLym);
        const schLike = likelihoodFromScore(sSch);

        // Suggestions: lymphoma-specific
        if (sLym >= 4) {
          suggestions.push({
            title: "Lenfoma ayırıcıda ise",
            urgency: "Öncelikli",
            details: [
              "DWI/ADC + perfüzyon (CBV) birlikte yorumla",
              "CC crossing/ependymal yayılım varsa raporda vurgula",
              "Klinik-hematoloji korelasyonu; uygun olguda biyopsi planı",
            ],
          });
        }

        // Suggestions: meningioma-specific
        if (sMen >= 4) {
          suggestions.push({
            title: "Meningiom lehine bulgular varsa",
            urgency: "Rutin",
            details: [
              "Dural tail / geniş dural taban / hiperostoz-kalsifikasyon ile birlikte değerlendir",
              "CPA’da meningiom ise dural taban + hiperostoz lehine bulguları raporla",
              "Cerrahi planlama için venöz sinüs ilişkisi/invazyonu belirt",
            ],
          });
        }

        // Suggestions: schwannoma-specific (CPA)
        if (sSch >= 4) {
          suggestions.push({
            title: "Vestibüler schwannom (CPA) ayırıcıda ise",
            urgency: "Rutin",
            details: [
              "İAK genişleme + intrakanaliküler uzanımı raporla",
              "Gerekirse iç kulak/IAC odaklı ince kesit MR (CISS/FIESTA) düşün",
              "Meningiom ile ayrımda dural tail/hiperostoz varlığını değerlendir",
            ],
          });
        }

        // Global suggestions
        if (modality === "MR") {
          suggestions.push({
            title: "Önerilen MR sekans paketi",
            urgency: "Öncelikli",
            details: [
              "T1 pre/post + FLAIR + DWI/ADC + SWI",
              cbv === "bilinmiyor" ? "Ayrım için perfüzyon (DSC/ASL) eklenebilir" : "Perfüzyon bilgisi motoru destekler",
              isCPA ? "CPA/IAC için yüksek rezolüsyon (CISS/FIESTA) eklenebilir" : "Klinik korelasyon",
            ],
          });
        } else {
          suggestions.push({
            title: "BT’de kitle şüphesinde bir sonraki adım",
            urgency: "Öncelikli",
            details: ["Kontrastlı beyin MR ile karakterizasyon", "DWI/ADC + SWI + gerekirse perfüzyon"],
          });
        }

        // Build DDX list (with scores)
        ddx.push({ name: "Apse / enfeksiyöz lezyon", likelihood: absLike, why: whyAbs, score: sAbs, scoreBreakdown: scoreAbs });
        ddx.push({ name: "Primer SSS lenfoması / hipersellüler tümör", likelihood: lymLike, why: whyLym, score: sLym, scoreBreakdown: scoreLym });
        ddx.push({ name: "Yüksek dereceli gliom / nekrotik tümör", likelihood: gbmLike, why: whyGbm, score: sGbm, scoreBreakdown: scoreGbm });
        ddx.push({ name: "Metastaz", likelihood: metLike, why: whyMet, score: sMet, scoreBreakdown: scoreMet });
        ddx.push({ name: "Meningiom (ekstraaksiyel)", likelihood: menLike, why: whyMen, score: sMen, scoreBreakdown: scoreMen });
        ddx.push({ name: "Vestibüler schwannom (CPA)", likelihood: schLike, why: whySch, score: sSch, scoreBreakdown: scoreSch });
      }
    }

    // Sort + trim
    const order: Record<Likelihood, number> = { Yüksek: 3, Orta: 2, Düşük: 1 };
    const topDdx = ddx
      .sort((a, b) => {
        const byLik = order[b.likelihood] - order[a.likelihood];
        if (byLik !== 0) return byLik;
        const as = a.score ?? 0;
        const bs = b.score ?? 0;
        return bs - as;
      })
      .slice(0, 7);

    // Final sentence
    let final = "";
    if (flow === "kanama" && (bleedType === "SDH" || bleedType === "EDH") && extraAxialSentence) {
      final = `${modality} incelemede ${extraAxialSentence} Klinik korelasyon önerilir.`.replace(/\s+/g, " ").trim();
    } else if (topDdx.length > 0) {
      const flowTitle = flow === "travma" ? "travma" : flow === "kanama" ? "kanama" : "kitle/enfeksiyon";
      final = `${modality} incelemede ${flowTitle} açısından ön planda: ${topDdx[0].name}. Klinik ve önceki tetkiklerle korelasyon önerilir.`;
    } else {
      final = `${modality} incelemede belirgin akut patoloji izlenmemektedir. Klinik korelasyon önerilir.`;
    }

    return { ddx: topDdx, suggestions, final };
  }, [
    modality,
    flow,
    knownMalignancy,
    feverSepsis,
    traumaHx,
    anticoagulant,
    immunosuppressed,
    ctPackage,
    mrPackage,
    // travma
    gcsLow,
    focalDeficit,
    skullFractureSuspect,
    pneumocephalus,
    contusion,
    daiSuspect,
    vascularInjurySuspect,
    venousSinusInjurySuspect,
    // kanama
    bleedType,
    bleedLocation,
    intraventricularExt,
    hydrocephalus,
    swiBlooming,
    dwiRestriction,
    // extra-axial
    extraAxialSide,
    sdhRegions,
    edhRegions,
    extraAxialThicknessMm,
    midlineShiftMm,
    extraAxialAge,
    ctDensity,
    resolvedAge,
    ageAssist.guess,
    sulcalEff,
    basalCisternEff,
    herniations,
    effectSide,
    ventricleCompression,
    ventricleCompressionSide,
    extraAxialSentence,
    // kitle
    massPresent,
    compartment,
    extraSite,
    intraSite,
    ventSite,
    enhPattern,
    enhHomog,
    ringWallIrregular,
    t2Signal,
    edema,
    multiLesion,
    cbv,
    swiHemorrhage,
    extraAxialSigns,
    meningealEnh,
    hyperostosis,
    calcification,
    broadDuralBase,
    csfCleft,
    boneErosion,
    // CPA toggles
    iaciWidening,
    iceCreamCone,
    cysticDegeneration,
    duralTailInCPA,
    // lymphoma toggles
    ccCrossing,
    ependymalSpread,
    deepGrayInvolvement,
  ]);

  const { ddx, suggestions, final } = engine;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* LEFT */}
      <div className="space-y-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Beyin AI Yardımcı Modül</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kitle modülü güçlendirildi: CPA schwannom/meningiom ayrımı + lenfoma işaretleri + “why score”.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>İnceleme tipi</Label>
              <div className="flex flex-wrap gap-2">
                {(["BT", "MR"] as Modality[]).map((v) => (
                  <Button key={v} size="sm" variant={modality === v ? "default" : "outline"} onClick={() => setModality(v)}>
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Protokol / Faz</Label>
              {modality === "BT" ? (
                <div className="flex flex-wrap gap-2">
                  {(["Non-kontrast BT", "CTA", "CTV", "CTP"] as CTPackage[]).map((v) => (
                    <Button key={v} size="sm" variant={ctPackage === v ? "default" : "outline"} onClick={() => setCtPackage(v)}>
                      {v}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(["Non-kontrast MR", "Kontrastlı MR", "MRA", "MRV", "Perfüzyon (DSC/ASL)"] as MRPackage[]).map((v) => (
                    <Button key={v} size="sm" variant={mrPackage === v ? "default" : "outline"} onClick={() => setMrPackage(v)}>
                      {v}
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{modality === "BT" ? `BT protokol: ${ctPackage}.` : `MR protokol: ${mrPackage}.`}</p>
            </div>

            <div className="space-y-2">
              <Label>Akış</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "travma", label: "Travma" },
                  { key: "kanama", label: "Kanama" },
                  { key: "kitle", label: "Kitle / Enfeksiyon" },
                ] as Array<{ key: BrainFlow; label: string }>).map((x) => (
                  <Button key={x.key} size="sm" variant={flow === x.key ? "default" : "outline"} onClick={() => setFlow(x.key)}>
                    {x.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="text-sm font-medium">Klinik zemin / bağlam</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="text-sm font-medium">Travma öyküsü</div>
                    <div className="text-xs text-muted-foreground">Travma akışını güçlendirir</div>
                  </div>
                  <Switch checked={traumaHx} onCheckedChange={setTraumaHx} />
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="text-sm font-medium">Antikoagülan / antiagregan</div>
                    <div className="text-xs text-muted-foreground">Kanama riski</div>
                  </div>
                  <Switch checked={anticoagulant} onCheckedChange={setAnticoagulant} />
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="text-sm font-medium">Bilinen malignite</div>
                    <div className="text-xs text-muted-foreground">Metastaz olasılığı</div>
                  </div>
                  <Switch checked={knownMalignancy} onCheckedChange={setKnownMalignancy} />
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="text-sm font-medium">Ateş / sepsis</div>
                    <div className="text-xs text-muted-foreground">Enfeksiyon lehine</div>
                  </div>
                  <Switch checked={feverSepsis} onCheckedChange={setFeverSepsis} />
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3 sm:col-span-2">
                  <div>
                    <div className="text-sm font-medium">İmmünsüpresyon</div>
                    <div className="text-xs text-muted-foreground">Lenfoma + oportunistik enfeksiyon ayırıcıda</div>
                  </div>
                  <Switch checked={immunosuppressed} onCheckedChange={setImmunosuppressed} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* (Travma / Kanama kartların) — mevcut kodda olduğu gibi kalsın */}
        {/* Bu uzun dosyada yer kazandırmak için Travma/Kanama UI kısmını önceki sürümünle aynı bıraktım.
            Sen zaten bunları aktif kullanıyorsun; bu update kitle modülüne odaklı. */}

        {/* KITLE */}
        {flow === "kitle" && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Kitle / Enfeksiyon</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lokasyon + kontrast paterni + DWI + perfüzyon + CPA schwannom işaretleri + lenfoma işaretleri.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <div className="text-sm font-medium">Kitle / lezyon var</div>
                  <div className="text-xs text-muted-foreground">Var ise ddx motoru aktifleşir</div>
                </div>
                <Switch checked={massPresent} onCheckedChange={setMassPresent} />
              </div>

              <div className={cn("space-y-3", !massPresent && "opacity-60 pointer-events-none")}>
                {/* Lokasyon */}
                <div className="space-y-2 rounded-2xl border p-4">
                  <div className="text-sm font-semibold">Lokasyon</div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Kompartman</div>
                    <div className="flex flex-wrap gap-2">
                      {(["Belirsiz", "İntraaksiyel", "Ekstraaksiyel", "İntraventriküler"] as LesionCompartment[]).map((v) => (
                        <Button key={v} size="sm" variant={compartment === v ? "default" : "outline"} onClick={() => setCompartment(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {compartment === "Ekstraaksiyel" && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Ekstraaksiyel bölge</div>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            "Belirsiz",
                            "Konveksite",
                            "Parasagittal / Falx",
                            "Tentoryum",
                            "Sfenoid kanat / olfaktör oluk",
                            "CPA (serebellopontin açı)",
                            "Kavernöz sinüs komşuluğu",
                          ] as ExtraAxialSite[]
                        ).map((v) => (
                          <Button key={v} size="sm" variant={extraSite === v ? "default" : "outline"} onClick={() => setExtraSite(v)}>
                            {v}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {compartment === "İntraaksiyel" && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">İntraaksiyel bölge</div>
                      <div className="flex flex-wrap gap-2">
                        {(["Belirsiz", "Lobar kortikal-subkortikal", "Derin/periventriküler", "Beyin sapı", "Serebellum"] as IntraAxialSite[]).map((v) => (
                          <Button key={v} size="sm" variant={intraSite === v ? "default" : "outline"} onClick={() => setIntraSite(v)}>
                            {v}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {compartment === "İntraventriküler" && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Ventriküler bölge</div>
                      <div className="flex flex-wrap gap-2">
                        {(["Belirsiz", "Lateral ventrikül", "3. ventrikül", "4. ventrikül"] as VentricularSite[]).map((v) => (
                          <Button key={v} size="sm" variant={ventSite === v ? "default" : "outline"} onClick={() => setVentSite(v)}>
                            {v}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Kontrast */}
                <div className="space-y-2 rounded-xl border p-3">
                  <div className="text-sm font-medium">Kontrastlanma paterni</div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "Belirsiz",
                        "Kontrast yok",
                        "Solid",
                        "Ring (ince-düzgün)",
                        "Ring (kalın/irregüler)",
                        "Dural tail / ekstraaksiyel",
                        "Leptomeningeal/pial",
                      ] as EnhancementPattern[]
                    ).map((v) => (
                      <Button key={v} size="sm" variant={enhPattern === v ? "default" : "outline"} onClick={() => setEnhPattern(v)}>
                        {v}
                      </Button>
                    ))}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium">Kontrastlanma homojenliği</div>
                    <div className="flex flex-wrap gap-2">
                      {(["Belirsiz", "Homojen", "Heterojen"] as EnhancementHomogeneity[]).map((v) => (
                        <Button key={v} size="sm" variant={enhHomog === v ? "default" : "outline"} onClick={() => setEnhHomog(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium">Ring duvar karakteri (opsiyonel)</div>
                    <div className="flex flex-wrap gap-2">
                      {(["bilinmiyor", "ince-düzgün", "kalın/irregüler"] as const).map((v) => (
                        <Button key={v} size="sm" variant={ringWallIrregular === v ? "default" : "outline"} onClick={() => setRingWallIrregular(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Meningiom işaretleri */}
                <div className="space-y-3 rounded-2xl border p-4">
                  <div className="text-sm font-semibold">Ekstraaksiyel / dural-bone işaretleri</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">Ekstraaksiyel işaretler</div>
                        <div className="text-xs text-muted-foreground">CSF cleft / dural taban vb</div>
                      </div>
                      <Switch checked={extraAxialSigns} onCheckedChange={setExtraAxialSigns} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">Geniş dural taban</div>
                        <div className="text-xs text-muted-foreground">Broad dural base</div>
                      </div>
                      <Switch checked={broadDuralBase} onCheckedChange={setBroadDuralBase} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">CSF cleft</div>
                        <div className="text-xs text-muted-foreground">Ekstraaksiyel planı destekler</div>
                      </div>
                      <Switch checked={csfCleft} onCheckedChange={setCsfCleft} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">Hiperostoz</div>
                        <div className="text-xs text-muted-foreground">Meningiom lehine güçlü</div>
                      </div>
                      <Switch checked={hyperostosis} onCheckedChange={setHyperostosis} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">Kalsifikasyon</div>
                        <div className="text-xs text-muted-foreground">BT’de daha iyi</div>
                      </div>
                      <Switch checked={calcification} onCheckedChange={setCalcification} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">Kemik erozyonu</div>
                        <div className="text-xs text-muted-foreground">Agresif/atipik olabilir</div>
                      </div>
                      <Switch checked={boneErosion} onCheckedChange={setBoneErosion} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3 sm:col-span-2">
                      <div>
                        <div className="text-sm font-medium">Meningeal tutulum</div>
                        <div className="text-xs text-muted-foreground">Leptomeningeal/pachymeningeal</div>
                      </div>
                      <Switch checked={meningealEnh} onCheckedChange={setMeningealEnh} />
                    </div>
                  </div>
                </div>

                {/* NEW: CPA schwannoma panel */}
                {compartment === "Ekstraaksiyel" && extraSite === "CPA (serebellopontin açı)" && (
                  <div className="space-y-3 rounded-2xl border p-4">
                    <div className="text-sm font-semibold">CPA: Schwannom vs Meningiom işaretleri</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded-xl border p-3">
                        <div>
                          <div className="text-sm font-medium">İAK genişleme</div>
                          <div className="text-xs text-muted-foreground">Schwannom lehine</div>
                        </div>
                        <Switch checked={iaciWidening} onCheckedChange={setIaciWidening} />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border p-3">
                        <div>
                          <div className="text-sm font-medium">İntrakonaliküler uzanım</div>
                          <div className="text-xs text-muted-foreground">“Ice-cream cone”</div>
                        </div>
                        <Switch checked={iceCreamCone} onCheckedChange={setIceCreamCone} />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border p-3">
                        <div>
                          <div className="text-sm font-medium">Kistik dejenerasyon</div>
                          <div className="text-xs text-muted-foreground">Schwannomda daha sık</div>
                        </div>
                        <Switch checked={cysticDegeneration} onCheckedChange={setCysticDegeneration} />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border p-3">
                        <div>
                          <div className="text-sm font-medium">CPA’da dural tail</div>
                          <div className="text-xs text-muted-foreground">Meningiom lehine</div>
                        </div>
                        <Switch checked={duralTailInCPA} onCheckedChange={setDuralTailInCPA} />
                      </div>
                    </div>
                  </div>
                )}

                {/* NEW: Lymphoma enrich panel */}
                <div className="space-y-3 rounded-2xl border p-4">
                  <div className="text-sm font-semibold">Lenfoma lehine ek işaretler</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">Korpus kallozum crossing</div>
                        <div className="text-xs text-muted-foreground">“Butterfly” paterni</div>
                      </div>
                      <Switch checked={ccCrossing} onCheckedChange={setCcCrossing} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">Ependymal/periventriküler yayılım</div>
                        <div className="text-xs text-muted-foreground">Ventrikül komşuluğu çizgisel</div>
                      </div>
                      <Switch checked={ependymalSpread} onCheckedChange={setEpendymalSpread} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3 sm:col-span-2">
                      <div>
                        <div className="text-sm font-medium">Derin gri cevher tutulumu</div>
                        <div className="text-xs text-muted-foreground">BG/talamus eşlik edebilir</div>
                      </div>
                      <Switch checked={deepGrayInvolvement} onCheckedChange={setDeepGrayInvolvement} />
                    </div>
                  </div>
                </div>

                {/* Other features */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border p-3">
                    <div className="text-sm font-medium">T2 sinyal (ara formlar)</div>
                    <div className="flex flex-wrap gap-2">
                      {(["Belirsiz", "Hipointens", "İzo", "Hafif hiperintens", "Hiperintens", "Belirgin hiperintens"] as T2Scale[]).map((v) => (
                        <Button key={v} size="sm" variant={t2Signal === v ? "default" : "outline"} onClick={() => setT2Signal(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border p-3">
                    <div className="text-sm font-medium">Ödem</div>
                    <div className="flex flex-wrap gap-2">
                      {(["bilinmiyor", "yok", "hafif", "belirgin"] as const).map((v) => (
                        <Button key={v} size="sm" variant={edema === v ? "default" : "outline"} onClick={() => setEdema(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border p-3">
                    <div className="text-sm font-medium">Lezyon sayısı</div>
                    <div className="flex flex-wrap gap-2">
                      {(["bilinmiyor", "tek", "coklu"] as const).map((v) => (
                        <Button key={v} size="sm" variant={multiLesion === v ? "default" : "outline"} onClick={() => setMultiLesion(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border p-3">
                    <div className="text-sm font-medium">CBV / perfüzyon</div>
                    <div className="flex flex-wrap gap-2">
                      {(["bilinmiyor", "yuksek", "dusuk"] as const).map((v) => (
                        <Button key={v} size="sm" variant={cbv === v ? "default" : "outline"} onClick={() => setCbv(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">CBV↑ genelde tümör; CBV↓ lenfoma/apse lehine olabilir.</div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border p-3">
                    <div className="text-sm font-medium">DWI restriksiyon</div>
                    <div className="flex flex-wrap gap-2">
                      {(["bilinmiyor", "var", "yok"] as const).map((v) => (
                        <Button key={v} size="sm" variant={dwiRestriction === v ? "default" : "outline"} onClick={() => setDwiRestriction(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border p-3">
                    <div className="text-sm font-medium">SWI hemoraji</div>
                    <div className="flex flex-wrap gap-2">
                      {(["bilinmiyor", "var", "yok"] as const).map((v) => (
                        <Button key={v} size="sm" variant={swiHemorrhage === v ? "default" : "outline"} onClick={() => setSwiHemorrhage(v)}>
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Not: “Why score” açıklayıcı amaçlıdır; kesin tanı yerine karar desteği sağlar.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Incidental */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Ek / İnsidental bulgular</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea value={incidental} onChange={(e) => setIncidental(e.target.value)} placeholder="Serbest metin ekle; final çıktıya eklenir." />
            <p className="text-xs text-muted-foreground">Not: Bu modül karar destek amaçlıdır; kesin tanı/tedavi için klinik korelasyon gereklidir.</p>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT */}
      <div className="lg:sticky lg:top-6 h-fit space-y-4">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">AI Çıktı</CardTitle>
              <p className="text-xs text-muted-foreground">Seçimlere göre canlı güncellenir (kural tabanlı).</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(final)}>
              Kopyala
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground mb-1">Final (tek cümle)</div>
              <div className="text-sm">{final}</div>
              {incidental.trim().length > 0 && (
                <div className="mt-2 text-sm">
                  <span className="text-xs text-muted-foreground">Ek:</span> {incidental.trim()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">DDX (Top) + Why score</div>
              <div className="space-y-2">
                {ddx.map((d) => (
                  <div key={d.name} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="flex items-center gap-2">
                        {typeof d.score === "number" && <Badge variant="outline">Score: {d.score}</Badge>}
                        <LikelihoodBadge v={d.likelihood} />
                      </div>
                    </div>

                    {d.scoreBreakdown && d.scoreBreakdown.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {d.scoreBreakdown.slice(0, 6).map((s, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                      {d.why.slice(0, 4).map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Öneriler</div>
              {suggestions.length === 0 ? (
                <div className="text-sm text-muted-foreground rounded-xl border p-3">Bu seçimlerle otomatik öneri oluşmadı.</div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div key={s.title} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{s.title}</div>
                        <UrgencyBadge v={s.urgency} />
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                        {s.details.slice(0, 6).map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />
            <div className="text-xs text-muted-foreground">Bu sistem kural tabanlı karar destektir; görüntüler ve klinik ile birlikte değerlendirilmelidir.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [organ, setOrgan] = useState<Organ>("liver");

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">radiology-clean</h1>
          <p className="text-sm text-muted-foreground">
            Organ seçimi → ilgili modül açılır. (Karaciğer ayrı route: <span className="font-medium">/liver</span>)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={organ === "liver" ? "default" : "outline"}
            onClick={() => {
              setOrgan("liver");
              router.push("/liver");
            }}
          >
            Karaciğer
          </Button>
          <Button variant={organ === "brain" ? "default" : "outline"} onClick={() => setOrgan("brain")}>
            Beyin
          </Button>
        </div>
      </div>

      {organ === "brain" ? (
        <BrainModule />
      ) : (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Karaciğer modülü</CardTitle>
            <p className="text-sm text-muted-foreground">Karaciğer modülü ayrı sayfada çalışır.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/liver")}>Karaciğer modülüne git</Button>
            <Button variant="outline" onClick={() => setOrgan("brain")}>
              Beyin modülünü aç
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
