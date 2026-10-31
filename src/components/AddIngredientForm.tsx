"use client";

import { useState } from "react";
import { MAX_INGREDIENTS, MAX_NAME_LENGTH } from "@/lib/ingredients";

type AddIngredientFormProps = {
  onAdd: (name: string) => void;
  full: boolean; // the list already has MAX_INGREDIENTS items
};

// "➕ Add something": type an item you have that isn't in the photos, then press Enter.
export function AddIngredientForm({ onAdd, full }: AddIngredientFormProps) {
  const [text, setText] = useState("");

  return (
    <form
      className="mt-5 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const name = text.trim();
        if (name === "" || full) return;
        onAdd(name);
        setText("");
      }}
    >
      <label htmlFor="add-ingredient" className="text-lg font-semibold">
        ➕ Add something
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
          className="sticker min-h-12 min-w-0 flex-1 rounded-2xl bg-white px-4 py-2 text-base placeholder:text-ink/60 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={full || text.trim() === ""}
          className="sticker pressable min-h-12 bg-mint px-5 font-semibold disabled:pointer-events-none disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {full && <p className="text-sm">That&apos;s {MAX_INGREDIENTS} things, the cauldron is full!</p>}
    </form>
  );
}
