import React from "react";
import { useTranslation } from "react-i18next";

export const LazyB = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_42")}
      {t("label_18")}
      {t("loading")}
    </div>
  );
};
