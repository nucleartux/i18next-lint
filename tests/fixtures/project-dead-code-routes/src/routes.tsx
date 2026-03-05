import { routes as nestedRoutes } from "./nested";

export const routes = [
  {
    path: "/nested",
    lazy: () => import("./LazyPage"),
  },
  { routes: nestedRoutes },
];
