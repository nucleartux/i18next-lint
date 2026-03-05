import { routes as nestedLevel2 } from "./nestedLevel2";

export const routes = [
  { path: "/deep/1", lazy: () => import("./LazyA1") },
  { routes: nestedLevel2 },
];
