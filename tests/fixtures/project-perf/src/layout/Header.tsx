import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";

export const Header = () => {
  const { t } = useTranslation();
  return (
    <header>
      <span>{t("title_4")}</span>
      <span>{t("title_5")}</span>
      <span>{t("login")}</span>
      <span>{t("logout")}</span>
      <Button />
    </header>
  );
};
