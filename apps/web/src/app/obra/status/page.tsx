import { Suspense } from "react";
import { SiteStatus } from "@/components/site-status";

export default function Page() {
  return (
    <Suspense>
      <SiteStatus />
    </Suspense>
  );
}
