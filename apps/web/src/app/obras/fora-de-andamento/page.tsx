import { Suspense } from "react";
import { AwaySites } from "@/components/away-sites";

export default function Page() {
  return (
    <Suspense>
      <AwaySites />
    </Suspense>
  );
}
