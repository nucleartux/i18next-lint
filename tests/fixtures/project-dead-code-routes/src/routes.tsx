import { routes as nestedRoutes } from "./nested";

// Local variable (same file) - like appointmentRoutes with children: routes in frontend
const localRoutes = [
  {
    path: "/local",
    lazy: () => import("./LazyPage"),
  },
];

export const routes = [
  {
    path: "/nested",
    lazy: () => import("./LazyPage"),
  },
  { routes: nestedRoutes },
  { children: localRoutes },
];
