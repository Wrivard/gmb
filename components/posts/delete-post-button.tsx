"use client";

// Suppression d'un post (brouillon/planifié/échec) avec confirmation —
// partagé entre les rangées de la file et l'éditeur. La modal remplace
// le confirm() navigateur : même langage visuel que le reste de l'app.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deletePostAction } from "@/app/(app)/posts/actions";

export function DeletePostButton({
  postId,
  clientName,
  /** "icon" (rangée de file) ou "button" (éditeur). */
  variant = "icon",
  /** Navigation post-suppression (ex. retour à la file depuis l'éditeur). */
  redirectTo,
}: {
  postId: string;
  clientName: string;
  variant?: "icon" | "button";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deletePostAction(postId);
      if (result.ok) {
        setOpen(false);
        toast.success(`Post de ${clientName} supprimé.`);
        if (redirectTo) {
          router.push(redirectTo);
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          variant === "icon" ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Supprimer le post de ${clientName}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={(event) => event.stopPropagation()}
            >
              <Trash2 />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
              Supprimer
            </Button>
          )
        }
      />
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce post ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le post de {clientName} — texte et image — sera supprimé
            définitivement. Il ne partira jamais sur Google.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={confirmDelete}
            disabled={pending}
          >
            {pending ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
