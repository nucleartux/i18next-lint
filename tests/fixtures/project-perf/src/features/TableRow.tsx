import React from "react";
import { useTranslation } from "react-i18next";

export const TableRow = () => {
  const { t } = useTranslation();
  return (
    <tr>
      <td>{t("title_13")}</td>
      <td>{t("title_14")}</td>
      <td>{t("edit")}</td>
      <td>{t("delete")}</td>
    </tr>
  );
};
