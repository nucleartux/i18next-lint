import React from "react";
import { useTranslation } from "react-i18next";
import { Dashboard } from "./features/Dashboard";
import { Settings } from "./features/Settings";
import { Page1 } from "./pages/Page1";

export const App = () => {
  const { t } = useTranslation();
  return (
    <div>
      <span>{t("title_1")}</span>
      <span>{t("title_2")}</span>
      <span>{t("label_1")}</span>
      <span>{t("save")}</span>
      <span>{t("cancel")}</span>
      <Dashboard />
      <Settings />
      <Page1 />
    </div>
  );
};
