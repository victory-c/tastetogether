import { copy } from '@/copy/en';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-semibold">{copy.brand}</h1>
      <p className="mt-2 text-stone-600">{copy.tagline}</p>
    </main>
  );
}
