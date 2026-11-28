import { createLazyFileRoute } from "@tanstack/react-router";
import RealityScan from "@/sections/reality-scan";

export const Route = createLazyFileRoute("/dashboard/reality-scan/")({
  component: RealityScan,
});
