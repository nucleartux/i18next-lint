import React from "react";
import { useTranslation } from "react-i18next";
import { TableRow } from "./TableRow";

export const Table = () => {
  const { t } = useTranslation();
  return (
    <table>
      <thead>
        <tr>
          <th>{t("title_11")}</th>
          <th>{t("title_12")}</th>
          <th>{t("name")}</th>
          <th>{t("date")}</th>
        </tr>
      </thead>
      <tbody>
        <TableRow />
      </tbody>
    </table>
  );
};
