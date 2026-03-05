import React from "react";
import { useTranslation } from "react-i18next";

export const LazyC = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_43")}
      {t("title_44")}
      {t("label_19")}
      {t("error")}
    </div>
  );
};
