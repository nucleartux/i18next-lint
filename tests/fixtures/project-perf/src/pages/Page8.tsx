import React from "react";
import { useTranslation } from "react-i18next";
import { Page9 } from "./Page9";

export const Page8 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_30")}
      {t("label_14")}
      {t("price")}
      {t("currency")}
      <Page9 />
    </div>
  );
};
