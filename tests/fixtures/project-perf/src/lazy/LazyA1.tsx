import React from "react";
import { useTranslation } from "react-i18next";

export const LazyA1 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_60")}
      {t("label_22")}
      {t("description")}
    </div>
  );
};
