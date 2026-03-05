import React from "react";
import { useTranslation } from "react-i18next";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  return (
    <div>
      <header>{t("title_3")}</header>
      <main>{children}</main>
      <footer>{t("back")}</footer>
    </div>
  );
};
