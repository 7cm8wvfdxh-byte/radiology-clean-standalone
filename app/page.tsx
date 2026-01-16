"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type Likelihood = "Yüksek" | "Orta" | "Düşük";

type DdxItem = {
  name: string;
  likelihood: Likelihood;
  why: string[];
};

function clampNum(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}
function numOr0(s: string) {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function mmToCm(mm: number) {
  return mm / 10;
}
function formatMm(mm: number) {
  if (!mm) return "";
  return `${mm} mm`;
}
function formatCm(cm: number) {
  if (!cm) return "";
  return `${cm.toFixed(1)} cm`;
}

function scoreToLikelihood(score: number): Likelihood {
  if (score >= 7) return "Yüksek";
  if (score >= 4) return "Orta";
  return "Düşük";
}

function PillGroup(props: {
  label: string;
  options: { key: string; label: string; hint?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { label, options, value, onChange } = props;
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.key;
          return (
            <Button
              key={o.key}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(o.key)}
              title={o.hint || ""}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleCard(props: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  const { title, description, checked, onCheckedChange } = props;
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function FieldRow(props: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{props.label}</div>
        {props.hint ? <div className="text-xs text-muted-foreground">{props.hint}</div> : null}
      </div>
      {props.children}
    </div>
  );
}

type BrainState = {
  modality: "BT" | "MR";
  // CT protocol
  ctProtocol: "Non-kontrast BT" | "CTA" | "CTV" | "CTP";
  // MR protocol
  mrContrast: "Kontrastsız" | "Kontrastlı";
  mrDynamic: "Yok" | "Arteriyel" | "Venöz" | "Geç";
  // flow
  flow: "Travma" | "Kanama" | "Kitle/Enfeksiyon";

  // clinical
  traumaHx: boolean;
  anticoag: boolean;
  knownCancer: boolean;
  feverSepsis: boolean;
  immunosupp: boolean;

  // COMMON reporting metrics
  side: "Sağ" | "Sol" | "Orta" | "Bilateral";
  region: "Frontal" | "Parietal" | "Temporal" | "Oksipital" | "Derin (BG/Talamus)" | "Beyin sapı" | "Serebellum" | "CPA" | "Ventrikül" | "Bazal sistern" | "Multifokal";
  extends: {
    falx: boolean;
    tentorium: boolean;
    convexity: boolean;
    interhemispheric: boolean;
    posteriorFossa: boolean;
    ventricles: boolean;
    sulci: boolean;
  };

  // Measurements
  mlShiftMm: string; // midline shift
  cisternEfface: "Yok" | "Kısmi" | "Belirgin";
  ventricleComp: "Yok" | "Hafif" | "Belirgin";
  herniation: "Yok" | "Subfalsin" | "Unkal" | "Tonsiller" | "Transtentorial";

  // TRAVMA sub
  skullFx: boolean;
  basilarFx: boolean;
  pneumocephalus: boolean;
  contusion: boolean;
  daiSuspect: boolean;
  edema: boolean;

  // KANAMA sub (types)
  edh: boolean;
  sdh: boolean;
  sah: boolean;
  ich: boolean;
  ivh: boolean;

  // KANAMA details
  extraThicknessMm: string; // EDH/SDH max thickness
  ichDimAcm: string; // cm
  ichDimBcm: string;
  ichDimCcm: string;
  spotSign: boolean; // CTA
  activeExtravasation: boolean; // CTA/CTP
  microbleeds: boolean; // MR SWI
  diffuseSAH: boolean;

  // MR signal descriptors (mild/moderate/marked)
  t1: "Belirtilmedi" | "Hipointens" | "Mild hipointens" | "İzointens" | "Mild hiperintens" | "Hiperintens" | "Marked hiperintens";
  t2: "Belirtilmedi" | "Hipointens" | "Mild hipointens" | "İzointens" | "Mild hiperintens" | "Hiperintens" | "Marked hiperintens";
  flair: "Belirtilmedi" | "Hipointens" | "Mild hipointens" | "İzointens" | "Mild hiperintens" | "Hiperintens" | "Marked hiperintens";
  dwiRestrict: "Belirtilmedi" | "Yok" | "Şüpheli" | "Var";
  swiBloom: "Belirtilmedi" | "Yok" | "Var";

  // KITLE/ENF
  extraAxial: "Belirtilmedi" | "Ekstraaksiyel" | "İntraaksiyel";
  ringEnh: boolean;
  duralTail: boolean;
  hyperostosis: boolean;
  csfCleft: boolean;
  calcification: boolean;
  necrosis: boolean;
  vasogenicEdema: "Belirtilmedi" | "Yok" | "Hafif" | "Belirgin";
  perfusionHigh: "Belirtilmedi" | "Yok" | "Var";
  diffusionMarked: "Belirtilmedi" | "Yok" | "Var";
  leptomeningeal: boolean;
  cranialNerve: boolean; // CPA / IAC
  iacWidening: boolean;
  vesselEncasement: boolean;
};

const defaultBrainState: BrainState = {
  modality: "BT",
  ctProtocol: "Non-kontrast BT",
  mrContrast: "Kontrastsız",
  mrDynamic: "Yok",
  flow: "Kanama",

  traumaHx: true,
  anticoag: false,
  knownCancer: false,
  feverSepsis: false,
  immunosupp: false,

  side: "Orta",
  region: "Multifokal",
  extends: {
    falx: false,
    tentorium: false,
    convexity: false,
    interhemispheric: false,
    posteriorFossa: false,
    ventricles: false,
    sulci: false,
  },

  mlShiftMm: "0",
  cisternEfface: "Yok",
  ventricleComp: "Yok",
  herniation: "Yok",

  skullFx: false,
  basilarFx: false,
  pneumocephalus: false,
  contusion: false,
  daiSuspect: false,
  edema: false,

  edh: false,
  sdh: false,
  sah: false,
  ich: false,
  ivh: false,

  extraThicknessMm: "",
  ichDimAcm: "",
  ichDimBcm: "",
  ichDimCcm: "",
  spotSign: false,
  activeExtravasation: false,
  microbleeds: false,
  diffuseSAH: false,

  t1: "Belirtilmedi",
  t2: "Belirtilmedi",
  flair: "Belirtilmedi",
  dwiRestrict: "Belirtilmedi",
  swiBloom: "Belirtilmedi",

  extraAxial: "Belirtilmedi",
  ringEnh: false,
  duralTail: false,
  hyperostosis: false,
  csfCleft: false,
  calcification: false,
  necrosis: false,
  vasogenicEdema: "Belirtilmedi",
  perfusionHigh: "Belirtilmedi",
  diffusionMarked: "Belirtilmedi",
  leptomeningeal: false,
  cranialNerve: false,
  iacWidening: false,
  vesselEncasement: false,
};

function buildBrainDDX(s: BrainState): { finalSentence: string; ddx: DdxItem[]; recs: string[] } {
  const ddx: DdxItem[] = [];
  const recs: string[] = [];

  const mlShift = numOr0(s.mlShiftMm);
  const extraThick = numOr0(s.extraThicknessMm);
  const a = numOr0(s.ichDimAcm);
  const b = numOr0(s.ichDimBcm);
  const c = numOr0(s.ichDimCcm);
  const approxIchtVol = a && b && c ? (a * b * c) / 2 : 0; // rough ABC/2 if A,B,C are cm

  const hasAnyBleed = s.edh || s.sdh || s.sah || s.ich || s.ivh;

  // ---------- FLOW: TRAVMA ----------
  if (s.flow === "Travma") {
    // CT-based core trauma checklist
    let scoreTraumaBleed = 0;
    const whyTrauma: string[] = [];

    if (s.traumaHx) {
      scoreTraumaBleed += 2;
      whyTrauma.push("Travma öyküsü.");
    }
    if (s.skullFx) {
      scoreTraumaBleed += 2;
      whyTrauma.push("Kafa kemik fraktürü bulgusu.");
    }
    if (s.basilarFx) {
      scoreTraumaBleed += 2;
      whyTrauma.push("Bazal fraktür lehine bulgular.");
    }
    if (s.pneumocephalus) {
      scoreTraumaBleed += 2;
      whyTrauma.push("Pnömosefali (dural defekt/bazal fraktür ile uyumlu olabilir).");
    }
    if (s.contusion) {
      scoreTraumaBleed += 2;
      whyTrauma.push("Kortikal kontüzyon / hemorajik kontüzyon şüphesi.");
    }
    if (mlShift >= 5) {
      scoreTraumaBleed += 2;
      whyTrauma.push(`Midline shift ${formatMm(mlShift)} (kitle etkisi).`);
    }
    if (s.cisternEfface !== "Yok") {
      scoreTraumaBleed += 2;
      whyTrauma.push(`Bazal sisternlerde effasman: ${s.cisternEfface}.`);
    }
    if (s.herniation !== "Yok") {
      scoreTraumaBleed += 3;
      whyTrauma.push(`Herniasyon paterni: ${s.herniation}.`);
    }

    ddx.push({
      name: "Travmaya bağlı akut intrakraniyal patoloji (hematoma/kontüzyon/kitle etkisi)",
      likelihood: scoreToLikelihood(scoreTraumaBleed),
      why: whyTrauma.length ? whyTrauma : ["Travma akışı seçili; spesifik bulgu seçilmedi."],
    });

    // DAI suggestion mostly MR
    if (s.modality === "MR") {
      let scoreDAI = 0;
      const whyDAI: string[] = [];
      if (s.traumaHx) {
        scoreDAI += 2;
        whyDAI.push("Travma öyküsü.");
      }
      if (s.daiSuspect) {
        scoreDAI += 4;
        whyDAI.push("DAI lehine klinik/radyolojik şüphe.");
      }
      if (s.swiBloom === "Var" || s.microbleeds) {
        scoreDAI += 3;
        whyDAI.push("SWI blooming / mikrokanama odakları.");
      }
      if (s.region === "Derin (BG/Talamus)" || s.region === "Beyin sapı") {
        scoreDAI += 1;
        whyDAI.push("Derin yapı/brainstem tutulumu DAI ile uyumlu olabilir.");
      }
      ddx.push({
        name: "Diffüz aksonal hasar (DAI)",
        likelihood: scoreToLikelihood(scoreDAI),
        why: whyDAI.length ? whyDAI : ["DAI için belirgin parametre seçilmedi."],
      });
      if (scoreDAI >= 4) {
        recs.push("MR’da SWI, DWI ve gerekirse DTI/tractography ile değerlendirme önerilir.");
      }
    }

    // Recs
    if (s.modality === "BT" && s.ctProtocol === "Non-kontrast BT") {
      if (s.activeExtravasation || s.spotSign) {
        recs.push("Aktif ekstravazasyon/spot sign varsa acil nöroşirürji ve CTA/CTP korelasyonu önerilir.");
      }
      if (mlShift >= 5 || s.cisternEfface === "Belirgin" || s.herniation !== "Yok") {
        recs.push("Kitle etkisi bulguları nedeniyle acil nöroşirürji konsültasyonu ve yakın klinik takip önerilir.");
      }
      if (!s.skullFx && (s.basilarFx || s.pneumocephalus)) {
        recs.push("Bazal fraktür/pnömosefali şüphesinde ince kesit kemik pencere + paranazal sinüs/mastoid değerlendirme önerilir.");
      }
    }
  }

  // ---------- FLOW: KANAMA ----------
  if (s.flow === "Kanama") {
    let scoreAcuteBleed = 0;
    const whyAcute: string[] = [];

    if (s.modality === "BT" && s.ctProtocol === "Non-kontrast BT") {
      scoreAcuteBleed += 1;
      whyAcute.push("Non-kontrast BT akut kanama için ilk basamak.");
    }
    if (s.traumaHx) {
      scoreAcuteBleed += 1;
      whyAcute.push("Travma öyküsü.");
    }
    if (s.anticoag) {
      scoreAcuteBleed += 2;
      whyAcute.push("Antikoagülan/antiagregan kullanımı (kanama riski artar).");
    }
    if (hasAnyBleed) {
      scoreAcuteBleed += 4;
      whyAcute.push("Kanama tipi seçildi (EDH/SDH/SAH/ICH/IVH).");
    }
    if (mlShift >= 5) {
      scoreAcuteBleed += 2;
      whyAcute.push(`Midline shift ${formatMm(mlShift)}.`);
    }
    if (s.cisternEfface !== "Yok") {
      scoreAcuteBleed += 2;
      whyAcute.push(`Bazal sistern effasmanı: ${s.cisternEfface}.`);
    }
    if (s.ventricleComp !== "Yok") {
      scoreAcuteBleed += 1;
      whyAcute.push(`Ventrikül kompresyonu: ${s.ventricleComp}.`);
    }
    if (s.herniation !== "Yok") {
      scoreAcuteBleed += 3;
      whyAcute.push(`Herniasyon paterni: ${s.herniation}.`);
    }

    ddx.push({
      name: "Belirgin akut intrakraniyal kanama olasılığı",
      likelihood: scoreToLikelihood(scoreAcuteBleed),
      why: whyAcute,
    });

    // EDH vs SDH hints
    if (s.edh || s.sdh) {
      const whyExtra: string[] = [];
      let scoreEDH = 0;
      let scoreSDH = 0;

      if (s.edh) scoreEDH += 3;
      if (s.sdh) scoreSDH += 3;
      if (s.skullFx) {
        scoreEDH += 2;
        whyExtra.push("Fraktür eşliği epidural hematom lehine olabilir.");
      }
      if (s.extends.falx || s.extends.tentorium || s.extends.interhemispheric) {
        scoreSDH += 2;
        whyExtra.push("Falx/tentorium/interhemisferik uzanım subdural lehine olabilir.");
      }
      if (extraThick >= 10) {
        whyExtra.push(`Ekstraaksiyel koleksiyon kalınlığı: ${formatMm(extraThick)}.`);
      }

      ddx.push({
        name: "Epidural hematom (EDH) ile uyumlu olabilir",
        likelihood: scoreToLikelihood(scoreEDH),
        why: whyExtra.length ? whyExtra : ["EDH seçildi; spesifik ayırıcı ipucu seçilmedi."],
      });
      ddx.push({
        name: "Subdural hematom (SDH) ile uyumlu olabilir",
        likelihood: scoreToLikelihood(scoreSDH),
        why: whyExtra.length ? whyExtra : ["SDH seçildi; spesifik ayırıcı ipucu seçilmedi."],
      });
    }

    // ICH etiologies (hypertensive, amyloid, tumor/met, vascular)
    if (s.ich) {
      const whyHTN: string[] = [];
      let scoreHTN = 0;
      if (s.region === "Derin (BG/Talamus)") {
        scoreHTN += 4;
        whyHTN.push("Derin yerleşim (bazal ganglion/talamus) hipertansif kanama lehine olabilir.");
      }
      if (s.anticoag) {
        scoreHTN += 1;
        whyHTN.push("Antikoagülan kullanımı kanama şiddetini artırabilir (etiolojiyi dışlamaz).");
      }
      ddx.push({
        name: "Primer hipertansif intraparenkimal kanama",
        likelihood: scoreToLikelihood(scoreHTN),
        why: whyHTN.length ? whyHTN : ["ICH seçili; tipik derin yerleşim belirtilmedi."],
      });

      const whyAmyloid: string[] = [];
      let scoreCAA = 0;
      if (s.region === "Frontal" || s.region === "Parietal" || s.region === "Temporal" || s.region === "Oksipital") {
        scoreCAA += 2;
        whyAmyloid.push("Lobar yerleşim CAA lehine olabilir (özellikle tekrarlayan lobar kanama).");
      }
      if (s.modality === "MR" && (s.swiBloom === "Var" || s.microbleeds)) {
        scoreCAA += 3;
        whyAmyloid.push("SWI mikrokanamalar CAA lehine olabilir.");
      }
      ddx.push({
        name: "Serebral amiloid anjiyopati (CAA) ile ilişkili lobar kanama (olası)",
        likelihood: scoreToLikelihood(scoreCAA),
        why: whyAmyloid.length ? whyAmyloid : ["CAA lehine belirgin ipucu seçilmedi."],
      });

      const whyTumor: string[] = [];
      let scoreTumorBleed = 0;
      if (s.knownCancer) {
        scoreTumorBleed += 3;
        whyTumor.push("Bilinen malignite (hemorajik metastaz olasılığı).");
      }
      if (s.region === "Multifokal") {
        scoreTumorBleed += 2;
        whyTumor.push("Multifokal odaklar metastaz lehine olabilir.");
      }
      if (s.ringEnh && s.mrContrast === "Kontrastlı") {
        scoreTumorBleed += 2;
        whyTumor.push("Halka tarzı kontrastlanma (metastaz/abses vb).");
      }
      ddx.push({
        name: "Hemorajik metastaz / tümör ilişkili kanama (olası)",
        likelihood: scoreToLikelihood(scoreTumorBleed),
        why: whyTumor.length ? whyTumor : ["Tümör ilişkili kanama lehine parametre seçilmedi."],
      });

      if (approxIchtVol > 0) {
        recs.push(`ICH boyutları girildi: yaklaşık hacim ~ ${approxIchtVol.toFixed(1)} cm³ (kabaca ABC/2). Klinik ile birlikte yorumlanmalı.`);
      }
    }

    // SAH patterns
    if (s.sah) {
      const whyAneurysm: string[] = [];
      let scoreAneurysm = 0;

      if (s.diffuseSAH) {
        scoreAneurysm += 4;
        whyAneurysm.push("Difüz SAH paterni (anevrizmal SAH lehine olabilir).");
      }
      if (s.ctProtocol === "CTA") {
        scoreAneurysm += 2;
        whyAneurysm.push("CTA protokolü (anevrizma/AVM değerlendirmesi).");
      }
      if (s.traumaHx) {
        scoreAneurysm -= 1;
        whyAneurysm.push("Travma öyküsü (travmatik SAH olasılığı artar).");
      }

      ddx.push({
        name: "Anevrizmal SAH (olası) / vasküler neden",
        likelihood: scoreToLikelihood(scoreAneurysm),
        why: whyAneurysm.length ? whyAneurysm : ["SAH seçili; patern bilgisi sınırlı."],
      });

      if (scoreAneurysm >= 4) {
        recs.push("Anevrizmal SAH şüphesinde CTA/MRA ve nöroşirürji değerlendirmesi önerilir.");
      }
    }

    // IVH and hydrocephalus risk
    if (s.ivh) {
      const whyIVH: string[] = [];
      let scoreHydro = 0;
      whyIVH.push("İntraventriküler hemoraji seçildi.");
      if (s.ventricleComp === "Belirgin") {
        scoreHydro += 2;
        whyIVH.push("Ventrikül kompresyonu belirgin (obstrüksiyon/akompanse hidrosefali değerlendir).");
      }
      if (s.cisternEfface !== "Yok") {
        scoreHydro += 1;
        whyIVH.push("Bazal sistern effasmanı eşlik ediyor.");
      }
      ddx.push({
        name: "İntraventriküler hemoraji (+/− hidrosefali riski)",
        likelihood: scoreToLikelihood(scoreHydro + 3),
        why: whyIVH,
      });
      recs.push("IVH varlığında ventrikül boyutları, hidrosefali ve klinik kötüleşme açısından yakın takip önerilir.");
    }

    // Emergency recs
    if (mlShift >= 5 || s.cisternEfface === "Belirgin" || s.herniation !== "Yok") {
      recs.push("Midline shift / sistern effasmanı / herniasyon bulguları varsa acil nöroşirürji konsültasyonu önerilir.");
    }
    if (s.ctProtocol === "CTA" && (s.spotSign || s.activeExtravasation)) {
      recs.push("CTA’da spot sign / aktif ekstravazasyon varlığında hematom genişleme riski artar; acil yönetim önerilir.");
    }
  }

  // ---------- FLOW: KITLE / ENFEKSIYON ----------
  if (s.flow === "Kitle/Enfeksiyon") {
    // Meningioma vs lymphoma vs metastasis vs abscess vs schwannoma etc
    // Base scoring
    const isMR = s.modality === "MR";
    const withContrast = s.modality === "MR" ? s.mrContrast === "Kontrastlı" : s.ctProtocol !== "Non-kontrast BT";

    // MENINGIOMA
    let scoreMeningioma = 0;
    const whyMen: string[] = [];
    if (s.extraAxial === "Ekstraaksiyel") {
      scoreMeningioma += 3;
      whyMen.push("Ekstraaksiyel yerleşim.");
    }
    if (s.duralTail) {
      scoreMeningioma += 3;
      whyMen.push("Dural tail.");
    }
    if (s.hyperostosis) {
      scoreMeningioma += 2;
      whyMen.push("Hiperostozis / komşu kemik değişikliği.");
    }
    if (s.csfCleft) {
      scoreMeningioma += 1;
      whyMen.push("CSF cleft işareti.");
    }
    if (s.calcification) {
      scoreMeningioma += 1;
      whyMen.push("Kalsifikasyon eşlik edebilir.");
    }
    if (withContrast && !s.ringEnh) {
      scoreMeningioma += 1;
      whyMen.push("Solid/yoğun kontrastlanma (halka tarzı değil).");
    }
    ddx.push({
      name: "Meningiom",
      likelihood: scoreToLikelihood(scoreMeningioma),
      why: whyMen.length ? whyMen : ["Meningiom lehine belirgin parametre seçilmedi."],
    });

    // LYMPHOMA (primary CNS)
    let scoreLymphoma = 0;
    const whyLym: string[] = [];
    if (s.immunosupp) {
      scoreLymphoma += 3;
      whyLym.push("İmmünsüpresyon (PCNSL olasılığı artar).");
    }
    if (s.diffusionMarked === "Var" || s.dwiRestrict === "Var") {
      scoreLymphoma += 3;
      whyLym.push("Belirgin difüzyon kısıtlılığı (hipersellüler tümör lehine).");
    }
    if (s.necrosis) {
      scoreLymphoma -= 1;
      whyLym.push("Belirgin nekroz varlığı klasik PCNSL’de daha az tipik (immünsüpresyonda olabilir).");
    }
    if (s.perfusionHigh === "Var") {
      scoreLymphoma -= 1;
      whyLym.push("Yüksek perfüzyon daha çok yüksek dereceli glial tümör/metastaz lehine olabilir.");
    }
    if (withContrast && !s.ringEnh) {
      scoreLymphoma += 1;
      whyLym.push("Homojen kontrastlanma olasılığı (ring yerine).");
    }
    ddx.push({
      name: "Primer santral sinir sistemi lenfoması (PCNSL) / lenfoma",
      likelihood: scoreToLikelihood(scoreLymphoma),
      why: whyLym.length ? whyLym : ["Lenfoma lehine belirgin parametre seçilmedi."],
    });

    // METASTASIS
    let scoreMet = 0;
    const whyMet: string[] = [];
    if (s.knownCancer) {
      scoreMet += 4;
      whyMet.push("Bilinen malignite.");
    }
    if (s.region === "Multifokal") {
      scoreMet += 2;
      whyMet.push("Multifokal lezyon paterni.");
    }
    if (s.ringEnh) {
      scoreMet += 2;
      whyMet.push("Halka tarzı kontrastlanma.");
    }
    if (s.vasogenicEdema === "Belirgin") {
      scoreMet += 1;
      whyMet.push("Belirgin vazojenik ödem.");
    }
    ddx.push({
      name: "Metastaz",
      likelihood: scoreToLikelihood(scoreMet),
      why: whyMet.length ? whyMet : ["Metastaz lehine belirgin parametre seçilmedi."],
    });

    // ABSCESS vs NECROTIC TUMOR
    let scoreAbscess = 0;
    const whyAbs: string[] = [];
    if (s.feverSepsis) {
      scoreAbscess += 3;
      whyAbs.push("Ateş/sepsis öyküsü.");
    }
    if (s.ringEnh) {
      scoreAbscess += 2;
      whyAbs.push("Halka tarzı kontrastlanma.");
    }
    if (s.dwiRestrict === "Var" || s.diffusionMarked === "Var") {
      scoreAbscess += 3;
      whyAbs.push("Belirgin difüzyon kısıtlılığı (irin içeriği lehine).");
    }
    if (s.necrosis) {
      scoreAbscess += 1;
      whyAbs.push("Nekrotik merkez (abses veya nekrotik tümör).");
    }
    ddx.push({
      name: "Beyin absesi (nekrotik lezyon ayırıcı)",
      likelihood: scoreToLikelihood(scoreAbscess),
      why: whyAbs.length ? whyAbs : ["Abse lehine belirgin parametre seçilmedi."],
    });

    // HIGH GRADE GLIOMA (GBM)
    let scoreHGG = 0;
    const whyHGG: string[] = [];
    if (s.extraAxial === "İntraaksiyel") {
      scoreHGG += 2;
      whyHGG.push("İntraaksiyel yerleşim.");
    }
    if (s.necrosis) {
      scoreHGG += 2;
      whyHGG.push("Nekroz/heterojenite.");
    }
    if (s.ringEnh) {
      scoreHGG += 2;
      whyHGG.push("Halka/heterojen kontrastlanma (yüksek dereceli glial tümör ile uyumlu olabilir).");
    }
    if (s.perfusionHigh === "Var") {
      scoreHGG += 2;
      whyHGG.push("Yüksek perfüzyon (neovaskülarite).");
    }
    if (s.diffusionMarked === "Var") {
      scoreHGG -= 1;
      whyHGG.push("Belirgin difüzyon kısıtlılığı daha çok lenfoma/abse lehine olabilir (her zaman değil).");
    }
    ddx.push({
      name: "Yüksek dereceli glial tümör (HGG/GBM olası)",
      likelihood: scoreToLikelihood(scoreHGG),
      why: whyHGG.length ? whyHGG : ["HGG lehine belirgin parametre seçilmedi."],
    });

    // CPA: Schwannoma vs Meningiom strengthening
    if (s.region === "CPA" || s.cranialNerve || s.iacWidening) {
      let scoreSchw = 0;
      const whySchw: string[] = [];
      if (s.cranialNerve) {
        scoreSchw += 2;
        whySchw.push("Kraniyal sinir ilişkisi/IAC uzanımı.");
      }
      if (s.iacWidening) {
        scoreSchw += 3;
        whySchw.push("İç akustik kanal genişlemesi (vestibüler schwannom lehine).");
      }
      if (s.duralTail) {
        scoreSchw -= 1;
        whySchw.push("Dural tail meningiom lehine daha tipik olabilir.");
      }
      ddx.push({
        name: "Vestibüler schwannom (CPA/IAC ilişkili)",
        likelihood: scoreToLikelihood(scoreSchw),
        why: whySchw.length ? whySchw : ["CPA/IAC ipuçları sınırlı."],
      });
    }

    // Meningeal spread
    if (s.leptomeningeal) {
      ddx.push({
        name: "Leptomeningeal tutulum (metastatik/enfeksiyöz/inflamatuvar)",
        likelihood: "Orta",
        why: ["Leptomeningeal tutulum seçildi."],
      });
      recs.push("Leptomeningeal tutulum şüphesinde kontrastlı MR (T1+FS), BOS analizi ve klinik korelasyon önerilir.");
    }

    // Recs for mass
    if (isMR && s.mrContrast === "Kontrastsız") {
      recs.push("Kitle/enfeksiyon şüphesinde kontrastlı MR (T1+FS) tanısal katkı sağlar.");
    }
    if (s.ringEnh && (s.dwiRestrict === "Belirtilmedi" || s.swiBloom === "Belirtilmedi")) {
      recs.push("Halka tutulumlu lezyonda DWI/ADC (abse ayrımı) ve SWI (hemoraji/kalsifikasyon) değerlendirmesi önerilir.");
    }
    if (mlShift >= 5 || s.herniation !== "Yok") {
      recs.push("Kitle etkisi belirgin ise acil klinik değerlendirme ve nöroşirürji konsültasyonu önerilir.");
    }
  }

  // ---------- FINAL SENTENCE ----------
  const top = [...ddx].sort((a, b) => {
    const w = (x: Likelihood) => (x === "Yüksek" ? 3 : x === "Orta" ? 2 : 1);
    return w(b.likelihood) - w(a.likelihood);
  });

  let finalSentence = "";
  if (s.flow === "Travma") {
    finalSentence =
      s.modality === "BT"
        ? "BT incelemede travmaya bağlı intrakraniyal patoloji açısından seçilen bulgular ön plandadır; kitle etkisi/akut kanama bulguları varsa acil klinik korelasyon önerilir."
        : "MR incelemede travma sekelleri/DAI ve eşlik eden kanama odakları açısından seçilen parametreler değerlendirildi; klinik korelasyon ve uygun sekanslarla tamamlayıcı inceleme önerilir.";
  } else if (s.flow === "Kanama") {
    const parts: string[] = [];
    if (hasAnyBleed) parts.push("kanama tipleri seçildi");
    if (extraThick) parts.push(`ekstraaksiyel kalınlık ${formatMm(extraThick)}`);
    if (mlShift) parts.push(`midline shift ${formatMm(mlShift)}`);
    if (approxIchtVol > 0) parts.push(`ICH vol ~${approxIchtVol.toFixed(1)} cm³`);
    finalSentence =
      `Seçilen parametreler intrakraniyal kanama açısından anlamlı olabilir${parts.length ? ` (${parts.join(", ")})` : ""}; klinik ve önceki tetkiklerle korelasyon, kitle etkisi bulgularında acil değerlendirme önerilir.`;
  } else {
    finalSentence =
      "Seçilen bulgular kitle/enfeksiyon ayırıcı tanısı için değerlendirildi; kontrastlı inceleme, DWI/ADC ve perfüzyon gibi ileri sekanslar ayırıcı tanıda yardımcı olabilir (klinik korelasyon önerilir).";
  }

  // De-duplicate ddx by name (keep highest likelihood)
  const map = new Map<string, DdxItem>();
  const weight = (x: Likelihood) => (x === "Yüksek" ? 3 : x === "Orta" ? 2 : 1);
  for (const item of top) {
    const prev = map.get(item.name);
    if (!prev || weight(item.likelihood) > weight(prev.likelihood)) map.set(item.name, item);
  }
  const merged = [...map.values()].sort((a, b) => weight(b.likelihood) - weight(a.likelihood)).slice(0, 6);

  return { finalSentence, ddx: merged, recs };
}

export default function Page() {
  const [organ, setOrgan] = useState<"Karaciğer" | "Beyin">("Beyin");
  const [brain, setBrain] = useState<BrainState>({ ...defaultBrainState });

  const ai = useMemo(() => buildBrainDDX(brain), [brain]);

  const headerSubtitle = useMemo(() => {
    if (organ === "Karaciğer") return "Karaciğer modülü ayrı route: /liver";
    return "Beyin modülü: Travma / Kanama / Kitle–Enfeksiyon (kural tabanlı)";
  }, [organ]);

  const protocolHint = useMemo(() => {
    if (brain.modality === "BT") return `BT protokol: ${brain.ctProtocol}`;
    return `MR: ${brain.mrContrast}${brain.mrContrast === "Kontrastlı" ? ` • Faz: ${brain.mrDynamic}` : ""}`;
  }, [brain.modality, brain.ctProtocol, brain.mrContrast, brain.mrDynamic]);

  const copyText = async () => {
    const txt = [
      "— Radiology-clean (Beyin) —",
      `Modality: ${brain.modality}`,
      `Flow: ${brain.flow}`,
      `Protokol: ${protocolHint}`,
      "",
      "FINAL:",
      ai.finalSentence,
      "",
      "DDX:",
      ...ai.ddx.map((d) => `- ${d.name} [${d.likelihood}] • ${d.why.join("; ")}`),
      "",
      "Öneriler:",
      ...(ai.recs.length ? ai.recs.map((r) => `- ${r}`) : ["- (Otomatik öneri oluşmadı.)"]),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      alert("Kopyalandı ✅");
    } catch {
      alert("Kopyalama başarısız. (Tarayıcı izinleri)");
    }
  };

  const resetBrain = () => setBrain({ ...defaultBrainState });

  const organBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-2xl font-semibold">radiology-clean</div>
        <div className="text-sm text-muted-foreground">{headerSubtitle}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={organ === "Karaciğer" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setOrgan("Karaciğer");
            // karaciğer route’a yönlendirme (client)
            window.location.href = "/liver";
          }}
        >
          Karaciğer
        </Button>
        <Button
          type="button"
          variant={organ === "Beyin" ? "default" : "outline"}
          size="sm"
          onClick={() => setOrgan("Beyin")}
        >
          Beyin
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={resetBrain}>
          Sıfırla
        </Button>
      </div>
    </div>
  );

  const modalitySection = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Beyin AI Yardımcı Modül</CardTitle>
        <div className="text-xs text-muted-foreground">
          İnceleme tipi + protokol + akış seçimine göre alt seçenekler açılır. (Kural tabanlı)
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PillGroup
          label="İnceleme tipi"
          value={brain.modality}
          onChange={(v) =>
            setBrain((p) => ({
              ...p,
              modality: v as BrainState["modality"],
            }))
          }
          options={[
            { key: "BT", label: "BT" },
            { key: "MR", label: "MR" },
          ]}
        />

        {brain.modality === "BT" ? (
          <PillGroup
            label="Protokol / Faz"
            value={brain.ctProtocol}
            onChange={(v) =>
              setBrain((p) => ({
                ...p,
                ctProtocol: v as BrainState["ctProtocol"],
              }))
            }
            options={[
              { key: "Non-kontrast BT", label: "Non-kontrast BT", hint: "Akut kanama/kemik/travma ilk basamak" },
              { key: "CTA", label: "CTA", hint: "Anevrizma/AVM, spot sign, vasküler değerlendirme" },
              { key: "CTV", label: "CTV", hint: "Venöz sinüs trombozu" },
              { key: "CTP", label: "CTP", hint: "Perfüzyon (iskemi/penumbra/hiperemi vb)" },
            ]}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <PillGroup
              label="MR kontrast"
              value={brain.mrContrast}
              onChange={(v) =>
                setBrain((p) => ({
                  ...p,
                  mrContrast: v as BrainState["mrContrast"],
                }))
              }
              options={[
                { key: "Kontrastsız", label: "Kontrastsız" },
                { key: "Kontrastlı", label: "Kontrastlı" },
              ]}
            />
            <PillGroup
              label="Dinamik faz (varsa)"
              value={brain.mrDynamic}
              onChange={(v) =>
                setBrain((p) => ({
                  ...p,
                  mrDynamic: v as BrainState["mrDynamic"],
                }))
              }
              options={[
                { key: "Yok", label: "Yok" },
                { key: "Arteriyel", label: "Arteriyel" },
                { key: "Venöz", label: "Venöz" },
                { key: "Geç", label: "Geç" },
              ]}
            />
          </div>
        )}

        <Separator />

        <PillGroup
          label="Akış"
          value={brain.flow}
          onChange={(v) => setBrain((p) => ({ ...p, flow: v as BrainState["flow"] }))}
          options={[
            { key: "Travma", label: "Travma" },
            { key: "Kanama", label: "Kanama" },
            { key: "Kitle/Enfeksiyon", label: "Kitle / Enfeksiyon" },
          ]}
        />

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Klinik zemin / bağlam</div>
            <div className="grid gap-3">
              <ToggleCard
                title="Travma öyküsü"
                description="Travma akışını ve ekstraaksiyel kanamaları güçlendirir"
                checked={brain.traumaHx}
                onCheckedChange={(v) => setBrain((p) => ({ ...p, traumaHx: v }))}
              />
              <ToggleCard
                title="Antikoagülan / antiagregan"
                description="Kanama riski / genişleme riski artar"
                checked={brain.anticoag}
                onCheckedChange={(v) => setBrain((p) => ({ ...p, anticoag: v }))}
              />
              <ToggleCard
                title="Bilinen malignite"
                description="Metastaz / hemorajik metastaz olasılığı"
                checked={brain.knownCancer}
                onCheckedChange={(v) => setBrain((p) => ({ ...p, knownCancer: v }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">Enfeksiyon / immün durum</div>
            <div className="grid gap-3">
              <ToggleCard
                title="Ateş / sepsis"
                description="Abse ve enfeksiyon ayırıcı tanısını güçlendirir"
                checked={brain.feverSepsis}
                onCheckedChange={(v) => setBrain((p) => ({ ...p, feverSepsis: v }))}
              />
              <ToggleCard
                title="İmmünsüpresyon"
                description="PCNSL / oportunistik enfeksiyon"
                checked={brain.immunosupp}
                onCheckedChange={(v) => setBrain((p) => ({ ...p, immunosupp: v }))}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const commonReportSection = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Raporlama parametreleri (anatomik uzanım + ölçümler)</CardTitle>
        <div className="text-xs text-muted-foreground">
          “Nereye uzanıyor, kaç mm kalınlık/shift var” gibi rapor dili için temel alanlar.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <PillGroup
            label="Taraf"
            value={brain.side}
            onChange={(v) => setBrain((p) => ({ ...p, side: v as BrainState["side"] }))}
            options={[
              { key: "Sağ", label: "Sağ" },
              { key: "Sol", label: "Sol" },
              { key: "Orta", label: "Orta" },
              { key: "Bilateral", label: "Bilateral" },
            ]}
          />
          <PillGroup
            label="Bölge"
            value={brain.region}
            onChange={(v) => setBrain((p) => ({ ...p, region: v as BrainState["region"] }))}
            options={[
              { key: "Frontal", label: "Frontal" },
              { key: "Parietal", label: "Parietal" },
              { key: "Temporal", label: "Temporal" },
              { key: "Oksipital", label: "Oksipital" },
              { key: "Derin (BG/Talamus)", label: "Derin (BG/Talamus)" },
              { key: "Beyin sapı", label: "Beyin sapı" },
              { key: "Serebellum", label: "Serebellum" },
              { key: "CPA", label: "CPA" },
              { key: "Ventrikül", label: "Ventrikül" },
              { key: "Bazal sistern", label: "Bazal sistern" },
              { key: "Multifokal", label: "Multifokal" },
            ]}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <ToggleCard
            title="Falx boyunca uzanım"
            checked={brain.extends.falx}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, extends: { ...p.extends, falx: v } }))}
          />
          <ToggleCard
            title="Tentorium boyunca uzanım"
            checked={brain.extends.tentorium}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, extends: { ...p.extends, tentorium: v } }))}
          />
          <ToggleCard
            title="Konveksite boyunca"
            checked={brain.extends.convexity}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, extends: { ...p.extends, convexity: v } }))}
          />
          <ToggleCard
            title="İnterhemisferik uzanım"
            checked={brain.extends.interhemispheric}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, extends: { ...p.extends, interhemispheric: v } }))}
          />
          <ToggleCard
            title="Posterior fossa uzanımı"
            checked={brain.extends.posteriorFossa}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, extends: { ...p.extends, posteriorFossa: v } }))}
          />
          <ToggleCard
            title="Ventriküllere uzanım"
            checked={brain.extends.ventricles}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, extends: { ...p.extends, ventricles: v } }))}
          />
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow label="Midline shift (mm)" hint=">5 mm klinik açıdan önemli olabilir">
            <Input
              value={brain.mlShiftMm}
              onChange={(e) => {
                const v = String(e.target.value);
                setBrain((p) => ({ ...p, mlShiftMm: v }));
              }}
              placeholder="örn: 0 / 3 / 7"
              inputMode="decimal"
            />
          </FieldRow>

          <PillGroup
            label="Bazal sistern effasmanı"
            value={brain.cisternEfface}
            onChange={(v) => setBrain((p) => ({ ...p, cisternEfface: v as BrainState["cisternEfface"] }))}
            options={[
              { key: "Yok", label: "Yok" },
              { key: "Kısmi", label: "Kısmi" },
              { key: "Belirgin", label: "Belirgin" },
            ]}
          />

          <PillGroup
            label="Ventrikül kompresyonu"
            value={brain.ventricleComp}
            onChange={(v) => setBrain((p) => ({ ...p, ventricleComp: v as BrainState["ventricleComp"] }))}
            options={[
              { key: "Yok", label: "Yok" },
              { key: "Hafif", label: "Hafif" },
              { key: "Belirgin", label: "Belirgin" },
            ]}
          />

          <PillGroup
            label="Herniasyon paterni"
            value={brain.herniation}
            onChange={(v) => setBrain((p) => ({ ...p, herniation: v as BrainState["herniation"] }))}
            options={[
              { key: "Yok", label: "Yok" },
              { key: "Subfalsin", label: "Subfalsin" },
              { key: "Unkal", label: "Unkal" },
              { key: "Tonsiller", label: "Tonsiller" },
              { key: "Transtentorial", label: "Transtentorial" },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );

  const traumaSection = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Travma alt seçimleri</CardTitle>
        <div className="text-xs text-muted-foreground">
          BT’de kemik/kanama + kitle etkisi; MR’da DAI/SWI/DWI ile derinleşme.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <ToggleCard
            title="Kafa kemik fraktürü"
            checked={brain.skullFx}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, skullFx: v }))}
          />
          <ToggleCard
            title="Bazal fraktür lehine"
            checked={brain.basilarFx}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, basilarFx: v }))}
          />
          <ToggleCard
            title="Pnömosefali"
            checked={brain.pneumocephalus}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, pneumocephalus: v }))}
          />
          <ToggleCard
            title="Kontüzyon / hemorajik kontüzyon"
            checked={brain.contusion}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, contusion: v }))}
          />
          <ToggleCard
            title="DAI şüphesi (klinik/radyolojik)"
            checked={brain.daiSuspect}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, daiSuspect: v }))}
          />
          <ToggleCard
            title="Ödem / diffüz şişme"
            checked={brain.edema}
            onCheckedChange={(v) => setBrain((p) => ({ ...p, edema: v }))}
          />
        </div>

        {brain.modality === "MR" ? (
          <div className="rounded-xl border p-3 space-y-3">
            <div className="text-sm font-semibold">MR ipuçları (Travma)</div>
            <div className="grid gap-3 md:grid-cols-3">
              <PillGroup
                label="SWI blooming"
                value={brain.swiBloom}
                onChange={(v) => setBrain((p) => ({ ...p, swiBloom: v as BrainState["swiBloom"] }))}
                options={[
                  { key: "Belirtilmedi", label: "Belirtilmedi" },
                  { key: "Yok", label: "Yok" },
                  { key: "Var", label: "Var" },
                ]}
              />
              <PillGroup
                label="DWI restriksiyon"
                value={brain.dwiRestrict}
                onChange={(v) => setBrain((p) => ({ ...p, dwiRestrict: v as BrainState["dwiRestrict"] }))}
                options={[
                  { key: "Belirtilmedi", label: "Belirtilmedi" },
                  { key: "Yok", label: "Yok" },
                  { key: "Şüpheli", label: "Şüpheli" },
                  { key: "Var", label: "Var" },
                ]}
              />
              <ToggleCard
                title="Mikrokanama odakları"
                description="DAI/CAA vb ayırıcıda destekleyebilir"
                checked={brain.microbleeds}
                onCheckedChange={(v) => setBrain((p) => ({ ...p, microbleeds: v }))}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const bleedSection = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Kanama alt seçimleri + ölçümler</CardTitle>
        <div className="text-xs text-muted-foreground">
          Ekstraaksiyel/intraaksiyel/SAH/IVH + uzanım + kalınlık/shift/volüm.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <ToggleCard title="EDH" checked={brain.edh} onCheckedChange={(v) => setBrain((p) => ({ ...p, edh: v }))} />
          <ToggleCard title="SDH" checked={brain.sdh} onCheckedChange={(v) => setBrain((p) => ({ ...p, sdh: v }))} />
          <ToggleCard title="SAH" checked={brain.sah} onCheckedChange={(v) => setBrain((p) => ({ ...p, sah: v }))} />
          <ToggleCard title="ICH" checked={brain.ich} onCheckedChange={(v) => setBrain((p) => ({ ...p, ich: v }))} />
          <ToggleCard title="IVH" checked={brain.ivh} onCheckedChange={(v) => setBrain((p) => ({ ...p, ivh: v }))} />
        </div>

        {(brain.edh || brain.sdh) ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldRow label="Ekstraaksiyel koleksiyon max kalınlık (mm)" hint="EDH/SDH raporlama">
              <Input
                value={brain.extraThicknessMm}
                onChange={(e) => setBrain((p) => ({ ...p, extraThicknessMm: e.target.value }))}
                placeholder="örn: 6 / 12"
                inputMode="decimal"
              />
            </FieldRow>
            <div className="rounded-xl border p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">Uzanım ipuçları</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Falx/tentorium/interhemisferik uzanım → SDH lehine olabilir.</li>
                <li>Fraktür eşliği → EDH lehine olabilir.</li>
              </ul>
            </div>
          </div>
        ) : null}

        {brain.ich ? (
          <div className="rounded-xl border p-3 space-y-3">
            <div className="text-sm font-semibold">ICH boyutları (cm) — yaklaşık volüm (ABC/2)</div>
            <div className="grid gap-3 md:grid-cols-3">
              <FieldRow label="A (cm)" hint="maks çap">
                <Input value={brain.ichDimAcm} onChange={(e) => setBrain((p) => ({ ...p, ichDimAcm: e.target.value }))} placeholder="örn: 3.2" inputMode="decimal" />
              </FieldRow>
              <FieldRow label="B (cm)" hint="dik çap">
                <Input value={brain.ichDimBcm} onChange={(e) => setBrain((p) => ({ ...p, ichDimBcm: e.target.value }))} placeholder="örn: 2.1" inputMode="decimal" />
              </FieldRow>
              <FieldRow label="C (cm)" hint="kraniokaudal">
                <Input value={brain.ichDimCcm} onChange={(e) => setBrain((p) => ({ ...p, ichDimCcm: e.target.value }))} placeholder="örn: 2.8" inputMode="decimal" />
              </FieldRow>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ToggleCard
                title="CTA spot sign"
                description="Hematoma genişleme riski"
                checked={brain.spotSign}
                onCheckedChange={(v) => setBrain((p) => ({ ...p, spotSign: v }))}
              />
              <ToggleCard
                title="Aktif ekstravazasyon"
                description="Acil yönetim gerektirebilir"
                checked={brain.activeExtravasation}
                onCheckedChange={(v) => setBrain((p) => ({ ...p, activeExtravasation: v }))}
              />
            </div>
          </div>
        ) : null}

        {brain.sah ? (
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleCard
              title="Difüz SAH paterni"
              description="Anevrizmal SAH lehine olabilir"
              checked={brain.diffuseSAH}
              onCheckedChange={(v) => setBrain((p) => ({ ...p, diffuseSAH: v }))}
            />
            <div className="rounded-xl border p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">Not</div>
              <div>Difüz SAH + klinik uyum varsa CTA/MRA ve nöroşirürji değerlendirmesi önerilir.</div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const massSection = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Kitle / Enfeksiyon alt seçimleri (meningiom–lenfoma güçlendirilmiş)</CardTitle>
        <div className="text-xs text-muted-foreground">
          Ekstraaksiyel–intraaksiyel ayrımı + kontrast paterni + DWI/perfüzyon ile ayırıcı tanı.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PillGroup
          label="Yerleşim"
          value={brain.extraAxial}
          onChange={(v) => setBrain((p) => ({ ...p, extraAxial: v as BrainState["extraAxial"] }))}
          options={[
            { key: "Belirtilmedi", label: "Belirtilmedi" },
            { key: "Ekstraaksiyel", label: "Ekstraaksiyel" },
            { key: "İntraaksiyel", label: "İntraaksiyel" },
          ]}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <ToggleCard title="Halka tutulum" checked={brain.ringEnh} onCheckedChange={(v) => setBrain((p) => ({ ...p, ringEnh: v }))} />
          <ToggleCard title="Dural tail" checked={brain.duralTail} onCheckedChange={(v) => setBrain((p) => ({ ...p, duralTail: v }))} />
          <ToggleCard title="Hiperostozis" checked={brain.hyperostosis} onCheckedChange={(v) => setBrain((p) => ({ ...p, hyperostosis: v }))} />
          <ToggleCard title="CSF cleft" checked={brain.csfCleft} onCheckedChange={(v) => setBrain((p) => ({ ...p, csfCleft: v }))} />
          <ToggleCard title="Kalsifikasyon" checked={brain.calcification} onCheckedChange={(v) => setBrain((p) => ({ ...p, calcification: v }))} />
          <ToggleCard title="Nekroz" checked={brain.necrosis} onCheckedChange={(v) => setBrain((p) => ({ ...p, necrosis: v }))} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PillGroup
            label="Vazojenik ödem"
            value={brain.vasogenicEdema}
            onChange={(v) => setBrain((p) => ({ ...p, vasogenicEdema: v as BrainState["vasogenicEdema"] }))}
            options={[
              { key: "Belirtilmedi", label: "Belirtilmedi" },
              { key: "Yok", label: "Yok" },
              { key: "Hafif", label: "Hafif" },
              { key: "Belirgin", label: "Belirgin" },
            ]}
          />
          <PillGroup
            label="Perfüzyon (yüksek?)"
            value={brain.perfusionHigh}
            onChange={(v) => setBrain((p) => ({ ...p, perfusionHigh: v as BrainState["perfusionHigh"] }))}
            options={[
              { key: "Belirtilmedi", label: "Belirtilmedi" },
              { key: "Yok", label: "Yok" },
              { key: "Var", label: "Var" },
            ]}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PillGroup
            label="Difüzyon (marked?)"
            value={brain.diffusionMarked}
            onChange={(v) => setBrain((p) => ({ ...p, diffusionMarked: v as BrainState["diffusionMarked"] }))}
            options={[
              { key: "Belirtilmedi", label: "Belirtilmedi" },
              { key: "Yok", label: "Yok" },
              { key: "Var", label: "Var" },
            ]}
          />

          <div className="grid gap-3">
            <ToggleCard
              title="Leptomeningeal tutulum"
              description="metastatik/enfeksiyöz/inflamatuvar ayırıcı"
              checked={brain.leptomeningeal}
              onCheckedChange={(v) => setBrain((p) => ({ ...p, leptomeningeal: v }))}
            />
            <ToggleCard
              title="Vasküler encasement"
              description="meningiom vb"
              checked={brain.vesselEncasement}
              onCheckedChange={(v) => setBrain((p) => ({ ...p, vesselEncasement: v }))}
            />
          </div>
        </div>

        <Separator />

        <div className="rounded-xl border p-3 space-y-3">
          <div className="text-sm font-semibold">CPA / IAC alt ipuçları (schwannom vs meningiom)</div>
          <div className="grid gap-3 md:grid-cols-3">
            <ToggleCard
              title="Kraniyal sinir ilişkisi"
              checked={brain.cranialNerve}
              onCheckedChange={(v) => setBrain((p) => ({ ...p, cranialNerve: v }))}
            />
            <ToggleCard
              title="İç akustik kanal genişlemesi"
              checked={brain.iacWidening}
              onCheckedChange={(v) => setBrain((p) => ({ ...p, iacWidening: v }))}
            />
            <div className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">Kısa ipucu</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>IAC genişlemesi → schwannom lehine</li>
                <li>Dural tail/hiperostozis → meningiom lehine</li>
              </ul>
            </div>
          </div>
        </div>

        {brain.modality === "MR" ? (
          <div className="rounded-xl border p-3 space-y-3">
            <div className="text-sm font-semibold">MR sinyal tanımları (ara formlar dahil)</div>
            <div className="grid gap-3 md:grid-cols-3">
              <PillGroup
                label="T1"
                value={brain.t1}
                onChange={(v) => setBrain((p) => ({ ...p, t1: v as BrainState["t1"] }))}
                options={[
                  { key: "Belirtilmedi", label: "Belirtilmedi" },
                  { key: "Hipointens", label: "Hipo" },
                  { key: "Mild hipointens", label: "Mild hipo" },
                  { key: "İzointens", label: "İzo" },
                  { key: "Mild hiperintens", label: "Mild hiper" },
                  { key: "Hiperintens", label: "Hiper" },
                  { key: "Marked hiperintens", label: "Marked hiper" },
                ]}
              />
              <PillGroup
                label="T2"
                value={brain.t2}
                onChange={(v) => setBrain((p) => ({ ...p, t2: v as BrainState["t2"] }))}
                options={[
                  { key: "Belirtilmedi", label: "Belirtilmedi" },
                  { key: "Hipointens", label: "Hipo" },
                  { key: "Mild hipointens", label: "Mild hipo" },
                  { key: "İzointens", label: "İzo" },
                  { key: "Mild hiperintens", label: "Mild hiper" },
                  { key: "Hiperintens", label: "Hiper" },
                  { key: "Marked hiperintens", label: "Marked hiper" },
                ]}
              />
              <PillGroup
                label="FLAIR"
                value={brain.flair}
                onChange={(v) => setBrain((p) => ({ ...p, flair: v as BrainState["flair"] }))}
                options={[
                  { key: "Belirtilmedi", label: "Belirtilmedi" },
                  { key: "Hipointens", label: "Hipo" },
                  { key: "Mild hipointens", label: "Mild hipo" },
                  { key: "İzointens", label: "İzo" },
                  { key: "Mild hiperintens", label: "Mild hiper" },
                  { key: "Hiperintens", label: "Hiper" },
                  { key: "Marked hiperintens", label: "Marked hiper" },
                ]}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const rightPanel = (
    <Card className="md:sticky md:top-4 h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">AI Çıktı</CardTitle>
          <Button type="button" size="sm" onClick={copyText}>
            Kopyala
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">Seçimlere göre canlı güncellenir (kural tabanlı).</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border p-3">
          <div className="text-xs font-semibold mb-1">Final (tek cümle)</div>
          <div className="text-sm">{ai.finalSentence}</div>
        </div>

        <div className="rounded-xl border p-3 space-y-3">
          <div className="text-xs font-semibold">DDX (Top) + Why score</div>
          <div className="space-y-2">
            {ai.ddx.map((d) => (
              <div key={d.name} className="rounded-lg border p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{d.name}</div>
                  <Badge variant="secondary">{d.likelihood}</Badge>
                </div>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {d.why.slice(0, 5).map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-xs font-semibold mb-1">Öneriler</div>
          {ai.recs.length ? (
            <ul className="list-disc pl-5 text-sm space-y-1">
              {ai.recs.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">Bu seçimlerle otomatik öneri oluşmadı.</div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Not: Bu modül karar destek amaçlıdır; kesin tanı/tedavi için klinik korelasyon gereklidir.
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {organBar}

        <div className="grid gap-6 md:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            {modalitySection}
            {commonReportSection}

            {organ === "Beyin" ? (
              <>
                {brain.flow === "Travma" ? traumaSection : null}
                {brain.flow === "Kanama" ? bleedSection : null}
                {brain.flow === "Kitle/Enfeksiyon" ? massSection : null}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Ek / İnsidental bulgular</CardTitle>
                    <div className="text-xs text-muted-foreground">Serbest metin ekle; final çıktıya kopyalayabilirsin.</div>
                  </CardHeader>
                  <CardContent>
                    <Textarea placeholder="Serbest metin..." />
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          {rightPanel}
        </div>
      </div>
    </div>
  );
}
