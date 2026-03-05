import React from "react";
import { useTranslation } from "react-i18next";

export const Detail = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_11")}
      {t("next")}
      {t("prev")}
    </div>
  );
};
