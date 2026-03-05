import React from "react";
import { useTranslation } from "react-i18next";

export const Detail = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_18")}
      {t("sort")}
      {t("export")}
    </div>
  );
};
