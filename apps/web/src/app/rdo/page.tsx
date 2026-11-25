import { Suspense } from "react";
import { ReportReview } from "@/components/report-review";

export default function Page() {
  return (
    <Suspense>
      <ReportReview />
    </Suspense>
  );
}
