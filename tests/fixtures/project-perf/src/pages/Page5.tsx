import React from "react";
import { useTranslation } from "react-i18next";
import { Page6 } from "./Page6";
import { List } from "../components/List";

export const Page5 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_25")}
      {t("label_10")}
      {t("import")}
      <Page6 />
      <List />
    </div>
  );
};
