import React from "react";
import { useTranslation } from "react-i18next";

const LazyD = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_45")}
      {t("title_46")}
      {t("label_20")}
      {t("success")}
    </div>
  );
};

export default LazyD;
