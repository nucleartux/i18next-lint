import React from "react";
import { useTranslation } from "react-i18next";

export const LazyA5 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_64")}
      {t("label_26")}
      {t("address")}
    </div>
  );
};
