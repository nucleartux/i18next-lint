import React from "react";
import { useTranslation } from "react-i18next";

export const LazyA7 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_66")}
      {t("label_28")}
      {t("time")}
    </div>
  );
};
