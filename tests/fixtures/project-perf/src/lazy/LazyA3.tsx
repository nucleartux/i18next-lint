import React from "react";
import { useTranslation } from "react-i18next";

export const LazyA3 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_62")}
      {t("label_24")}
      {t("email")}
    </div>
  );
};
