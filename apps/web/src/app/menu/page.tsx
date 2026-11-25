import { Suspense } from "react";
import { MenuScreen } from "@/components/menu-screen";

export default function Page() {
  return (
    <Suspense>
      <MenuScreen />
    </Suspense>
  );
}
