import { createFileRoute } from "@tanstack/react-router";
import { KilnGame } from "@/components/kiln/kiln-game";

export const Route = createFileRoute("/kiln")({
  component: KilnGame,
});
