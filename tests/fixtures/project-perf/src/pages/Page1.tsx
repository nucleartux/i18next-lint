import React from "react";
import { useTranslation } from "react-i18next";
import { Page2 } from "./Page2";
import { Card } from "../components/Card";

export const Page1 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_18")}
      {t("title_19")}
      {t("label_6")}
      <Page2 />
      <Card />
    </div>
  );
};
