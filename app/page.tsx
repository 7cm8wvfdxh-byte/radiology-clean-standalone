import Link from "next/link";
import { Brain, Stethoscope, Activity } from "lucide-react";

const CARDS = [
  {
    href: "/brain",
    title: "Beyin",
    desc: "Travma • Kanama • Kitle/Enfeksiyon",
    icon: Brain,
    gradient: "from-violet-500 to-purple-600",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600"
  },
  {
    href: "/liver",
    title: "Karaciğer",
    desc: "BT/MR • DDX • Öneri motoru",
    icon: Stethoscope,
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600"
  },
  {
    href: "/pancreas",
    title: "Pankreas",
    desc: "Akut pankreatit • Kitle • Komplikasyon",
    icon: Activity,
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600"
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 mb-6 shadow-lg">
          <Stethoscope className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-3">
          Radiology Assistant
        </h1>
        <p className="text-lg text-slate-600 max-w-md mx-auto">
          Yapılandırılmış radyoloji raporlama ve karar destek sistemi
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-4xl">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group relative overflow-hidden rounded-3xl bg-white p-6 shadow-md border border-slate-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              {/* Gradient accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${c.gradient}`} />

              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${c.iconBg} mb-4 transition-transform duration-300 group-hover:scale-110`}>
                <Icon className={`w-6 h-6 ${c.iconColor}`} />
              </div>

              {/* Content */}
              <h2 className="text-xl font-semibold text-slate-900 mb-2">{c.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{c.desc}</p>

              {/* Arrow indicator */}
              <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="mt-12 text-sm text-slate-500">
        Modül seçin veya üst navigasyonu kullanarak sayfalar arasında geçiş yapın
      </p>
    </div>
  );
}
