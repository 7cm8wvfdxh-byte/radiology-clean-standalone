import Link from "next/link";

const CARDS = [
  { href: "/brain", title: "Beyin", desc: "Travma • Kanama • Kitle/Enfeksiyon" },
  { href: "/liver", title: "Karaciğer", desc: "BT/MR • DDX • Öneri motoru" },
  { href: "/pancreas", title: "Pankreas", desc: "Akut pankreatit • Kitle • Komplikasyon" },
];

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Structured Radiology Assistant</h1>
      <p className="text-sm text-gray-600">
        Modül seç. Üst bardan istediğin organa geçebilirsin.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow"
          >
            <div className="font-semibold">{c.title}</div>
            <div className="mt-1 text-sm text-gray-600">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
