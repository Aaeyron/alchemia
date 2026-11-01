"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { MAX_INGREDIENTS, MAX_NAME_LENGTH } from "@/lib/ingredients";

type AddIngredientFormProps = {
  onAdd: (name: string) => void;
  full: boolean; // the list already has MAX_INGREDIENTS ingredients
};

// "➕ Add an ingredient": type something you have that isn't in the photos, then press Enter.
export function AddIngredientForm({ onAdd, full }: AddIngredientFormProps) {
  const [text, setText] = useState("");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const name = text.trim();
        if (name === "" || full) return;
        onAdd(name);
        setText("");
      }}
    >
      <label htmlFor="add-ingredient" className="h-sub">
        ➕ Add an ingredient
      </label>
      <div className="flex gap-2">
        <input
          id="add-ingredient"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. tape"
          maxLength={MAX_NAME_LENGTH}
          disabled={full}
          className="field flex-1"
        />
        <Button type="submit" disabled={full || text.trim() === ""}>
          Add
        </Button>
      </div>
      {full && <p className="hint">That&apos;s {MAX_INGREDIENTS} ingredients. The cauldron is full!</p>}
    </form>
  );
}
