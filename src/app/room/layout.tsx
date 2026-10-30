import { SiteHeader } from '@/components/SiteHeader';

export default function ClassicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader compact />
      {children}
    </>
  );
}
