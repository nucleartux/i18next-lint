import React from "react";
import { useTranslation } from "react-i18next";

export const Header = () => {
  const { t } = useTranslation();
  const label = t("header_label");

  return <h1>{label}</h1>;
};

