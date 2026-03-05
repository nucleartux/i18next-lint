import React from "react";
import { useTranslation } from "react-i18next";

export const LazyA6 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_65")}
      {t("label_27")}
      {t("date")}
    </div>
  );
};
