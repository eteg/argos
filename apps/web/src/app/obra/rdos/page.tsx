import { Suspense } from "react";
import { ReportsList } from "@/components/reports-list";

export default function Page() {
  return (
    <Suspense>
      <ReportsList />
    </Suspense>
  );
}
