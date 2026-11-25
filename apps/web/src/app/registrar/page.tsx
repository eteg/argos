import { Suspense } from "react";
import { CheckIn } from "@/components/check-in";

export default function Page() {
  return (
    <Suspense>
      <CheckIn />
    </Suspense>
  );
}
