import { routes as nestedLevel7 } from "./nestedLevel7";

export const routes = [
  { path: "/deep/6", lazy: () => import("./LazyA6") },
  { routes: nestedLevel7 },
];
