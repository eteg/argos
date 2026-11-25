import { Suspense } from "react";
import { ReportReadonly } from "@/components/report-readonly";

export default function Page() {
  return (
    <Suspense>
      <ReportReadonly />
    </Suspense>
  );
}
