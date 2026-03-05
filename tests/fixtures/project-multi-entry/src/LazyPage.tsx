import React from "react";
import { useTranslation } from "react-i18next";

export const LazyPage = () => {
  const { t } = useTranslation();
  return <div>{t("c")}</div>;
};
