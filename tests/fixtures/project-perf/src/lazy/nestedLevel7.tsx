import { routes as nestedLevel8 } from "./nestedLevel8";

export const routes = [
  { path: "/deep/7", lazy: () => import("./LazyA7") },
  { routes: nestedLevel8 },
];
