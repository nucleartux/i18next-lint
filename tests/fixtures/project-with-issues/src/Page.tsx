import React from "react";
import { useTranslation } from "react-i18next";

export const Page = () => {
  const { t } = useTranslation();
  return <div>{t("missing_key")}</div>;
};
