import { useTranslation } from "react-i18next";

export function Bar() {
  const { t } = useTranslation();
  return <div>{t("bar_key")}</div>;
}

export function Other() {
  const { t } = useTranslation();
  return <div>{t("other_key")}</div>;
}
