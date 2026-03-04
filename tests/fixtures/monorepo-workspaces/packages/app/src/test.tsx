import React from "react";
import { useTranslation } from "react-i18next";
import { Header } from "common/scripts/header";
import { Button } from "ui/button";

export const App = () => {
  const { t } = useTranslation();

  const title = t("app_title");

  return (
    <div>
      <Header />
      <h1>{title}</h1>
      <Button />
    </div>
  );
};

