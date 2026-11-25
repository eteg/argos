import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Argos",
    short_name: "Argos",
    description: "RDO preenchido por voz e foto",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1f2937",
    icons: [],
  };
}
