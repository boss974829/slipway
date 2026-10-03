import { createFileRoute } from "@tanstack/react-router";
import { SlipGame } from "@/components/slip/slip-game";

export const Route = createFileRoute("/slip")({
  component: SlipGame,
});
