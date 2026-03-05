import { useTranslation } from "react-i18next";

export default function Page() {
  const { t } = useTranslation();
  return <div>{t("page_key")}</div>;
}

export function UnusedExport() {
  const { t } = useTranslation();
  return <div>{t("unused_in_page")}</div>;
}
