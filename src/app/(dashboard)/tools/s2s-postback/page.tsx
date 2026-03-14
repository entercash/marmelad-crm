export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { S2sPostbackForm } from "@/features/s2s-postback/components/s2s-postback-form";

export const metadata = { title: "S2S Postback" };

export default function S2sPostbackPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="S2S Postback"
        description="Manually send conversion postbacks to Taboola"
      />
      <S2sPostbackForm />
    </div>
  );
}
