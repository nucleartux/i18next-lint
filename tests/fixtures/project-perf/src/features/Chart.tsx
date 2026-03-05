import React from "react";
import { useTranslation } from "react-i18next";

export const Chart = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_8")}
      {t("title_9")}
      {t("label_2")}
      {t("label_3")}
      {t("amount")}
      {t("total")}
    </div>
  );
};
