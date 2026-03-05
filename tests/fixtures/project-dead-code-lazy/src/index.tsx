import { lazy } from "react";
import { useTranslation } from "react-i18next";

const LazyPage = lazy(() => import("./Page"));

export const App = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("entry_key")}
      <LazyPage />
    </div>
  );
};
