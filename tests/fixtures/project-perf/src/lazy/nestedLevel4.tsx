import { routes as nestedLevel5 } from "./nestedLevel5";

export const routes = [
  { path: "/deep/4", lazy: () => import("./LazyA4") },
  { routes: nestedLevel5 },
];
