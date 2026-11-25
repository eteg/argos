import { Suspense } from "react";
import { SiteForm } from "@/components/site-form";

export default function Page() {
  return (
    <Suspense>
      <SiteForm />
    </Suspense>
  );
}
