import React from "react";
import { useTranslation } from "react-i18next";
import { View as F1 } from "./feature1/View";
import { View as F2 } from "./feature2/View";

export const Entry = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("welcome")}
      {t("dashboard")}
      {t("settings")}
      <F1 />
      <F2 />
    </div>
  );
};
