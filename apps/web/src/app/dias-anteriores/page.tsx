import { Suspense } from "react";
import { PreviousDays } from "@/components/previous-days";

export default function Page() {
  return (
    <Suspense>
      <PreviousDays />
    </Suspense>
  );
}
