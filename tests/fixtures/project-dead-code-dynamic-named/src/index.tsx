import { lazy } from "react";
import { useTranslation } from "react-i18next";

const LazyBar = lazy(() => import("./Module").then((m) => ({ default: m.Bar })));

export const App = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("entry_key")}
      <LazyBar />
    </div>
  );
};
