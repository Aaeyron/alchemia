"use client";

import type { ComponentProps, RefObject } from "react";
import { AddIngredientForm } from "@/components/AddIngredientForm";
import { BrewProgress } from "@/components/BrewProgress";
import { IngredientChip } from "@/components/IngredientChip";
import { PhotoBoxes } from "@/components/PhotoBoxes";
import { PhotoStrip } from "@/components/PhotoStrip";
import { StepShell } from "@/components/StepShell";
import type { Ingredient, UploadedPhoto } from "@/lib/types";

type ShowStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
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
      instruction="Snap a photo of stuff around you, then tap the things you want to use."
      say="Show me what you've got!"
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
        className={`sticker pressable flex min-h-44 flex-col items-center justify-center gap-2 bg-sky-soft p-6 text-center ${
          props.uploadDisabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <span aria-hidden="true" className="text-4xl">📸</span>
        <span className="text-2xl font-semibold">＋ Add something</span>
        <span className="text-base">Snap a photo of stuff around you!</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
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

      {props.error && (
        <p role="alert" className="sticker bg-pink-soft p-4 text-base">
          <strong>Oops! </strong>
          {props.error}
        </p>
      )}

      {photos.length > 0 && (
        <section>
          <h3 className="mb-1 text-2xl font-semibold">Pick your ingredients!</h3>
          <p className="mb-4 text-base">Tap things to toss them in the cauldron.</p>
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
        </section>
      )}
    </StepShell>
  );
}
