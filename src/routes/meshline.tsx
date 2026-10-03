import { createFileRoute } from "@tanstack/react-router";
import { MeshlineApp } from "@/components/meshline/meshline-app";

export const Route = createFileRoute("/meshline")({
  component: MeshlineApp,
});
