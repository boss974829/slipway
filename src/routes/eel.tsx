import { createFileRoute } from "@tanstack/react-router";
import { EelGame } from "@/components/eel/eel-game";

export const Route = createFileRoute("/eel")({
  component: EelGame,
});
