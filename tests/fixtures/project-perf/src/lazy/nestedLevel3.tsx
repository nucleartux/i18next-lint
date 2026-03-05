import { routes as nestedLevel4 } from "./nestedLevel4";

export const routes = [
  { path: "/deep/3", lazy: () => import("./LazyA3") },
  { routes: nestedLevel4 },
];
