import React from "react";
import { routes as deepNestedRoutes } from "./lazy/nestedLevel1";

const LazyA = React.lazy(() => import("./lazy/LazyA").then((m) => ({ default: m.LazyA })));
const LazyB = React.lazy(() => import("./lazy/LazyB").then((m) => ({ default: m.LazyB })));
const LazyC = React.lazy(() => import("./lazy/LazyC").then((m) => ({ default: m.LazyC })));
const LazyD = React.lazy(() => import("./lazy/LazyD"));
const LazyE = React.lazy(() => import("./lazy/LazyE"));

export const routes = [
  { path: "/a", lazy: () => import("./lazy/LazyA") },
  { path: "/b", lazy: () => import("./lazy/LazyB") },
  { path: "/c", lazy: () => import("./lazy/LazyC") },
  { path: "/d", lazy: () => import("./lazy/LazyD") },
  { path: "/e", lazy: () => import("./lazy/LazyE") },
  { routes: deepNestedRoutes },
];

export function RoutesConfig() {
  return (
    <>
      <React.Suspense fallback={null}>
        <LazyA />
        <LazyB />
        <LazyC />
        <LazyD />
        <LazyE />
      </React.Suspense>
    </>
  );
}
