import React from "react";
import { useTranslation } from "react-i18next";

export const Stats = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_10")}
      {t("label_4")}
      {t("label_5")}
      {t("count")}
      {t("quantity")}
    </div>
  );
};
