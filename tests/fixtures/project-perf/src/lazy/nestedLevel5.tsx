import { routes as nestedLevel6 } from "./nestedLevel6";

export const routes = [
  { path: "/deep/5", lazy: () => import("./LazyA5") },
  { routes: nestedLevel6 },
];
