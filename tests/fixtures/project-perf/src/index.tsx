import React from "react";
import { useTranslation } from "react-i18next";
import { App } from "./App";
import { RoutesConfig } from "./routes";
import { Layout } from "./layout/Layout";
import { Header } from "./layout/Header";

export const Root = () => {
  const { t } = useTranslation();
  return (
    <Layout>
      <Header />
      <div>{t("welcome")}</div>
      <div>{t("dashboard")}</div>
      <div>{t("settings")}</div>
      <App />
      <RoutesConfig />
    </div>
  );
};
