"use client";

import type { ComponentProps, RefObject } from "react";
import { AddIngredientForm } from "@/components/AddIngredientForm";
import { BrewProgress } from "@/components/BrewProgress";
import { ErrorBox } from "@/components/ErrorBox";
import { IngredientChip } from "@/components/IngredientChip";
import { PhotoBoxes } from "@/components/PhotoBoxes";
import { PhotoStrip } from "@/components/PhotoStrip";
import { StepShell } from "@/components/StepShell";
import { StickerCard } from "@/components/StickerCard";
import type { Ingredient, UploadedPhoto } from "@/lib/types";

type ShowStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  say: string; // the mascot's line
  bubbling: boolean;
  photos: UploadedPhoto[];
  activePhoto: UploadedPhoto | null;
  onSelectPhoto: (id: string) => void;
  photoBoxes: ComponentProps<typeof PhotoBoxes>["boxes"];
  flash: ComponentProps<typeof PhotoBoxes>["flash"];
  ingredients: Ingredient[];
  selected: string[]; // selected ingredient ids
  onToggleBox: (id: string) => void;
  onToggleChip: (id: string) => void;
  onRemove: (id: string) => void;
  onAddTyped: (name: string) => void;
  ingredientsFull: boolean;
  onNewPhoto: (file: File) => void; // the big box: starts over
  onAddPhoto: (file: File) => void; // "Add another photo": keeps everything
  canAddPhoto: boolean;
  loading: boolean; // a photo is being looked at
  uploadDisabled: boolean; // the big box can't start over right now
  segmenting: boolean;
  error: string | null;
  onNext: () => void;
};

// Step 1: snap photos, then pick the ingredients for the cauldron.
export function ShowStep(props: ShowStepProps) {
  const { photos, activePhoto, ingredients, selected, loading } = props;

  return (
    <StepShell
      emoji="📸"
      title="Show"
      instruction="Snap a photo of things around you, then tap the ingredients you want to use."
      say={props.say}
      bubbling={props.bubbling}
      headingRef={props.headingRef}
      next={{
        label: "Next: Your goal →",
        onClick: props.onNext,
        disabled: selected.length === 0,
        reason: "Pick at least one ingredient",
      }}
    >
      {/* Upload box — the whole area is a label, so tapping anywhere opens the picker.
          A photo picked here starts a fresh session. */}
      <label
        className={`panel pressable min-h-44 items-center justify-center bg-sky-soft text-center focus-within:outline-4 focus-within:outline-offset-3 focus-within:outline-focus ${
          props.uploadDisabled ? "pointer-events-none opacity-55" : ""
        }`}
      >
        <span aria-hidden="true" className="text-4xl">📸</span>
        <span className="h-panel">＋ Add a photo</span>
        <span className="text-base">Snap a photo of things around you to find ingredients!</span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={props.uploadDisabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = ""; // allow picking the same file again
            if (file) props.onNewPhoto(file);
          }}
        />
      </label>

      {activePhoto && (
        // Polaroid-style frame, with tappable boxes once SAM has found the objects.
        <PhotoBoxes
          photo={activePhoto.dataUrl}
          boxes={props.photoBoxes}
          selected={selected}
          onToggle={props.onToggleBox}
          flash={props.flash}
        />
      )}

      {photos.length > 0 && (
        <PhotoStrip
          photos={photos}
          activeId={activePhoto?.id ?? null}
          onSelect={props.onSelectPhoto}
          onAddPhoto={props.onAddPhoto}
          canAdd={props.canAddPhoto}
          busy={loading}
        />
      )}

      {props.segmenting && (
        <div className="flex justify-center">
          <BrewProgress kind="segment" compact />
        </div>
      )}

      {loading && <BrewProgress kind="detect" photo={activePhoto?.dataUrl} />}

      {props.error && <ErrorBox message={props.error} />}

      {photos.length > 0 && (
        <StickerCard emoji="🧪" title="Pick your ingredients!">
          <p className="-mt-2 text-base">Tap ingredients to toss them in the cauldron.</p>
          {ingredients.length === 0 && !loading && (
            <p className="empty-state">No ingredients yet. Try another photo, or type one below!</p>
          )}
          <div className="flex flex-wrap gap-3">
            {ingredients.map((ingredient) => (
              <IngredientChip
                key={ingredient.id}
                ingredient={ingredient}
                selected={selected.includes(ingredient.id)}
                onToggle={() => props.onToggleChip(ingredient.id)}
                onRemove={() => props.onRemove(ingredient.id)}
              />
            ))}
          </div>
          <AddIngredientForm onAdd={props.onAddTyped} full={props.ingredientsFull} />
        </StickerCard>
      )}

      {/* Which AI models do what (plain text, closed until tapped). */}
      <details className="panel bg-white text-base">
        <summary className="h-sub cursor-pointer py-2">How Alchemia works</summary>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          <li>
            <strong>Muse Spark</strong> finds the ingredients in your photos and writes the ideas.
          </li>
          <li>
            <strong>SAM 3.1</strong> draws the tappable boxes around each ingredient.
          </li>
          <li>
            <strong>Muse Image</strong> paints the concept picture.
          </li>
          <li>
            <strong>Muse Voice Transcribe</strong> listens to you when you use 🎤.
          </li>
        </ul>
        <p>Concept pictures are AI-generated and may differ from the real thing.</p>
        <p className="hint">Built for the Meta Global AI Developer Hackathon.</p>
      </details>
    </StepShell>
  );
}
