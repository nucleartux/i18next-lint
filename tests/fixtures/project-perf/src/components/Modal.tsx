import React from "react";
import { useTranslation } from "react-i18next";

export const Modal = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_36")}
      {t("close")}
      {t("open")}
    </div>
  );
};
