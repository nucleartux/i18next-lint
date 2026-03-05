import React from "react";
import { useTranslation } from "react-i18next";

export const OtherPage = () => {
  const { t } = useTranslation();
  return <div>{t("b")}</div>;
};
