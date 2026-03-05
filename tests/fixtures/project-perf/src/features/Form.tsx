import React from "react";
import { useTranslation } from "react-i18next";

export const Form = () => {
  const { t } = useTranslation();
  return (
    <form>
      <label>{t("title_17")}</label>
      <label>{t("email")}</label>
      <label>{t("phone")}</label>
      <label>{t("address")}</label>
      <button>{t("submit")}</button>
      <button>{t("save")}</button>
    </form>
  );
};
