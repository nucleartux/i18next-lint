import React from "react";
import { useTranslation } from "react-i18next";

export const LazyA4 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_63")}
      {t("label_25")}
      {t("phone")}
    </div>
  );
};
