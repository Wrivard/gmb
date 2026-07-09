"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** L'export PDF passe par l'impression navigateur (le chrome de l'app
    porte print:hidden). */
export function PrintButton() {
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()}>
      <Printer />
      Imprimer / PDF
    </Button>
  );
}
