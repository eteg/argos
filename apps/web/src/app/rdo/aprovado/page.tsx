import { Suspense } from "react";
import { ReportApproved } from "@/components/report-approved";

export default function Page() {
  return (
    <Suspense>
      <ReportApproved />
    </Suspense>
  );
}
