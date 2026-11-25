import { Suspense } from "react";
import { SiteFolder } from "@/components/site-folder";

export default function Page() {
  return (
    <Suspense>
      <SiteFolder />
    </Suspense>
  );
}
