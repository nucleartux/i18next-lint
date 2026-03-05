import React from "react";
import { useTranslation } from "react-i18next";
import { Page10 } from "./Page10";

export const Page9 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_31")}
      {t("title_32")}
      {t("label_15")}
      {t("confirm")}
      <Page10 />
    </div>
  );
};
