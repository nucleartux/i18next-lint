import React from "react";
import { useTranslation } from "react-i18next";

export const List = () => {
  const { t } = useTranslation();
  return (
    <ul>
      <li>{t("title_38")}</li>
      <li>{t("title_39")}</li>
      <li>{t("unit")}</li>
    </ul>
  );
};
