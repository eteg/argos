import { Suspense } from "react";
import { ReportShare } from "@/components/report-share";

export default function Page() {
  return (
    <Suspense>
      <ReportShare />
    </Suspense>
  );
}
