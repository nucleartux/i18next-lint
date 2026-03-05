import React from "react";
import { useTranslation } from "react-i18next";

const LazyE = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_47")}
      {t("title_48")}
      {t("label_21")}
      {t("next")}
      {t("prev")}
    </div>
  );
};

export default LazyE;
