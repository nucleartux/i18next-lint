import { routes as nestedLevel3 } from "./nestedLevel3";

export const routes = [
  { path: "/deep/2", lazy: () => import("./LazyA2") },
  { routes: nestedLevel3 },
];
