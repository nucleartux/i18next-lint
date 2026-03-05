import React from "react";
import { useTranslation } from "react-i18next";
import { Form } from "./Form";

export const Settings = () => {
  const { t } = useTranslation();
  return (
    <div>
      <span>{t("title_15")}</span>
      <span>{t("title_16")}</span>
      <span>{t("profile")}</span>
      <Form />
    </div>
  );
};
