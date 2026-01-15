"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

/** =============================
 * Types
 * ============================= */

type StudyModality = "BT" | "MR" | "BT+MR";
type YesNo = "yok" | "var";
type Likelihood = "Yüksek" | "Orta" | "Düşük";

type TriState = "bilinmiyor" | "yok" | "var";

type BTContrastStatus = "kontrastsız" | "kontrastlı (tek faz)" | "dinamik (3 faz)";
type MRContrastStatus = "kontrastsız" | "dinamik gadolinyum var" | "hepatobiliyer faz var";

type MRIntensity =
  | "bilinmiyor"
  | "belirgin hipo"
  | "hafif hipo"
  | "izo"
  | "hafif hiper"
  | "belirgin hiper";

type MRCoarse = "bilinmiyor" | "hipo" | "izo" | "hiper";
type MRStrength = 0 | 1 | 2; // 0: bilinmiyor/izo, 1: hafif, 2: belirgin

type MREnhSimple = "bilinmiyor" | "hipo" | "izo" | "hiper";
type MRDelayedPattern = "bilinmiyor" | "progresif" | "persistan" | "washout";

type DdxItem = {
  name: string;
  likelihood: Likelihood;
  why?: string[];
};

type Recommendation = {
  title: string;
  details?: string[];
  urgency?: "Acil" | "Öncelikli" | "Rutin";
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function bump(l: Likelihood, dir: "up" | "down"): Likelihood {
  if (dir === "up") {
    if (l === "Düşük") return "Orta";
    if (l === "Orta") return "Yüksek";
    return "Yüksek";
  }
  if (l === "Yüksek") return "Orta";
  if (l === "Orta") return "Düşük";
  return "Düşük";
}

function normIntensity(x: MRIntensity): { coarse: MRCoarse; strength: MRStrength } {
  if (x === "bilinmiyor") return { coarse: "bilinmiyor", strength: 0 };
  if (x === "izo") return { coarse: "izo", strength: 0 };
  if (x === "hafif hipo") return { coarse: "hipo", strength: 1 };
  if (x === "belirgin hipo") return { coarse: "hipo", strength: 2 };
  if (x === "hafif hiper") return { coarse: "hiper", strength: 1 };
  if (x === "belirgin hiper") return { coarse: "hiper", strength: 2 };
  return { coarse: "bilinmiyor", strength: 0 };
}

function coarseToIntensity(coarse: MREnhSimple, mildDefault = true): MRIntensity {
  if (coarse === "bilinmiyor") return "bilinmiyor";
  if (coarse === "izo") return "izo";
  if (coarse === "hipo") return mildDefault ? "hafif hipo" : "belirgin hipo";
  if (coarse === "hiper") return mildDefault ? "hafif hiper" : "belirgin hiper";
  return "bilinmiyor";
}

/** =============================
 * DDX Engines
 * ============================= */

type LiverBTHypodenseFeatures = {
  sizeMm?: number;
  number?: "tek" | "çok";
  margins?: "düzgün" | "düzensiz";
  attenuation?: "saf sıvı densiteye yakın" | "hipodens (nonspesifik)" | "heterojen";
  enhancement?: "değerlendirilemedi" | "yok/çok az" | "periferik nodüler" | "arteryel hipervasküler" | "halka" | "heterojen";
  calcification?: boolean;
  fat?: boolean;
  air?: boolean;
  backgroundLiver?: "normal" | "steatoz" | "siroz/kronik karaciğer";
  knownPrimary?: boolean;
  feverOrSepsis?: boolean;
  trauma?: boolean;
  biliaryDilation?: boolean;

  // capsule-related morphology
  subcapsular?: boolean;
  capsuleAppearance?: boolean;
  capsularRetraction?: boolean;
};

function liverHypodenseBT_Ddx(f: LiverBTHypodenseFeatures): DdxItem[] {
  const base: DdxItem[] = [
    { name: "Basit kist", likelihood: "Orta", why: ["BT’de hipodens odak için sık benign nedenlerden."] },
    { name: "Hemanjiyom", likelihood: "Orta", why: ["Sıklıkla insidental; dinamik patern belirleyicidir."] },
    { name: "Metastaz", likelihood: "Orta", why: ["Çoklu lezyon / bilinen primer varsa önem kazanır."] },
    { name: "Hepatoselüler karsinom (HCC)", likelihood: "Düşük", why: ["Siroz zemininde olasılık artar; dinamik paterne bakılır."] },
    { name: "İntrahepatik kolanjiokarsinom (ICC)", likelihood: "Düşük", why: ["Kapsüler çekinti / fibrotik yapı ile ilişki olabilir; dinamik/MR ile netleşir."] },
    { name: "Epitheloid hemanjiyoendotelyoma (HEHE)", likelihood: "Düşük", why: ["Sıklıkla subkapsüler/multifokal olabilir; kapsüler çekinti görülebilir."] },
    { name: "FNH / Adenom", likelihood: "Düşük", why: ["Dinamik yoksa ayrım sınırlı; ek sekanslar değerlidir."] },
    { name: "Apse / mikroapseler", likelihood: "Düşük", why: ["Klinik ateş/sepsis varlığında öncelik kazanır."] },
  ];

  let ddx = [...base];

  if (f.trauma) {
    ddx.unshift({
      name: "Kontüzyon / laserasyon",
      likelihood: "Yüksek",
      why: ["Travma öyküsü varsa hipodens parankimal alan kontüzyon/laserasyon lehine olabilir."],
    });
  }

  if (f.feverOrSepsis) {
    ddx = ddx.map((d) =>
      d.name.toLowerCase().includes("apse")
        ? { ...d, likelihood: "Yüksek", why: uniq([...(d.why ?? []), "Ateş/sepsis ile uyumlu klinikte öncelikli."]) }
        : d
    );
    ddx.unshift({
      name: "Pyojenik apse",
      likelihood: "Orta",
      why: ["Ateş, lökositoz, CRP yüksekliği gibi klinik bulgularla korele."],
    });
  }

  if (f.number === "çok") {
    ddx = ddx.map((d) => {
      if (d.name === "Metastaz") return { ...d, likelihood: "Yüksek", why: uniq([...(d.why ?? []), "Çoklu lezyon metastaz lehine."]) };
      if (d.name.includes("Apse")) return { ...d, likelihood: f.feverOrSepsis ? "Yüksek" : "Orta" };
      if (d.name.includes("HEHE")) return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Multifokal/subkapsüler dağılım ile görülebilir."]) };
      return d;
    });
  }

  if (f.knownPrimary) {
    ddx = ddx.map((d) =>
      d.name === "Metastaz" ? { ...d, likelihood: "Yüksek", why: uniq([...(d.why ?? []), "Bilinen primer malignite varlığı."]) } : d
    );
  }

  if (f.backgroundLiver === "siroz/kronik karaciğer") {
    ddx = ddx.map((d) =>
      d.name.includes("HCC") ? { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Siroz zemininde HCC olasılığı artar."]) } : d
    );
  }

  if (
    f.attenuation === "saf sıvı densiteye yakın" &&
    f.margins === "düzgün" &&
    (f.enhancement === "yok/çok az" || f.enhancement === "değerlendirilemedi")
  ) {
    ddx = ddx.map((d) =>
      d.name === "Basit kist" ? { ...d, likelihood: "Yüksek", why: uniq([...(d.why ?? []), "Sıvı densitesi + düzgün kontur kist lehine."]) } : d
    );
  }

  if (f.enhancement === "periferik nodüler") {
    ddx = ddx.map((d) =>
      d.name === "Hemanjiyom" ? { ...d, likelihood: "Yüksek", why: uniq([...(d.why ?? []), "Periferik nodüler kontrastlanma hemanjiyom için tipik."]) } : d
    );
  }

  if (f.enhancement === "arteryel hipervasküler") {
    ddx.unshift({
      name: "Hipervasküler metastaz",
      likelihood: "Orta",
      why: ["Arteriyel hipervaskülarite hipervasküler metastaz/HCC gibi lezyonları düşündürür."],
    });
    ddx = ddx.map((d) => (d.name.includes("HCC") ? { ...d, likelihood: f.backgroundLiver === "siroz/kronik karaciğer" ? "Yüksek" : "Orta" } : d));
  }

  if (f.enhancement === "halka") {
    ddx.unshift({
      name: "Nekrotik metastaz",
      likelihood: "Orta",
      why: ["Halka tarzı tutulum nekrotik metastaz / apse ile ayırıcı tanıda."],
    });
    if (f.feverOrSepsis) {
      ddx.unshift({
        name: "Apse (halka tutulum)",
        likelihood: "Yüksek",
        why: ["Klinik enfeksiyon bulguları varsa halka tutulumlu lezyon apse lehine güçlenir."],
      });
    }
  }

  if (f.calcification) {
    ddx.unshift({
      name: "Kalsifiye metastaz / mukinöz tümör metastazı",
      likelihood: "Orta",
      why: ["Lezyon içi kalsifikasyon belirli metastaz tiplerinde görülebilir."],
    });
  }

  if (f.air) {
    ddx.unshift({
      name: "Gaz içeren apse",
      likelihood: "Yüksek",
      why: ["Lezyon içinde hava/gaz görülmesi apse lehine güçlü bulgudur."],
    });
  }

  // Capsule-related morphology
  const sub = !!f.subcapsular;
  const cap = !!f.capsuleAppearance;
  const retr = !!f.capsularRetraction;

  if (sub) {
    ddx = ddx.map((d) => {
      if (d.name.includes("HEHE")) return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Subkapsüler yerleşim HEHE’de tarif edilebilir."]) };
      if (d.name.includes("ICC")) return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Subkapsüler/fibrotik lezyonlarda ICC düşünülür."]) };
      if (d.name === "Metastaz") return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Subkapsüler yerleşim metastazlarda da görülebilir."]) };
      return d;
    });
  }

  if (retr) {
    ddx = ddx.map((d) => {
      if (d.name.includes("HEHE")) return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Kapsüler çekinti HEHE’de bildirilebilir."]) };
      if (d.name.includes("ICC")) return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Kapsüler çekinti ICC lehine olabilir (fibrotik stroma)."]) };
      if (d.name === "Metastaz") return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Fibrotik metastazlarda kapsüler çekinti görülebilir."]) };
      if (d.name.includes("Hemanjiyom") || d.name.includes("Basit kist"))
        return { ...d, likelihood: bump(d.likelihood, "down"), why: uniq([...(d.why ?? []), "Kapsüler çekinti kist/hemanjiyom için tipik değildir."]) };
      return d;
    });
  }

  if (cap) {
    ddx = ddx.map((d) => {
      if (d.name.includes("HCC")) {
        return {
          ...d,
          likelihood: bump(d.likelihood, "up"),
          why: uniq([...(d.why ?? []), "Pseudo-kapsül görünümü HCC’de görülebilir (özellikle sirozda)."]),
        };
      }
      if (d.name.includes("ICC")) return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Kapsül benzeri rim/fibrozis ICC’de görülebilir."]) };
      if (d.name === "Metastaz") return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Bazı metastazlarda periferik rim/kapsül benzeri görünüm olabilir."]) };
      return d;
    });
  }

  const seen = new Set<string>();
  const out: DdxItem[] = [];
  for (const item of ddx) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

type LiverMRSignalCombo = {
  t1: MRIntensity;
  t2: MRIntensity;
  dwi: "restriksiyon var" | "restriksiyon yok" | "bilinmiyor";
  adc: "düşük" | "normal/yüksek" | "bilinmiyor";
  inOut: "yağ var (signal drop)" | "yağ yok" | "bilinmiyor";
  hemorrhageOrProtein?: boolean;
  backgroundLiver?: "normal" | "steatoz" | "siroz/kronik karaciğer";
  knownPrimary?: boolean;

  mrContrastStatus?: MRContrastStatus;

  // Dynamic / HBP patterns (when contrast available)
  arterial?: MREnhSimple; // hyper/iso/hypo
  washout?: TriState;
  delayed?: MRDelayedPattern; // progressive / persistent / washout
  capsuleEnh?: TriState; // enhancing capsule (dynamic)
  hbp?: MREnhSimple; // hepatobiliary phase intensity

  // Optional morphology
  subcapsular?: boolean;
  capsularRetraction?: boolean;
  capsuleAppearance?: boolean;
};

function liverMR_BaselineDdx(s: LiverMRSignalCombo): DdxItem[] {
  let ddx: DdxItem[] = [];

  ddx.push(
    { name: "Basit kist", likelihood: "Orta", why: ["T2 hiper ve DWI restriksiyon yoksa kist lehine güçlenir."] },
    { name: "Hemanjiyom", likelihood: "Orta", why: ["Genellikle T2 hiperintens; restriksiyon tipik değil."] },
    { name: "Metastaz", likelihood: "Orta", why: ["DWI/ADC ve klinik bağlamla değerlendirilir; çoklu olabilir."] },
    { name: "HCC", likelihood: "Düşük", why: ["Siroz zemininde öncelik kazanır; dinamik patern değerlidir."] },
    { name: "ICC", likelihood: "Düşük", why: ["Fibrotik lezyonlarda düşünülebilir; dinamik/hepatobiliyer faz yardımcıdır."] },
    { name: "FNH", likelihood: "Düşük", why: ["HBP’de hiper/izo olabilir; dinamikte tipik patern değerlidir."] },
    { name: "Adenom", likelihood: "Düşük", why: ["Yağ/hemoraji bulguları ve HBP davranışı ile ayrım; dinamik yoksa sınırlı."] }
  );

  const t1 = normIntensity(s.t1);
  const t2 = normIntensity(s.t2);

  const hasRestriction = s.dwi === "restriksiyon var" || s.adc === "düşük";
  const noRestriction = s.dwi === "restriksiyon yok" || s.adc === "normal/yüksek";

  // T2 hyper + no restriction → cyst/hem
  if (t2.coarse === "hiper" && noRestriction) {
    ddx.unshift({
      name: "Basit kist / kistik lezyon",
      likelihood: t2.strength === 2 ? "Yüksek" : "Orta",
      why: [
        "T2 hiper + restriksiyon yok → kistik içerik lehine.",
        t1.coarse === "hipo" ? "T1 hipointensite kistik içerik lehine." : "T1 ile korele ediniz.",
      ],
    });

    ddx.unshift({
      name: "Hemanjiyom (özellikle T2 belirgin hiperintens)",
      likelihood: t2.strength === 2 ? "Yüksek" : "Orta",
      why: [
        t2.strength === 2
          ? "T2 belirgin hiperintensite hemanjiyom lehine güçlü."
          : "T2 hafif hiperintensite hemanjiyom ile uyumlu olabilir.",
        "Dinamik kontrast paterni tanısaldır (varsa).",
      ],
    });
  }

  // Restriction → metastasis/abscess
  if (hasRestriction) {
    ddx.unshift({
      name: "Metastaz (restriksiyon gösterebilir)",
      likelihood: s.knownPrimary ? "Yüksek" : "Orta",
      why: ["DWI restriksiyon / ADC düşükliği malignite lehine olabilir.", s.knownPrimary ? "Bilinen primer malignite ile olasılık artar." : "Klinik ve dağılım ile değerlendirilir."],
    });
    ddx.unshift({
      name: "Apse / enfekte lezyon",
      likelihood: "Orta",
      why: ["DWI restriksiyon apse lehine de olabilir; klinik ile korele."],
    });
  }

  // T1 hyper → hemorrhage/protein or fat
  if (t1.coarse === "hiper") {
    if (s.inOut === "yağ var (signal drop)") {
      ddx.unshift({
        name: "Adenom (intralezyonel yağ olası)",
        likelihood: "Orta",
        why: ["In/Out-phase sinyal düşüşü yağ lehine.", "Adenomlarda yağ ve/veya hemoraji görülebilir."],
      });
    }
    if (s.hemorrhageOrProtein) {
      ddx.unshift({
        name: "Hemorajik / proteinöz içerikli lezyon",
        likelihood: t1.strength === 2 ? "Yüksek" : "Orta",
        why: [t1.strength === 2 ? "Belirgin T1 hiperintensite hemoraji/proteinöz içerik lehine güçlü." : "T1 hiperintensite hemoraji/protein ile uyumlu olabilir."],
      });
    }
  }

  // Background cirrhosis
  if (s.backgroundLiver === "siroz/kronik karaciğer") {
    ddx = ddx.map((d) => (d.name === "HCC" ? { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Siroz zemininde HCC olasılığı artar."]) } : d));
  }

  // Morphology: subcapsular / retraction / capsule appearance
  if (s.subcapsular) {
    ddx.unshift({
      name: "HEHE (subkapsüler dağılım)",
      likelihood: "Orta",
      why: ["Subkapsüler/multifokal dağılım HEHE’de tarif edilebilir.", "Dinamik + DWI ile korele."],
    });
  }

  if (s.capsularRetraction) {
    ddx = ddx.map((d) => {
      if (d.name === "ICC") return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Kapsüler çekinti ICC lehine olabilir (fibrotik komponent)."]) };
      if (d.name === "HCC") return { ...d, likelihood: bump(d.likelihood, "down"), why: uniq([...(d.why ?? []), "Kapsüler çekinti HCC için daha az tipik; fibrotik lezyonlar düşünülür."]) };
      return d;
    });
  }

  if (s.capsuleAppearance) {
    ddx = ddx.map((d) => {
      if (d.name === "HCC") return { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Pseudo-kapsül görünümü HCC’de görülebilir."]) };
      return d;
    });
  }

  /** ===== Dynamic/HBP logic (when contrast available) ===== */
  const hasDyn = s.mrContrastStatus && s.mrContrastStatus !== "kontrastsız";

  if (hasDyn) {
    const arterialHyper = s.arterial === "hiper";
    const washoutYes = s.washout === "var";
    const capsuleYes = s.capsuleEnh === "var";
    const delayedProg = s.delayed === "progresif";
    const hbpHypo = s.hbp === "hipo";
    const hbpHyper = s.hbp === "hiper";

    // Classic HCC heuristic (NOT LI-RADS, just pattern-based support)
    if (arterialHyper && washoutYes) {
      ddx = ddx.map((d) => (d.name === "HCC" ? { ...d, likelihood: "Yüksek", why: uniq([...(d.why ?? []), "Arteriyel hipervaskülarite + washout paterni HCC lehine güçlü."]) } : d));
      if (capsuleYes) {
        ddx = ddx.map((d) => (d.name === "HCC" ? { ...d, why: uniq([...(d.why ?? []), "Enhancing kapsül görünümü HCC lehine destekleyici olabilir."]) } : d));
      }
    } else if (arterialHyper && capsuleYes) {
      ddx = ddx.map((d) => (d.name === "HCC" ? { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Arteriyel hipervaskülarite ve kapsül destekleyici."]) } : d));
    }

    // ICC / fibrotic lesions: progressive delayed enhancement + retraction
    if (delayedProg) {
      ddx = ddx.map((d) => (d.name === "ICC" ? { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Gecikmiş fazda progresif kontrastlanma fibrotik lezyonlarda (ICC vb.) görülebilir."]) } : d));
    }
    if (delayedProg && s.capsularRetraction) {
      ddx = ddx.map((d) => (d.name === "ICC" ? { ...d, likelihood: "Yüksek" } : d));
    }

    // HBP logic (when hepatobiliary phase available)
    if (s.mrContrastStatus === "hepatobiliyer faz var") {
      if (hbpHyper) {
        ddx = ddx.map((d) =>
          d.name === "FNH"
            ? { ...d, likelihood: "Orta", why: uniq([...(d.why ?? []), "Hepatobiliyer fazda hiper/izo sinyal FNH lehine olabilir."]) }
            : d
        );
        ddx = ddx.map((d) => (d.name === "HCC" ? { ...d, likelihood: bump(d.likelihood, "down") } : d));
      }
      if (hbpHypo) {
        ddx = ddx.map((d) =>
          d.name === "HCC" ? { ...d, likelihood: bump(d.likelihood, "up"), why: uniq([...(d.why ?? []), "Hepatobiliyer fazda hipointensite malignite lehine olabilir (HCC/metastaz/ICC)."]) } : d
        );
        ddx = ddx.map((d) => (d.name === "Metastaz" ? { ...d, likelihood: bump(d.likelihood, "up") } : d));
        ddx = ddx.map((d) => (d.name === "ICC" ? { ...d, likelihood: bump(d.likelihood, "up") } : d));
      }
    }
  }

  // De-duplicate
  const seen = new Set<string>();
  const out: DdxItem[] = [];
  for (const item of ddx) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** =============================
 * Report language filtering
 * ============================= */

type OrganFinding = {
  organ: "Karaciğer" | "Safra kesesi" | "Safra yolları";
  status: YesNo;
  summary?: string;
  ddx?: DdxItem[];
};

function buildFinalReportSentence(opts: {
  modality: StudyModality;
  organs: OrganFinding[];
  incidental: string;
  style: "Kısa" | "Detaylı";
  includeProbabilityLanguage: boolean;
  includeRecommendationsLanguage: boolean;
  recommendations: Recommendation[];
}): string {
  const { modality, organs, incidental, style, includeProbabilityLanguage, includeRecommendationsLanguage, recommendations } = opts;

  const pathologic = organs.filter((o) => o.status === "var" && (o.summary?.trim() || o.ddx?.length));
  const parts: string[] = [];

  if (pathologic.length === 0) {
    parts.push(`${modality} incelemede belirgin akut patoloji izlenmemektedir.`);
  } else {
    for (const o of pathologic) {
      const organPart: string[] = [];
      organPart.push(`${o.organ}: ${o.summary?.trim() || "Patolojik bulgu mevcuttur."}`);

      if (includeProbabilityLanguage && o.ddx && o.ddx.length) {
        const high = o.ddx.filter((d) => d.likelihood === "Yüksek").map((d) => d.name);
        const mid = o.ddx.filter((d) => d.likelihood === "Orta").map((d) => d.name);
        const low = o.ddx.filter((d) => d.likelihood === "Düşük").map((d) => d.name);

        const ddxBits: string[] = [];
        if (high.length) ddxBits.push(`Öncelikle ${high.join(", ")}`);
        if (mid.length) ddxBits.push(`ayırıcıda ${mid.join(", ")}`);
        if (style === "Detaylı" && low.length) ddxBits.push(`daha düşük olasılıkla ${low.join(", ")}`);

        if (ddxBits.length) organPart.push(ddxBits.join("; ") + ".");
      }

      parts.push(organPart.join(" "));
    }
  }

  if (incidental.trim()) parts.push(`Ek/İnsidental: ${incidental.trim()}`);

  if (includeRecommendationsLanguage && recommendations.length) {
    const sorted = [...recommendations].sort((a, b) => {
      const rank = (u?: Recommendation["urgency"]) => (u === "Acil" ? 0 : u === "Öncelikli" ? 1 : 2);
      return rank(a.urgency) - rank(b.urgency);
    });

    const recText = sorted
      .map((r) => {
        const pref = r.urgency ? `${r.urgency}: ` : "";
        const details = r.details?.length ? ` (${r.details.join("; ")})` : "";
        return `${pref}${r.title}${details}`;
      })
      .join(" | ");

    parts.push(`Öneri: ${recText}`);
  }

  let out = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!/[.!?]$/.test(out)) out += ".";
  return out;
}

/** =============================
 * Presets
 * ============================= */

type LiverPresetId =
  | "BT_HYPO_BASE"
  | "BT_CYST_LIKE"
  | "BT_PERIPH_NOD_HEM"
  | "BT_RING_ENH"
  | "BT_HYPERVASC"
  | "MR_T2BRIGHT_NORES"
  | "MR_RESTRICT"
  | "MR_T1BRIGHT_FATDROP"
  | "MR_T1BRIGHT_PROTEIN"
  | "MR_HCC_CLASSIC"
  | "MR_ICC_FIBROTIC"
  | "MR_FNH_HBP";

const liverPresets: Array<{ id: LiverPresetId; title: string; hint: string }> = [
  { id: "BT_HYPO_BASE", title: "BT • Hipodens (baz)", hint: "Baz hipodens preset (DDX boş kalmaz)." },
  { id: "BT_CYST_LIKE", title: "BT • Kist-benzeri", hint: "Sıvı densitesi + düzgün kontur + minimal/yok tutulum." },
  { id: "BT_PERIPH_NOD_HEM", title: "BT • Hemanjiyom paterni", hint: "Periferik nodüler tutulum." },
  { id: "BT_RING_ENH", title: "BT • Halka tutulum", hint: "Nekrotik metastaz/apse ddx’i yükseltir." },
  { id: "BT_HYPERVASC", title: "BT • Arteriyel hipervasküler", hint: "HCC/hipervasküler metastaz ddx’i yükseltir." },

  { id: "MR_T2BRIGHT_NORES", title: "MR • T2 parlak + restriksiyon yok", hint: "Kist/hemanjiyom ağırlıklı baz ddx." },
  { id: "MR_RESTRICT", title: "MR • Restriksiyon/ADC düşük", hint: "Metastaz/apse ddx’i yükseltir." },
  { id: "MR_T1BRIGHT_FATDROP", title: "MR • T1 hiper + yağ drop", hint: "Adenom/yağ içeren lezyon ddx." },
  { id: "MR_T1BRIGHT_PROTEIN", title: "MR • T1 hiper (protein/hemoraji)", hint: "Proteinöz/hemorajik içerik ddx." },

  { id: "MR_HCC_CLASSIC", title: "MR • HCC paterni", hint: "Arteriyel hiper + washout (+/- kapsül). (Heuristik)" },
  { id: "MR_ICC_FIBROTIC", title: "MR • Fibrotik/ICC paterni", hint: "Gecikmiş progresif kontrastlanma (+ çekinti). (Heuristik)" },
  { id: "MR_FNH_HBP", title: "MR • FNH (HBP)", hint: "HBP’de hiper/izo + belirgin washout olmaması. (Heuristik)" },
];

const liverSegments = ["I", "II", "III", "IVa", "IVb", "V", "VI", "VII", "VIII"] as const;
type LiverSegment = (typeof liverSegments)[number];

function numOrUndef(s: string) {
  const x = Number(String(s).replace(",", "."));
  return Number.isFinite(x) ? x : undefined;
}

function makeLiverSummary(opts: {
  segment?: LiverSegment;
  sizeMm?: number;
  lesionLabel?: string;
  extra?: string;
}) {
  const seg = opts.segment ? `Segment ${opts.segment}` : "Karaciğer parankiminde";
  const size = opts.sizeMm ? `${Math.round(opts.sizeMm)} mm` : "ölçümü";
  const label = opts.lesionLabel ?? "fokal lezyon";
  const extra = opts.extra?.trim() ? ` ${opts.extra.trim()}` : "";
  return `${seg} düzeyinde yaklaşık ${size} ${label} izlenmektedir.${extra}`.replace(/\s+/g, " ").trim();
}

/** =============================
 * Small UI helpers
 * ============================= */

function triButtons(value: TriState, setValue: (v: TriState) => void) {
  const items: Array<{ v: TriState; t: string }> = [
    { v: "bilinmiyor", t: "Bilinmiyor" },
    { v: "yok", t: "Yok" },
    { v: "var", t: "Var" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <Button key={x.v} size="sm" variant={value === x.v ? "default" : "outline"} onClick={() => setValue(x.v)}>
          {x.t}
        </Button>
      ))}
    </div>
  );
}

function simpleButtons<T extends string>(value: T, setValue: (v: T) => void, items: Array<{ v: T; t: string }>) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <Button key={x.v} size="sm" variant={value === x.v ? "default" : "outline"} onClick={() => setValue(x.v)}>
          {x.t}
        </Button>
      ))}
    </div>
  );
}

function intensityLabel(x: MRIntensity) {
  if (x === "bilinmiyor") return "Bilinmiyor";
  if (x === "izo") return "İzo";
  if (x === "hafif hipo") return "Hafif hipo";
  if (x === "belirgin hipo") return "Belirgin hipo";
  if (x === "hafif hiper") return "Hafif hiper";
  if (x === "belirgin hiper") return "Belirgin hiper";
  return x;
}

export default function Page() {
  const [modality, setModality] = useState<StudyModality>("BT");

  const [liverStatus, setLiverStatus] = useState<YesNo>("yok");
  const [gbStatus, setGbStatus] = useState<YesNo>("yok");
  const [bileDuctStatus, setBileDuctStatus] = useState<YesNo>("yok");

  const [incidental, setIncidental] = useState<string>("");

  const [style, setStyle] = useState<"Kısa" | "Detaylı">("Kısa");
  const [includeProbLang, setIncludeProbLang] = useState(true);
  const [includeRecLang, setIncludeRecLang] = useState(true);

  // Segment + size
  const [liverSegment, setLiverSegment] = useState<LiverSegment | "bilinmiyor">("bilinmiyor");
  const [liverSizeMm, setLiverSizeMm] = useState<string>("");

  // Presets + auto summary
  const [liverPreset, setLiverPreset] = useState<LiverPresetId | "">("");
  const [autoFillSummary, setAutoFillSummary] = useState(true);
  const [liverSummaryTouched, setLiverSummaryTouched] = useState(false);

  // Contrast status
  const [btContrastStatus, setBtContrastStatus] = useState<BTContrastStatus>("kontrastsız");
  const [mrContrastStatus, setMrContrastStatus] = useState<MRContrastStatus>("kontrastsız");

  // Liver BT features
  const [liverBtNumber, setLiverBtNumber] = useState<LiverBTHypodenseFeatures["number"]>("tek");
  const [liverBtMargins, setLiverBtMargins] = useState<LiverBTHypodenseFeatures["margins"]>("düzgün");
  const [liverBtAtt, setLiverBtAtt] = useState<LiverBTHypodenseFeatures["attenuation"]>("hipodens (nonspesifik)");
  const [liverBtEnh, setLiverBtEnh] = useState<LiverBTHypodenseFeatures["enhancement"]>("değerlendirilemedi");
  const [liverBtCalc, setLiverBtCalc] = useState(false);
  const [liverBtFat, setLiverBtFat] = useState(false);
  const [liverBtAir, setLiverBtAir] = useState(false);
  const [liverBtBg, setLiverBtBg] = useState<LiverBTHypodenseFeatures["backgroundLiver"]>("normal");
  const [liverBtKnownPrimary, setLiverBtKnownPrimary] = useState(false);
  const [liverBtFever, setLiverBtFever] = useState(false);
  const [liverBtTrauma, setLiverBtTrauma] = useState(false);
  const [liverBtBileDil, setLiverBtBileDil] = useState(false);

  // Capsule morphology (shared)
  const [subcapsular, setSubcapsular] = useState<TriState>("bilinmiyor");
  const [capsuleAppearance, setCapsuleAppearance] = useState<TriState>("bilinmiyor");
  const [capsularRetraction, setCapsularRetraction] = useState<TriState>("bilinmiyor");

  // MR signals
  const [mrIntensityDetail, setMrIntensityDetail] = useState(false); // UX: coarse vs mild/marked

  const [mrT1, setMrT1] = useState<MRIntensity>("bilinmiyor");
  const [mrT2, setMrT2] = useState<MRIntensity>("bilinmiyor");
  const [mrDwi, setMrDwi] = useState<LiverMRSignalCombo["dwi"]>("bilinmiyor");
  const [mrAdc, setMrAdc] = useState<LiverMRSignalCombo["adc"]>("bilinmiyor");
  const [mrInOut, setMrInOut] = useState<LiverMRSignalCombo["inOut"]>("bilinmiyor");
  const [mrHemProt, setMrHemProt] = useState(false);
  const [mrBg, setMrBg] = useState<LiverMRSignalCombo["backgroundLiver"]>("normal");
  const [mrKnownPrimary, setMrKnownPrimary] = useState(false);

  // MR dynamic/HBP patterns
  const [mrArterial, setMrArterial] = useState<MREnhSimple>("bilinmiyor");
  const [mrWashout, setMrWashout] = useState<TriState>("bilinmiyor");
  const [mrDelayed, setMrDelayed] = useState<MRDelayedPattern>("bilinmiyor");
  const [mrCapsuleEnh, setMrCapsuleEnh] = useState<TriState>("bilinmiyor");
  const [mrHBP, setMrHBP] = useState<MREnhSimple>("bilinmiyor");

  // Summaries
  const [liverSummary, setLiverSummary] = useState<string>("");
  const [gbSummary, setGbSummary] = useState<string>("");
  const [bileDuctSummary, setBileDuctSummary] = useState<string>("");

  const [recs, setRecs] = useState<Recommendation[]>([]);

  const showBT = modality === "BT" || modality === "BT+MR";
  const showMR = modality === "MR" || modality === "BT+MR";

  /** BT contrastless => enhancement not meaningful */
  useEffect(() => {
    if (btContrastStatus === "kontrastsız") setLiverBtEnh("değerlendirilemedi");
  }, [btContrastStatus]);

  /** If switching modality, keep contrast states sane */
  useEffect(() => {
    if (modality === "BT") {
      setMrContrastStatus("kontrastsız");
      setMrArterial("bilinmiyor");
      setMrWashout("bilinmiyor");
      setMrDelayed("bilinmiyor");
      setMrCapsuleEnh("bilinmiyor");
      setMrHBP("bilinmiyor");
    }
    if (modality === "MR") {
      setBtContrastStatus("kontrastsız");
      setLiverBtEnh("değerlendirilemedi");
    }
  }, [modality]);

  /** If MR contrastless, reset dynamic fields */
  useEffect(() => {
    if (mrContrastStatus === "kontrastsız") {
      setMrArterial("bilinmiyor");
      setMrWashout("bilinmiyor");
      setMrDelayed("bilinmiyor");
      setMrCapsuleEnh("bilinmiyor");
      setMrHBP("bilinmiyor");
    }
    if (mrContrastStatus === "dinamik gadolinyum var") {
      setMrHBP("bilinmiyor");
    }
  }, [mrContrastStatus]);

  function applyPreset(id: LiverPresetId) {
    setLiverPreset(id);
    if (autoFillSummary) setLiverSummaryTouched(false);
    setLiverStatus("var");

    // BT presets
    if (id.startsWith("BT_")) {
      if (modality === "MR") setModality("BT+MR");
      setBtContrastStatus("kontrastsız");
      setLiverBtNumber("tek");
      setLiverBtMargins("düzgün");
      setLiverBtCalc(false);
      setLiverBtFat(false);
      setLiverBtAir(false);
      setLiverBtFever(false);
      setLiverBtTrauma(false);

      if (id === "BT_HYPO_BASE") {
        setLiverBtAtt("hipodens (nonspesifik)");
        setLiverBtEnh("değerlendirilemedi");
      }
      if (id === "BT_CYST_LIKE") {
        setLiverBtAtt("saf sıvı densiteye yakın");
        setLiverBtEnh("yok/çok az");
        setLiverBtMargins("düzgün");
      }
      if (id === "BT_PERIPH_NOD_HEM") {
        setBtContrastStatus("dinamik (3 faz)");
        setLiverBtAtt("hipodens (nonspesifik)");
        setLiverBtEnh("periferik nodüler");
      }
      if (id === "BT_RING_ENH") {
        setBtContrastStatus("dinamik (3 faz)");
        setLiverBtAtt("hipodens (nonspesifik)");
        setLiverBtEnh("halka");
      }
      if (id === "BT_HYPERVASC") {
        setBtContrastStatus("dinamik (3 faz)");
        setLiverBtAtt("hipodens (nonspesifik)");
        setLiverBtEnh("arteryel hipervasküler");
      }
    }

    // MR presets
    if (id.startsWith("MR_")) {
      if (modality === "BT") setModality("BT+MR");

      // baseline defaults
      setMrT1("bilinmiyor");
      setMrT2("bilinmiyor");
      setMrDwi("bilinmiyor");
      setMrAdc("bilinmiyor");
      setMrInOut("bilinmiyor");
      setMrHemProt(false);

      // reset dynamic
      setMrArterial("bilinmiyor");
      setMrWashout("bilinmiyor");
      setMrDelayed("bilinmiyor");
      setMrCapsuleEnh("bilinmiyor");
      setMrHBP("bilinmiyor");

      if (id === "MR_T2BRIGHT_NORES") {
        setMrContrastStatus("kontrastsız");
        setMrT2("belirgin hiper");
        setMrT1("hafif hipo");
        setMrDwi("restriksiyon yok");
        setMrAdc("normal/yüksek");
      }
      if (id === "MR_RESTRICT") {
        setMrContrastStatus("kontrastsız");
        setMrDwi("restriksiyon var");
        setMrAdc("düşük");
      }
      if (id === "MR_T1BRIGHT_FATDROP") {
        setMrContrastStatus("kontrastsız");
        setMrT1("belirgin hiper");
        setMrInOut("yağ var (signal drop)");
        setMrT2("izo");
      }
      if (id === "MR_T1BRIGHT_PROTEIN") {
        setMrContrastStatus("kontrastsız");
        setMrT1("belirgin hiper");
        setMrHemProt(true);
        setMrT2("izo");
      }
      if (id === "MR_HCC_CLASSIC") {
        setMrContrastStatus("dinamik gadolinyum var");
        setMrArterial("hiper");
        setMrWashout("var");
        setMrCapsuleEnh("var");
        setMrDelayed("washout");
      }
      if (id === "MR_ICC_FIBROTIC") {
        setMrContrastStatus("dinamik gadolinyum var");
        setMrArterial("hipo");
        setMrWashout("yok");
        setMrCapsuleEnh("bilinmiyor");
        setMrDelayed("progresif");
        setCapsularRetraction("var");
      }
      if (id === "MR_FNH_HBP") {
        setMrContrastStatus("hepatobiliyer faz var");
        setMrArterial("hiper");
        setMrWashout("yok");
        setMrDelayed("persistan");
        setMrHBP("hiper");
      }
    }

    if (autoFillSummary) {
      const size = numOrUndef(liverSizeMm);
      const seg = liverSegment === "bilinmiyor" ? undefined : liverSegment;

      let label = "fokal lezyon";
      let extra = "";

      if (id === "BT_HYPO_BASE") label = "hipodens fokal lezyon";
      if (id === "BT_CYST_LIKE") label = "kist ile uyumlu hipodens lezyon";
      if (id === "BT_PERIPH_NOD_HEM") label = "hemanjiyom lehine lezyon";
      if (id === "BT_RING_ENH") label = "halka tarzı kontrastlanan lezyon";
      if (id === "BT_HYPERVASC") label = "arteriyel hipervasküler lezyon";

      if (id === "MR_T2BRIGHT_NORES") label = "T2 belirgin hiperintens (kistik/hemanjiyom lehine) lezyon";
      if (id === "MR_RESTRICT") label = "DWI restriksiyon gösteren lezyon";
      if (id === "MR_T1BRIGHT_FATDROP") label = "T1 hiperintens ve yağ içeriği gösteren lezyon";
      if (id === "MR_T1BRIGHT_PROTEIN") label = "T1 hiperintens (protein/hemoraji olası) lezyon";
      if (id === "MR_HCC_CLASSIC") label = "dinamik patern (arteriyel hiper + washout) gösteren lezyon";
      if (id === "MR_ICC_FIBROTIC") label = "gecikmiş fazda progresif kontrastlanan (fibrotik) lezyon";
      if (id === "MR_FNH_HBP") label = "hepatobiliyer fazda hiperintens (FNH lehine) lezyon";

      if (liverBtKnownPrimary || mrKnownPrimary) extra = "Bilinen malignite öyküsü ile korelasyon önerilir.";
      if (liverBtFever) extra = "Klinik enfeksiyon bulguları ile korele ediniz.";

      setLiverSummary(makeLiverSummary({ segment: seg, sizeMm: size, lesionLabel: label, extra }));
    }
  }

  /** Auto-update summary (if user not touched it) */
  useEffect(() => {
    if (liverStatus !== "var") return;
    if (!autoFillSummary) return;
    if (liverSummaryTouched) return;

    const size = numOrUndef(liverSizeMm);
    const seg = liverSegment === "bilinmiyor" ? undefined : liverSegment;

    let label = showMR ? "MR’de izlenen fokal lezyon" : "hipodens fokal lezyon";

    if (liverPreset) {
      const id = liverPreset;
      if (id === "BT_HYPO_BASE") label = "hipodens fokal lezyon";
      if (id === "BT_CYST_LIKE") label = "kist ile uyumlu hipodens lezyon";
      if (id === "BT_PERIPH_NOD_HEM") label = "hemanjiyom lehine lezyon";
      if (id === "BT_RING_ENH") label = "halka tarzı kontrastlanan lezyon";
      if (id === "BT_HYPERVASC") label = "arteriyel hipervasküler lezyon";
      if (id === "MR_T2BRIGHT_NORES") label = "T2 belirgin hiperintens lezyon";
      if (id === "MR_RESTRICT") label = "DWI restriksiyon gösteren lezyon";
      if (id === "MR_T1BRIGHT_FATDROP") label = "T1 hiperintens + yağ içeriği gösteren lezyon";
      if (id === "MR_T1BRIGHT_PROTEIN") label = "T1 hiperintens (protein/hemoraji olası) lezyon";
      if (id === "MR_HCC_CLASSIC") label = "arteriyel hiper + washout paterni gösteren lezyon";
      if (id === "MR_ICC_FIBROTIC") label = "gecikmiş fazda progresif kontrastlanan lezyon";
      if (id === "MR_FNH_HBP") label = "hepatobiliyer fazda hiperintens lezyon";
    }

    setLiverSummary(makeLiverSummary({ segment: seg, sizeMm: size, lesionLabel: label }));
  }, [liverSegment, liverSizeMm, autoFillSummary, liverSummaryTouched, liverStatus, liverPreset, showMR]);

  /** DDX */
  const liverDdx = useMemo(() => {
    if (liverStatus !== "var") return [] as DdxItem[];

    const sub = subcapsular === "var";
    const cap = capsuleAppearance === "var";
    const retr = capsularRetraction === "var";

    if (showMR) {
      const combo: LiverMRSignalCombo = {
        t1: mrT1,
        t2: mrT2,
        dwi: mrDwi,
        adc: mrAdc,
        inOut: mrInOut,
        hemorrhageOrProtein: mrHemProt,
        backgroundLiver: mrBg,
        knownPrimary: mrKnownPrimary,
        mrContrastStatus,
        arterial: mrArterial,
        washout: mrWashout,
        delayed: mrDelayed,
        capsuleEnh: mrCapsuleEnh,
        hbp: mrHBP,
        subcapsular: sub,
        capsuleAppearance: cap,
        capsularRetraction: retr,
      };
      return liverMR_BaselineDdx(combo);
    }

    const sizeNum = numOrUndef(liverSizeMm);
    const features: LiverBTHypodenseFeatures = {
      sizeMm: sizeNum,
      number: liverBtNumber,
      margins: liverBtMargins,
      attenuation: liverBtAtt,
      enhancement: liverBtEnh,
      calcification: liverBtCalc,
      fat: liverBtFat,
      air: liverBtAir,
      backgroundLiver: liverBtBg,
      knownPrimary: liverBtKnownPrimary,
      feverOrSepsis: liverBtFever,
      trauma: liverBtTrauma,
      biliaryDilation: liverBtBileDil,
      subcapsular: sub,
      capsuleAppearance: cap,
      capsularRetraction: retr,
    };
    return liverHypodenseBT_Ddx(features);
  }, [
    liverStatus,
    showMR,
    liverSizeMm,
    subcapsular,
    capsuleAppearance,
    capsularRetraction,

    // MR deps
    mrT1,
    mrT2,
    mrDwi,
    mrAdc,
    mrInOut,
    mrHemProt,
    mrBg,
    mrKnownPrimary,
    mrContrastStatus,
    mrArterial,
    mrWashout,
    mrDelayed,
    mrCapsuleEnh,
    mrHBP,

    // BT deps
    liverBtNumber,
    liverBtMargins,
    liverBtAtt,
    liverBtEnh,
    liverBtCalc,
    liverBtFat,
    liverBtAir,
    liverBtBg,
    liverBtKnownPrimary,
    liverBtFever,
    liverBtTrauma,
    liverBtBileDil,
  ]);

  /** Recommendations */
  useEffect(() => {
    const next: Recommendation[] = [];

    const mrHasContrast = mrContrastStatus !== "kontrastsız";
    const mrHasHBP = mrContrastStatus === "hepatobiliyer faz var";
    const btHasDynamic = btContrastStatus === "dinamik (3 faz)";

    if (liverStatus === "var") {
      if (showMR) {
        if (!mrHasContrast) {
          next.push({
            title: "Karaciğer lezyonu karakterizasyonu için dinamik kontrastlı karaciğer MR önerilir",
            urgency: "Öncelikli",
            details: ["DWI/ADC + in/out-phase", "Gadolinyum dinamik fazlar", "Uygunsa hepatobiliyer faz (gadoxetate)"],
          });
        } else if (!mrHasHBP) {
          // If dynamic exists but HBP not, suggest if indeterminate patterns
          const indeterminate =
            mrArterial === "bilinmiyor" ||
            mrWashout === "bilinmiyor" ||
            mrDelayed === "bilinmiyor" ||
            (capsularRetraction === "var" && mrDelayed !== "progresif");

          if (indeterminate) {
            next.push({
              title: "Gerektiğinde hepatobiliyer faz (gadoxetate) eklenmesi ayırıcı tanıyı güçlendirebilir",
              urgency: "Rutin",
              details: ["FNH/adenom ayrımı", "HCC/ICC/metastaz ayrımı", "Lezyon karakterizasyonu"],
            });
          }
        }
      } else if (showBT) {
        if (!btHasDynamic) {
          next.push({
            title: "Lezyon karakterizasyonu için üç fazlı (arteriyel-portal-geç) kontrastlı üst abdomen BT / karaciğer MR önerilir",
            urgency: "Öncelikli",
            details: ["Mevcut BT kontrastsız/tek faz ise patern ayrımı sınırlıdır"],
          });
        }
      }

      if (liverBtBileDil || bileDuctStatus === "var") {
        next.push({
          title: "Kolestaz/koledok patolojisi açısından MRCP önerilir",
          urgency: "Öncelikli",
          details: ["Heavily T2 MRCP", "Gerekirse ERCP ile korelasyon"],
        });
      }

      if (liverBtFever) {
        next.push({
          title: "Enfeksiyon/apse şüphesi varsa klinik-lab korelasyonu ve kısa aralıklı kontrol görüntüleme",
          urgency: "Acil",
          details: ["Ateş, lökositoz, CRP", "Gerekirse drenaj/enfeksiyon hast. konsültasyonu"],
        });
      }

      if (liverBtKnownPrimary || mrKnownPrimary) {
        next.push({
          title: "Bilinen malignite öyküsü varsa evreleme amaçlı onkoloji protokolü ile değerlendirme",
          urgency: "Öncelikli",
          details: ["Lezyon sayısı/dağılım", "Ek odaklar için tüm abdomen taraması"],
        });
      }

      if (capsularRetraction === "var" || subcapsular === "var") {
        next.push({
          title: "Subkapsüler yerleşim/kapsüler çekinti varsa fibrotik lezyonlar (ICC/HEHE vb.) açısından dinamik + hepatobiliyer fazlı MR ile değerlendirme",
          urgency: "Öncelikli",
          details: ["DWI/ADC", "Dinamik fazlar", "Hepatobiliyer faz (mümkünse)"],
        });
      }
    }

    setRecs(next);
  }, [
    liverStatus,
    showBT,
    showMR,
    btContrastStatus,
    mrContrastStatus,
    mrArterial,
    mrWashout,
    mrDelayed,
    capsularRetraction,
    subcapsular,
    liverBtBileDil,
    bileDuctStatus,
    liverBtFever,
    liverBtKnownPrimary,
    mrKnownPrimary,
  ]);

  const organs: OrganFinding[] = useMemo(() => {
    return [
      { organ: "Karaciğer", status: liverStatus, summary: liverSummary, ddx: liverStatus === "var" ? liverDdx : [] },
      { organ: "Safra kesesi", status: gbStatus, summary: gbSummary, ddx: [] },
      { organ: "Safra yolları", status: bileDuctStatus, summary: bileDuctSummary, ddx: [] },
    ];
  }, [liverStatus, liverSummary, liverDdx, gbStatus, gbSummary, bileDuctStatus, bileDuctSummary]);

  const finalSentence = useMemo(() => {
    return buildFinalReportSentence({
      modality,
      organs,
      incidental,
      style,
      includeProbabilityLanguage: includeProbLang,
      includeRecommendationsLanguage: includeRecLang,
      recommendations: recs,
    });
  }, [modality, organs, incidental, style, includeProbLang, includeRecLang, recs]);

  const ddxPanel = useMemo(() => {
    const liver = organs.find((o) => o.organ === "Karaciğer");
    if (!liver || liver.status !== "var" || !liver.ddx?.length) {
      return <div className="text-sm text-muted-foreground">DDX için karaciğerde “Var” seç.</div>;
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge>Ayırıcı Tanı</Badge>
          <span className="text-xs text-muted-foreground">Canlı (kural tabanlı)</span>
        </div>
        <div className="grid gap-2">
          {liver.ddx.slice(0, 12).map((d) => (
            <Card key={d.name} className="border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{d.name}</div>
                  <Badge variant={d.likelihood === "Yüksek" ? "default" : d.likelihood === "Orta" ? "secondary" : "outline"}>{d.likelihood}</Badge>
                </div>
                {d.why?.length ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                    {d.why.slice(0, 3).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }, [organs]);

  function resetAll() {
    setModality("BT");
    setLiverStatus("yok");
    setGbStatus("yok");
    setBileDuctStatus("yok");
    setIncidental("");
    setStyle("Kısa");
    setIncludeProbLang(true);
    setIncludeRecLang(true);

    setLiverSegment("bilinmiyor");
    setLiverSizeMm("");
    setLiverPreset("");
    setAutoFillSummary(true);
    setLiverSummaryTouched(false);

    setBtContrastStatus("kontrastsız");
    setMrContrastStatus("kontrastsız");

    setLiverBtNumber("tek");
    setLiverBtMargins("düzgün");
    setLiverBtAtt("hipodens (nonspesifik)");
    setLiverBtEnh("değerlendirilemedi");
    setLiverBtCalc(false);
    setLiverBtFat(false);
    setLiverBtAir(false);
    setLiverBtBg("normal");
    setLiverBtKnownPrimary(false);
    setLiverBtFever(false);
    setLiverBtTrauma(false);
    setLiverBtBileDil(false);

    setSubcapsular("bilinmiyor");
    setCapsuleAppearance("bilinmiyor");
    setCapsularRetraction("bilinmiyor");

    setMrIntensityDetail(false);
    setMrT1("bilinmiyor");
    setMrT2("bilinmiyor");
    setMrDwi("bilinmiyor");
    setMrAdc("bilinmiyor");
    setMrInOut("bilinmiyor");
    setMrHemProt(false);
    setMrBg("normal");
    setMrKnownPrimary(false);

    setMrArterial("bilinmiyor");
    setMrWashout("bilinmiyor");
    setMrDelayed("bilinmiyor");
    setMrCapsuleEnh("bilinmiyor");
    setMrHBP("bilinmiyor");

    setLiverSummary("");
    setGbSummary("");
    setBileDuctSummary("");
    setRecs([]);
  }

  const intensityDetailOptions: MRIntensity[] = ["bilinmiyor", "belirgin hipo", "hafif hipo", "izo", "hafif hiper", "belirgin hiper"];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">radiology-clean</h1>
                <p className="text-sm text-muted-foreground">
                  Abdomen odaklı • BT/MR uyumlu • Canlı çıktı • Preset + Klinik bağlam • <span className="font-medium">MR dinamik/HBP paternleri</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">vNext</Badge>
                <Button variant="outline" size="sm" onClick={resetAll}>
                  Sıfırla
                </Button>
              </div>
            </div>

            {/* Top Controls */}
            <Card>
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>İnceleme tipi</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["BT", "MR", "BT+MR"] as StudyModality[]).map((m) => (
                        <Button key={m} variant={modality === m ? "default" : "outline"} onClick={() => setModality(m)} size="sm">
                          {m}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Seçime göre alanlar koşullu açılır/kapanır.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Rapor stili</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["Kısa", "Detaylı"] as const).map((s) => (
                        <Button key={s} variant={style === s ? "default" : "outline"} onClick={() => setStyle(s)} size="sm">
                          {s}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={includeProbLang} onCheckedChange={(v) => setIncludeProbLang(!!v)} />
                        <span className="text-sm">Olasılık dili</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={includeRecLang} onCheckedChange={(v) => setIncludeRecLang(!!v)} />
                        <span className="text-sm">Öneri dili</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Preset</Label>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Preset</span> seçince ilgili BT/MR alanları dolar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {liverPresets.slice(0, 6).map((p) => (
                        <Tooltip key={p.id}>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant={liverPreset === p.id ? "default" : "outline"} onClick={() => applyPreset(p.id)}>
                              {p.title.split("•")[1]?.trim() ?? p.title}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{p.hint}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clinical Context */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Klinik zemin / bağlam</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={liverBtKnownPrimary || mrKnownPrimary} onCheckedChange={(v) => (setLiverBtKnownPrimary(!!v), setMrKnownPrimary(!!v))} />
                    <span className="text-sm">Bilinen malignite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={liverBtFever} onCheckedChange={(v) => setLiverBtFever(!!v)} />
                    <span className="text-sm">Ateş / sepsis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={liverBtTrauma} onCheckedChange={(v) => setLiverBtTrauma(!!v)} />
                    <span className="text-sm">Travma</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch checked={liverBtBileDil || bileDuctStatus === "var"} onCheckedChange={(v) => (setLiverBtBileDil(!!v), setBileDuctStatus(!!v ? "var" : bileDuctStatus))} />
                    <span className="text-sm">Kolestaz / safra dilatasyonu</span>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Karaciğer zemini</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["normal", "steatoz", "siroz/kronik karaciğer"] as const).map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          variant={(showMR ? mrBg : liverBtBg) === v ? "default" : "outline"}
                          onClick={() => {
                            setLiverBtBg(v);
                            setMrBg(v);
                          }}
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main grid */}
            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
              {/* LEFT */}
              <div className="space-y-4">
                {/* Organ toggles */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Organlar</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Karaciğer</Label>
                        <div className="flex gap-2">
                          {(["yok", "var"] as const).map((v) => (
                            <Button key={v} size="sm" variant={liverStatus === v ? "default" : "outline"} onClick={() => setLiverStatus(v)}>
                              {v === "var" ? "Var" : "Yok"}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Safra kesesi</Label>
                        <div className="flex gap-2">
                          {(["yok", "var"] as const).map((v) => (
                            <Button key={v} size="sm" variant={gbStatus === v ? "default" : "outline"} onClick={() => setGbStatus(v)}>
                              {v === "var" ? "Var" : "Yok"}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Safra yolları</Label>
                        <div className="flex gap-2">
                          {(["yok", "var"] as const).map((v) => (
                            <Button key={v} size="sm" variant={bileDuctStatus === v ? "default" : "outline"} onClick={() => setBileDuctStatus(v)}>
                              {v === "var" ? "Var" : "Yok"}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Liver details */}
                {liverStatus === "var" ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Karaciğer • Lezyon detayları</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Segment</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant={liverSegment === "bilinmiyor" ? "default" : "outline"} onClick={() => setLiverSegment("bilinmiyor")}>
                              Bilinmiyor
                            </Button>
                            {liverSegments.map((s) => (
                              <Button key={s} size="sm" variant={liverSegment === s ? "default" : "outline"} onClick={() => setLiverSegment(s)}>
                                {s}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Boyut (mm)</Label>
                          <Input value={liverSizeMm} onChange={(e) => setLiverSizeMm(e.target.value)} placeholder="örn: 18" />
                          <div className="flex items-center gap-2">
                            <Switch checked={autoFillSummary} onCheckedChange={(v) => setAutoFillSummary(!!v)} />
                            <span className="text-sm">Otomatik özet</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Özet (editlenebilir)</Label>
                          <Input
                            value={liverSummary}
                            onChange={(e) => {
                              setLiverSummary(e.target.value);
                              setLiverSummaryTouched(true);
                            }}
                            placeholder="Otomatik dolar; istersen düzenle"
                          />
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Capsule morphology */}
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Subkapsüler yerleşim</Label>
                          {triButtons(subcapsular, setSubcapsular)}
                          <p className="text-xs text-muted-foreground">Subkapsüler + çekinti fibrotik lezyonlarda (ICC/HEHE vb.) ayırıcıya katkı sağlar.</p>
                        </div>

                        <div className="space-y-2">
                          <Label>Kapsül görünümü (pseudo-kapsül)</Label>
                          {triButtons(capsuleAppearance, setCapsuleAppearance)}
                          <p className="text-xs text-muted-foreground">Pseudo-kapsül HCC’de (özellikle sirozda) görülebilir.</p>
                        </div>

                        <div className="space-y-2">
                          <Label>Kapsüler çekinti</Label>
                          {triButtons(capsularRetraction, setCapsularRetraction)}
                          <p className="text-xs text-muted-foreground">Kapsüler çekinti ICC/HEHE ve fibrotik metastazlarda daha olası.</p>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* BT/MR tabs */}
                      <Tabs defaultValue={showMR ? "MR" : "BT"} value={showMR ? "MR" : "BT"} onValueChange={() => {}}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="BT" disabled={!showBT}>
                            BT
                          </TabsTrigger>
                          <TabsTrigger value="MR" disabled={!showMR}>
                            MR
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="BT">
                          {!showBT ? (
                            <div className="text-sm text-muted-foreground mt-3">BT seçili değil.</div>
                          ) : (
                            <div className="mt-4 space-y-4">
                              <div className="space-y-2">
                                <Label>BT kontrast durumu</Label>
                                <div className="flex flex-wrap gap-2">
                                  {(["kontrastsız", "kontrastlı (tek faz)", "dinamik (3 faz)"] as BTContrastStatus[]).map((v) => (
                                    <Button key={v} size="sm" variant={btContrastStatus === v ? "default" : "outline"} onClick={() => setBtContrastStatus(v)}>
                                      {v}
                                    </Button>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">Kontrastsız BT’de kontrast paterni değerlendirilemez. Patern en anlamlı dinamik (3 faz) incelemede.</p>
                              </div>

                              <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                  <Label>Lezyon sayısı</Label>
                                  {simpleButtons(liverBtNumber!, setLiverBtNumber as any, [
                                    { v: "tek", t: "Tek" },
                                    { v: "çok", t: "Çoklu" },
                                  ])}
                                </div>

                                <div className="space-y-2">
                                  <Label>Sınır</Label>
                                  {simpleButtons(liverBtMargins!, setLiverBtMargins as any, [
                                    { v: "düzgün", t: "Düzgün" },
                                    { v: "düzensiz", t: "Düzensiz" },
                                  ])}
                                </div>

                                <div className="space-y-2">
                                  <Label>Nonkontrast densite</Label>
                                  {simpleButtons(liverBtAtt!, setLiverBtAtt as any, [
                                    { v: "saf sıvı densiteye yakın", t: "Sıvı densite" },
                                    { v: "hipodens (nonspesifik)", t: "Hipodens" },
                                    { v: "heterojen", t: "Heterojen" },
                                  ])}
                                </div>
                              </div>

                              {btContrastStatus === "kontrastsız" ? (
                                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                                  Kontrastsız BT seçili → kontrastlanma paterni <span className="font-medium">değerlendirilemedi</span>.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Label>Kontrast paterni</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {(["yok/çok az", "periferik nodüler", "arteryel hipervasküler", "halka", "heterojen"] as const).map((v) => (
                                      <Button key={v} size="sm" variant={liverBtEnh === v ? "default" : "outline"} onClick={() => setLiverBtEnh(v)}>
                                        {v}
                                      </Button>
                                    ))}
                                    <Button size="sm" variant={liverBtEnh === "değerlendirilemedi" ? "default" : "outline"} onClick={() => setLiverBtEnh("değerlendirilemedi")}>
                                      değerlendirilemedi
                                    </Button>
                                  </div>
                                </div>
                              )}

                              <div className="grid gap-4 md:grid-cols-3">
                                <div className="flex items-center gap-2">
                                  <Switch checked={liverBtCalc} onCheckedChange={(v) => setLiverBtCalc(!!v)} />
                                  <span className="text-sm">Kalsifikasyon</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch checked={liverBtFat} onCheckedChange={(v) => setLiverBtFat(!!v)} />
                                  <span className="text-sm">Yağ</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch checked={liverBtAir} onCheckedChange={(v) => setLiverBtAir(!!v)} />
                                  <span className="text-sm">Hava/gaz</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="MR">
                          {!showMR ? (
                            <div className="text-sm text-muted-foreground mt-3">MR seçili değil.</div>
                          ) : (
                            <div className="mt-4 space-y-4">
                              <div className="space-y-2">
                                <Label>MR kontrast durumu</Label>
                                <div className="flex flex-wrap gap-2">
                                  {(["kontrastsız", "dinamik gadolinyum var", "hepatobiliyer faz var"] as MRContrastStatus[]).map((v) => (
                                    <Button key={v} size="sm" variant={mrContrastStatus === v ? "default" : "outline"} onClick={() => setMrContrastStatus(v)}>
                                      {v}
                                    </Button>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">Kontrastsız MR’da T1/T2/DWI/ADC + In/Out ile baz DDX; dinamik/HBP varsa ayrım güçlenir.</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Switch checked={mrIntensityDetail} onCheckedChange={(v) => setMrIntensityDetail(!!v)} />
                                <span className="text-sm">T1/T2 “mild/marked” detay modu</span>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>T1</Label>
                                  {!mrIntensityDetail ? (
                                    <div className="flex flex-wrap gap-2">
                                      {(["bilinmiyor", "hipo", "izo", "hiper"] as MREnhSimple[]).map((v) => (
                                        <Button
                                          key={v}
                                          size="sm"
                                          variant={normIntensity(mrT1).coarse === v || (v === "bilinmiyor" && mrT1 === "bilinmiyor") ? "default" : "outline"}
                                          onClick={() => setMrT1(coarseToIntensity(v, true))}
                                        >
                                          {v === "bilinmiyor" ? "Bilinmiyor" : v === "hipo" ? "Hipo" : v === "izo" ? "İzo" : "Hiper"}
                                        </Button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {intensityDetailOptions.map((v) => (
                                        <Button key={v} size="sm" variant={mrT1 === v ? "default" : "outline"} onClick={() => setMrT1(v)}>
                                          {intensityLabel(v)}
                                        </Button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label>T2</Label>
                                  {!mrIntensityDetail ? (
                                    <div className="flex flex-wrap gap-2">
                                      {(["bilinmiyor", "hipo", "izo", "hiper"] as MREnhSimple[]).map((v) => (
                                        <Button
                                          key={v}
                                          size="sm"
                                          variant={normIntensity(mrT2).coarse === v || (v === "bilinmiyor" && mrT2 === "bilinmiyor") ? "default" : "outline"}
                                          onClick={() => setMrT2(coarseToIntensity(v, true))}
                                        >
                                          {v === "bilinmiyor" ? "Bilinmiyor" : v === "hipo" ? "Hipo" : v === "izo" ? "İzo" : "Hiper"}
                                        </Button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {intensityDetailOptions.map((v) => (
                                        <Button key={v} size="sm" variant={mrT2 === v ? "default" : "outline"} onClick={() => setMrT2(v)}>
                                          {intensityLabel(v)}
                                        </Button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                  <Label>DWI</Label>
                                  {simpleButtons(mrDwi, setMrDwi, [
                                    { v: "bilinmiyor", t: "Bilinmiyor" },
                                    { v: "restriksiyon var", t: "Restriksiyon var" },
                                    { v: "restriksiyon yok", t: "Restriksiyon yok" },
                                  ])}
                                </div>

                                <div className="space-y-2">
                                  <Label>ADC</Label>
                                  {simpleButtons(mrAdc, setMrAdc, [
                                    { v: "bilinmiyor", t: "Bilinmiyor" },
                                    { v: "düşük", t: "Düşük" },
                                    { v: "normal/yüksek", t: "Normal/Yüksek" },
                                  ])}
                                </div>

                                <div className="space-y-2">
                                  <Label>In/Out phase</Label>
                                  {simpleButtons(mrInOut, setMrInOut, [
                                    { v: "bilinmiyor", t: "Bilinmiyor" },
                                    { v: "yağ var (signal drop)", t: "Yağ var" },
                                    { v: "yağ yok", t: "Yağ yok" },
                                  ])}
                                </div>

                                <div className="flex items-center gap-2">
                                  <Switch checked={mrHemProt} onCheckedChange={(v) => setMrHemProt(!!v)} />
                                  <span className="text-sm">Hemoraji/Protein (T1 hiper)</span>
                                </div>
                              </div>

                              {/* Dynamic / HBP patterns (conditional) */}
                              {mrContrastStatus === "kontrastsız" ? null : (
                                <>
                                  <Separator className="my-2" />
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label>Kontrast paternleri (MR)</Label>
                                      <Badge variant="secondary">{mrContrastStatus === "hepatobiliyer faz var" ? "Dinamik + HBP" : "Dinamik"}</Badge>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Arteriyel faz</Label>
                                        {simpleButtons(mrArterial, setMrArterial, [
                                          { v: "bilinmiyor", t: "Bilinmiyor" },
                                          { v: "hipo", t: "Hipo" },
                                          { v: "izo", t: "İzo" },
                                          { v: "hiper", t: "Hiper" },
                                        ])}
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Washout</Label>
                                        {triButtons(mrWashout, setMrWashout)}
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Gecikmiş faz paterni</Label>
                                        {simpleButtons(mrDelayed, setMrDelayed, [
                                          { v: "bilinmiyor", t: "Bilinmiyor" },
                                          { v: "persistan", t: "Persistan" },
                                          { v: "progresif", t: "Progresif" },
                                          { v: "washout", t: "Washout" },
                                        ])}
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Enhancing kapsül (dinamik)</Label>
                                        {triButtons(mrCapsuleEnh, setMrCapsuleEnh)}
                                      </div>

                                      {mrContrastStatus === "hepatobiliyer faz var" ? (
                                        <div className="space-y-2 md:col-span-2">
                                          <Label>Hepatobiliyer faz (HBP) sinyali</Label>
                                          {simpleButtons(mrHBP, setMrHBP, [
                                            { v: "bilinmiyor", t: "Bilinmiyor" },
                                            { v: "hipo", t: "Hipo" },
                                            { v: "izo", t: "İzo" },
                                            { v: "hiper", t: "Hiper" },
                                          ])}
                                          <p className="text-xs text-muted-foreground">
                                            HBP hiper/izo → FNH lehine olabilir. HBP hipo → malignite (HCC/ICC/metastaz) lehine olabilir (klinik+diğer fazlarla birlikte).
                                          </p>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                ) : null}

                {/* GB */}
                {gbStatus === "var" ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Safra kesesi • Özet</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Input value={gbSummary} onChange={(e) => setGbSummary(e.target.value)} placeholder="örn: Taş ile uyumlu hiperdens odaklar..." />
                    </CardContent>
                  </Card>
                ) : null}

                {/* Bile ducts */}
                {bileDuctStatus === "var" ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Safra yolları • Özet</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Input value={bileDuctSummary} onChange={(e) => setBileDuctSummary(e.target.value)} placeholder="örn: İntra/ekstrahepatik safra yollarında dilatasyon..." />
                    </CardContent>
                  </Card>
                ) : null}

                {/* Incidental */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Ek / İnsidental bulgular</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Textarea value={incidental} onChange={(e) => setIncidental(e.target.value)} placeholder="Buraya serbest metin ekle; final rapora entegre olur." />
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT OUTPUT */}
              <div className="lg:sticky lg:top-6 h-fit">
                <Card className="border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">AI Çıktı</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">Final (tek cümle)</Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard?.writeText(finalSentence);
                            }}
                          >
                            Kopyala
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Tek-cümlelik final raporu panoya kopyalar</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="rounded-lg border p-3 text-sm leading-relaxed">{finalSentence}</div>

                    <Separator />

                    <ScrollArea className="h-[360px] pr-2">
                      <div className="space-y-4">
                        {ddxPanel}

                        {includeRecLang && recs.length ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge>Öneriler</Badge>
                              <span className="text-xs text-muted-foreground">Koşullu otomatik</span>
                            </div>
                            <div className="grid gap-2">
                              {recs.map((r, idx) => (
                                <Card key={idx} className="border">
                                  <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="font-medium">{r.title}</div>
                                      {r.urgency ? (
                                        <Badge variant={r.urgency === "Acil" ? "default" : r.urgency === "Öncelikli" ? "secondary" : "outline"}>{r.urgency}</Badge>
                                      ) : null}
                                    </div>
                                    {r.details?.length ? (
                                      <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                                        {r.details.slice(0, 4).map((d, i) => (
                                          <li key={i}>{d}</li>
                                        ))}
                                      </ul>
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
                      Not: Bu modül kural tabanlıdır; kesin tanı için dinamik paternler/sekanslar ve klinik korelasyon gerekir.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="mt-8 text-xs text-muted-foreground">
              radiology-clean • preset tabanlı • var/yok → koşullu derinleşme • MR: mild/marked intensite + dinamik/HBP paternleri • patoloji-odaklı rapor filtresi • canlı çıktı paneli
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
