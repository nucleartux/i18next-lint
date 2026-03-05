import React from "react";
import { useTranslation } from "react-i18next";
import { Chart } from "./Chart";
import { Stats } from "./Stats";
import { Table } from "./Table";

export const Dashboard = () => {
  const { t } = useTranslation();
  return (
    <div>
      <span>{t("title_6")}</span>
      <span>{t("title_7")}</span>
      <span>{t("reports")}</span>
      <Chart />
      <Stats />
      <Table />
    </div>
  );
};
