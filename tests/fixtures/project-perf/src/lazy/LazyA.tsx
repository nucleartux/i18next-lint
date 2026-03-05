import React from "react";
import { useTranslation } from "react-i18next";

export const LazyA = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_40")}
      {t("title_41")}
      {t("label_17")}
    </div>
  );
};
