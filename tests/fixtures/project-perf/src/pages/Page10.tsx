import React from "react";
import { useTranslation } from "react-i18next";

export const Page10 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_33")}
      {t("title_34")}
      {t("label_16")}
      {t("yes")}
      {t("no")}
      {t("optional")}
      {t("required")}
    </div>
  );
};
