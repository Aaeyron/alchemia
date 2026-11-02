// Loaded with `node --import` before the tests: turns on the module hooks in hooks.mjs.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
