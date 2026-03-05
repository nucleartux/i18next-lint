import React from "react";
import { useTranslation } from "react-i18next";
import { Page4 } from "./Page4";
import { Modal } from "../components/Modal";

export const Page3 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_22")}
      {t("label_8")}
      {t("filter")}
      {t("sort")}
      <Page4 />
      <Modal />
    </div>
  );
};
