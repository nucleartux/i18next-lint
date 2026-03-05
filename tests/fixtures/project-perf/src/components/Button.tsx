import React from "react";
import { useTranslation } from "react-i18next";

export const Button = () => {
  const { t } = useTranslation();
  return <button>{t("title_35")}</button>;
};
