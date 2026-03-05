import React from "react";
import { useTranslation } from "react-i18next";
import { Page3 } from "./Page3";

export const Page2 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_20")}
      {t("title_21")}
      {t("label_7")}
      {t("search")}
      <Page3 />
    </div>
  );
};
