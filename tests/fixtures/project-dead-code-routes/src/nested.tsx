export const routes = [
  {
    path: "/other",
    lazy: () => import("./OtherLazy"),
  },
];
