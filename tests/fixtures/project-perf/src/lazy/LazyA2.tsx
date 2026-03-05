import React from "react";
import { useTranslation } from "react-i18next";

export const LazyA2 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_61")}
      {t("label_23")}
      {t("name")}
    </div>
  );
};
