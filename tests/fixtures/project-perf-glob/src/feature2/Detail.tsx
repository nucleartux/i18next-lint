import React from "react";
import { useTranslation } from "react-i18next";

export const Detail = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_6")}
      {t("submit")}
      {t("loading")}
    </div>
  );
};
