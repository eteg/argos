import { Suspense } from "react";
import { DayView } from "@/components/day-view";

export default function Page() {
  return (
    <Suspense>
      <DayView />
    </Suspense>
  );
}
