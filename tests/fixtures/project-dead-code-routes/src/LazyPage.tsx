import { useTranslation } from "react-i18next";

export default function LazyPage() {
  const { t } = useTranslation();
  return <div>{t("lazy_page_key")}</div>;
}
