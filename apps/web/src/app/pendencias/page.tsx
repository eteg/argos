import { Suspense } from "react";
import { Pendencias } from "@/components/pendencias";

export default function Page() {
  return (
    <Suspense>
      <Pendencias />
    </Suspense>
  );
}
