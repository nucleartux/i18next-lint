import React from "react";
import { useTranslation } from "react-i18next";

export const Button = () => {
  const { t } = useTranslation();
  const label = t("button_label");

  return <button>{label}</button>;
};

